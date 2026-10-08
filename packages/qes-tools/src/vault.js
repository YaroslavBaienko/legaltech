/**
 * vault.js — Cryptographic Encryption Vault for Ukrainian QES (ДСТУ 4145 / ГОСТ 28147:89).
 * Preserves attorney-client privilege (адвокатська таємниця) and data confidentiality.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const jk = require('jkurwa');
const { getAlgos } = require('./adapter');
const { createZipArchive } = require('./asice');

class CryptoVault {
  constructor(options = {}) {
    this.algo = options.algo || getAlgos();
  }

  /**
   * Extracts human-readable info from an X.509 certificate.
   */
  extractCertInfo(cert) {
    if (!cert) return null;
    const subj = cert.subject || {};
    const issuer = cert.issuer || {};

    let rnokpp = '';
    if (subj.serialNumber) {
      const m = subj.serialNumber.match(/\d{8,10}/);
      if (m) rnokpp = m[0];
    }

    const serialHex = cert.serial ? cert.serial.toString('hex').toUpperCase() : '';
    const validFrom = cert.valid && cert.valid.from ? new Date(cert.valid.from) : null;
    const validTo = cert.valid && cert.valid.to ? new Date(cert.valid.to) : null;

    return {
      commonName: subj.commonName || subj.organizationName || `${subj.surname || ''} ${subj.givenName || ''}`.trim() || 'Власник сертифіката',
      rnokpp,
      issuerName: issuer.commonName || issuer.organizationName || 'КНЕДП',
      serialHex,
      validFrom,
      validTo,
    };
  }

  /**
   * Encrypts plaintext buffer for a recipient certificate using sender private key and DSTU/GOST.
   */
  encryptData(senderPriv, senderCert, recipientCert, dataBuffer, options = {}) {
    if (!Buffer.isBuffer(dataBuffer)) {
      dataBuffer = Buffer.from(dataBuffer);
    }

    const msg = new jk.models.Message({
      type: 'envelopedData',
      cert: senderCert,
      toCert: recipientCert,
      data: dataBuffer,
      crypter: senderPriv,
      algo: this.algo,
    });

    if (options.raw) {
      // Pure ASN.1 DER CMS EnvelopedData (.p7e)
      return {
        buffer: msg.as_asn1(),
        format: 'CMS EnvelopedData (.p7e)',
        senderInfo: this.extractCertInfo(senderCert),
        recipientInfo: this.extractCertInfo(recipientCert),
      };
    }

    // Official Ukrainian Transport container (UA1_CRYPT + CERTCRYPT)
    // Bundles sender public certificate so recipient never fails lookup!
    const transportBuffer = msg.as_transport({}, true);

    return {
      buffer: transportBuffer,
      format: 'ETSI / UA1_CRYPT (.enc)',
      senderInfo: this.extractCertInfo(senderCert),
      recipientInfo: this.extractCertInfo(recipientCert),
    };
  }

  /**
   * Decrypts encrypted buffer using recipient private key.
   */
  decryptData(recipientPriv, recipientCert, encryptedBuffer, options = {}) {
    let senderCert = null;
    let decryptedBuffer = null;

    // Check if buffer is UA Transport container (starts with TRANSPORTABLE or has UA1_CRYPT)
    const isTransport = encryptedBuffer.slice(0, 13).toString('ascii').startsWith('TRANSPORTABLE') ||
                        encryptedBuffer.includes(Buffer.from('UA1_CRYPT')) ||
                        encryptedBuffer.includes(Buffer.from('CERTCRYPT'));

    if (isTransport) {
      try {
        const tr = jk.transport.decode(encryptedBuffer);
        const certDoc = tr.docs.find((d) => d.type === 'CERTCRYPT');
        const cryptDoc = tr.docs.find((d) => d.type === 'UA1_CRYPT');

        if (!cryptDoc) {
          throw new Error('У транспортному контейнері не знайдено зашифрованих даних (UA1_CRYPT).');
        }

        if (certDoc) {
          senderCert = jk.Certificate.from_asn1(certDoc.contents);
        } else if (options.senderCert) {
          senderCert = options.senderCert;
        } else {
          senderCert = recipientCert; // fallback to self
        }

        const msg = new jk.models.Message(cryptDoc.contents);
        decryptedBuffer = msg.decrypt(recipientPriv, this.algo, () => senderCert);
      } catch (err) {
        throw new Error(`Помилка розшифрування транспортного контейнера: ${err.message}`);
      }
    } else {
      // Raw ASN.1 DER CMS EnvelopedData
      try {
        const msg = new jk.models.Message(encryptedBuffer);
        senderCert = options.senderCert || recipientCert;
        decryptedBuffer = msg.decrypt(recipientPriv, this.algo, () => senderCert);
      } catch (err) {
        throw new Error(`Помилка розшифрування EnvelopedData: ${err.message}`);
      }
    }

    return {
      plaintext: decryptedBuffer,
      senderInfo: this.extractCertInfo(senderCert),
      recipientInfo: this.extractCertInfo(recipientCert),
    };
  }

  /**
   * High-level: Encrypts a file or entire folder into an encrypted vault container.
   */
  async encryptFile(box, inputPath, options = {}) {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Шлях не знайдено: ${inputPath}`);
    }

    // 1. Resolve sender key and certificate
    const keyInfo = box.keys.find((k) => k.priv);
    if (!keyInfo || !keyInfo.priv) {
      throw new Error('У сховищі ключів відсутній приватний ключ для операції шифрування.');
    }
    const senderPriv = keyInfo.priv;
    const senderCert = keyInfo.cert || box.keys.find((k) => k.cert)?.cert;
    if (!senderCert) {
      throw new Error('Не знайдено сертифіката відкритого ключа для відправника.');
    }

    // 2. Resolve recipient certificate
    let recipientCert = senderCert; // Default: Personal Vault mode (self-encryption)
    if (options.recipientCertPath) {
      if (!fs.existsSync(options.recipientCertPath)) {
        throw new Error(`Сертифікат отримувача не знайдено: ${options.recipientCertPath}`);
      }
      const certBuf = fs.readFileSync(options.recipientCertPath);
      recipientCert = jk.Certificate.from_asn1(certBuf);
    }

    // 3. Read data (single file or entire folder)
    let dataBuffer;
    let isDirectory = false;
    const stat = fs.statSync(inputPath);

    if (stat.isDirectory()) {
      isDirectory = true;
      // Package directory into a clean ZIP archive
      const entries = [];
      const dirFiles = fs.readdirSync(inputPath).sort();
      for (const entry of dirFiles) {
        if (entry.startsWith('.')) continue; // ignore hidden
        const fullP = path.join(inputPath, entry);
        if (fs.statSync(fullP).isFile()) {
          entries.push({
            name: entry,
            data: fs.readFileSync(fullP),
            compress: true,
          });
        }
      }
      if (entries.length === 0) {
        throw new Error(`У папці '${inputPath}' немає файлів для шифрування.`);
      }
      dataBuffer = createZipArchive(entries);
    } else {
      dataBuffer = fs.readFileSync(inputPath);
    }

    // 4. Encrypt
    const encResult = this.encryptData(senderPriv, senderCert, recipientCert, dataBuffer, options);

    // 5. Determine output path
    let outputPath = options.outputPath;
    if (!outputPath) {
      const ext = options.raw ? '.p7e' : '.enc';
      outputPath = `${inputPath}${ext}`;
    }

    fs.writeFileSync(outputPath, encResult.buffer);

    return {
      outputPath,
      originalSize: dataBuffer.length,
      encryptedSize: encResult.buffer.length,
      isDirectory,
      format: encResult.format,
      senderInfo: encResult.senderInfo,
      recipientInfo: encResult.recipientInfo,
      isSelfEncrypted: recipientCert === senderCert,
    };
  }

  /**
   * High-level: Decrypts an encrypted container back into original file or folder.
   */
  async decryptFile(box, inputPath, options = {}) {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Файл не знайдено: ${inputPath}`);
    }

    // 1. Resolve recipient key & cert from box
    const keyInfo = box.keys.find((k) => k.priv);
    if (!keyInfo || !keyInfo.priv) {
      throw new Error('У сховищі відсутній приватний ключ для розшифрування.');
    }
    const recipientPriv = keyInfo.priv;
    const recipientCert = keyInfo.cert || box.keys.find((k) => k.cert)?.cert;

    // 2. Read encrypted container
    const encryptedBuffer = fs.readFileSync(inputPath);

    // 3. Decrypt
    const decResult = this.decryptData(recipientPriv, recipientCert, encryptedBuffer, options);

    // 4. Determine output path
    let outputPath = options.outputPath;
    if (!outputPath) {
      // Remove trailing .enc or .p7e if present
      if (inputPath.endsWith('.enc')) {
        outputPath = inputPath.slice(0, -4);
      } else if (inputPath.endsWith('.p7e')) {
        outputPath = inputPath.slice(0, -4);
      } else {
        outputPath = `${inputPath}.decrypted`;
      }
    }

    // Check if decrypted data is a ZIP archive
    const isZip = decResult.plaintext.length >= 4 &&
                  decResult.plaintext.readUInt32LE(0) === 0x04034b50;

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()) {
      outputPath = isZip ? `${outputPath}_decrypted.zip` : path.join(outputPath, 'decrypted_file');
    } else if (isZip && !outputPath.endsWith('.zip') && !path.extname(outputPath)) {
      outputPath = `${outputPath}.zip`;
    }

    fs.writeFileSync(outputPath, decResult.plaintext);

    return {
      outputPath,
      fileSize: decResult.plaintext.length,
      isZip,
      senderInfo: decResult.senderInfo,
      recipientInfo: decResult.recipientInfo,
    };
  }
}

module.exports = { CryptoVault };
