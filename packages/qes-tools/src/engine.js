/**
 * engine.js — High-level QES signing engine using jkurwa & dstucrypt.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const jk = require('jkurwa');
const { queryAdapter, getAlgos, safeBoxSign } = require('./adapter');

class QESEngine {
  constructor(options = {}) {
    this.algo = getAlgos();
    this.casBuffer = options.casBuffer || null;
    this.cmpUrl = options.cmpUrl || 'http://ca.monobank.ua/services/cmp/';
  }

  /**
   * Decrypts PKCS#12 container and initializes jkurwa Box.
   */
  async initBox(pfxPath, password, certPath = null) {
    if (!fs.existsSync(pfxPath)) {
      throw new Error(`Файл ключа не знайдено: ${pfxPath}`);
    }

    const pfxBuffer = fs.readFileSync(pfxPath);
    const box = new jk.Box({
      algo: this.algo,
      query: queryAdapter,
      casBuffer: this.casBuffer,
    });

    // Attempt decryption
    let store;
    try {
      store = jk.Priv.from_protected(pfxBuffer, password, this.algo);
    } catch (err) {
      throw new Error('Невірний пароль до ключа або пошкоджений файл контейнера.');
    }

    if (!store || !store.keys || store.keys.length === 0) {
      throw new Error('У контейнері не знайдено приватних ключів.');
    }

    // Add keys to box
    store.keys.forEach((priv) => box.add({ priv }, this.algo));
    box._indexKeys();

    // Handle public certificate
    let certFound = false;

    // 1. Check if store contained certificates
    if (store.certs && store.certs.length > 0) {
      store.certs.forEach((cert) => {
        box.add({ cert: jk.Certificate.from_asn1(cert) }, this.algo);
      });
      certFound = true;
    }

    // 2. Check explicit certPath
    if (!certFound && certPath && fs.existsSync(certPath)) {
      const cBuf = fs.readFileSync(certPath);
      box.add({ cert: jk.Certificate.from_asn1(cBuf) }, this.algo);
      certFound = true;
    }

    // 3. Check adjacent .cer / .crt files in key directory
    if (!certFound) {
      const parsedPath = path.parse(pfxPath);
      const candidates = [
        path.join(parsedPath.dir, `${parsedPath.name}.cer`),
        path.join(parsedPath.dir, `${parsedPath.name}.crt`),
      ];
      try {
        const dirFiles = fs.readdirSync(parsedPath.dir);
        for (const f of dirFiles) {
          if (f.endsWith('.cer') || f.endsWith('.crt')) {
            candidates.push(path.join(parsedPath.dir, f));
          }
        }
      } catch (_) {}

      for (const cand of [...new Set(candidates)]) {
        if (fs.existsSync(cand)) {
          try {
            const cBuf = fs.readFileSync(cand);
            box.add({ cert: jk.Certificate.from_asn1(cBuf) }, this.algo);
            console.log(`  [Cert] Завантажено локальний сертифікат: ${path.basename(cand)}`);
            certFound = true;
          } catch (e) {
            // Ignore if invalid
          }
        }
      }
    }

    // 4. Try fetching via CMP if not found offline
    if (!certFound) {
      const cmpUrls = [
        ...new Set([
          this.cmpUrl,
          'http://ca.monobank.ua/services/cmp/',
          'http://zc.bank.gov.ua/services/cmp/',
        ].filter(Boolean))
      ];
      for (const url of cmpUrls) {
        try {
          console.log(`  [CMP] Запит сертифіката до ${url}...`);
          const added = await box.loadCertsCmp(url);
          console.log(`  [CMP] Отримано сертифікатів: ${added}`);
          if (added > 0) {
            certFound = true;
            // Cache the cert for offline operations
            const parsedPath = path.parse(pfxPath);
            const cachePath = path.join(parsedPath.dir, `${parsedPath.name}.cer`);
            const keyInfo = box.keys.find((k) => k.cert);
            if (keyInfo && keyInfo.cert && !fs.existsSync(cachePath)) {
              fs.writeFileSync(cachePath, keyInfo.cert.as_asn1());
              console.log(`  [CMP] Сертифікат збережено локально: ${cachePath}`);
            }
            break;
          }
        } catch (cmpErr) {
          console.log(`  [CMP] Помилка від ${url}:`, cmpErr.reason || cmpErr.message || cmpErr);
        }
      }
    }

    box._indexKeys();
    return { box, hasCert: certFound };
  }

  /**
   * Appends a secondary signature to an existing PKCS#7 / CAdES (.p7s) container.
   */
  async appendCadesSignature(box, p7sPath, options = {}) {
    if (!fs.existsSync(p7sPath)) {
      throw new Error(`Файл підпису не знайдено: ${p7sPath}`);
    }

    const p7sBuf = fs.readFileSync(p7sPath);
    const ContentInfo = jk.dstszi2010.ContentInfo;
    let existingParsed;
    try {
      existingParsed = ContentInfo.decode(p7sBuf, 'der');
    } catch (e) {
      throw new Error(`Не вдалося декодувати файл підпису ${p7sPath}: ${e.message}`);
    }

    if (existingParsed.contentType !== 'signedData') {
      throw new Error('Файл не містить SignedData PKCS#7 / CAdES контейнера.');
    }

    let dataBuffer = null;
    if (existingParsed.content.contentInfo && existingParsed.content.contentInfo.content) {
      dataBuffer = existingParsed.content.contentInfo.content;
    } else {
      // Detached signature: check dataPath or adjacent document
      const candidatePaths = [
        options.dataPath,
        p7sPath.replace(/\.p7s$/i, ''),
        p7sPath.replace(/\.p7b$/i, ''),
      ].filter(Boolean);

      for (const cp of candidatePaths) {
        if (fs.existsSync(cp) && fs.statSync(cp).isFile()) {
          dataBuffer = fs.readFileSync(cp);
          break;
        }
      }

      if (!dataBuffer) {
        throw new Error(
          `Для додавання підпису до відокремленого контейнера ${path.basename(p7sPath)} необхідно вказати оригінальний файл документа.`
        );
      }
    }

    const signOpts = {
      detached: !existingParsed.content.contentInfo?.content,
      tsp: options.tsp !== false ? 'all' : false,
      includeChain: true,
      time: options.time ? Math.floor(new Date(options.time).getTime() / 1000) : undefined,
    };

    const newMsg = await safeBoxSign(box, dataBuffer, null, signOpts);
    const newDer = Buffer.from(newMsg.as_asn1());
    const newParsed = ContentInfo.decode(newDer, 'der');

    // Helper to get certificate serial for deduplication
    const getCertSerial = (c) => {
      if (c && c.tbsCertificate && c.tbsCertificate.serialNumber) {
        return c.tbsCertificate.serialNumber.toString(16).toLowerCase();
      }
      if (c && c.serial) {
        return c.serial.toString('hex').toLowerCase();
      }
      return null;
    };

    // Merge certificates (deduplicating by serial number)
    const mergedCertificates = [...(existingParsed.content.certificate || [])];
    for (const c of (newParsed.content.certificate || [])) {
      const serial = getCertSerial(c);
      if (!serial || !mergedCertificates.some((ex) => getCertSerial(ex) === serial)) {
        mergedCertificates.push(c);
      }
    }

    const mergedSigners = [
      ...existingParsed.content.signerInfos,
      ...newParsed.content.signerInfos,
    ];

    const merged = {
      contentType: 'signedData',
      content: {
        ...existingParsed.content,
        certificate: mergedCertificates,
        signerInfos: mergedSigners,
      },
    };

    const mergedDer = Buffer.from(ContentInfo.encode(merged, 'der'));
    const outputPath = options.outputPath || p7sPath;
    fs.writeFileSync(outputPath, mergedDer);

    return {
      outputPath,
      signatureBytes: mergedDer.length,
      detached: signOpts.detached,
      isMultiSignature: true,
      sigCount: mergedSigners.length,
    };
  }

  /**
   * Signs a document buffer or file.
   */
  async signDocument(box, filePath, options = {}) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Файл для підписання не знайдено: ${filePath}`);
    }

    if (filePath.toLowerCase().endsWith('.p7s') || options.append) {
      return this.appendCadesSignature(box, filePath, options);
    }

    const docBuffer = fs.readFileSync(filePath);
    const signOpts = {
      detached: options.detached !== false,
      tsp: options.tsp !== false ? 'all' : false,
      includeChain: true,
      time: options.time ? Math.floor(new Date(options.time).getTime() / 1000) : undefined,
    };

    const message = await safeBoxSign(box, docBuffer, null, null, signOpts);
    const sigDer = message.as_asn1();

    const outputPath = options.outputPath || `${filePath}.p7s`;
    fs.writeFileSync(outputPath, sigDer);

    return {
      outputPath,
      signatureBytes: sigDer.length,
      detached: signOpts.detached,
      isMultiSignature: false,
      sigCount: 1,
    };
  }

  /**
   * Signs a PDF document with embedded PAdES signature and visual stamp.
   */
  async signPdfPAdES(box, filePath, options = {}) {
    const { signPdfPAdES } = require('./pades');
    return signPdfPAdES(box, filePath, options);
  }

  /**
   * Signs one or more files into an ETSI ASiC-E container (.asice).
   */
  async signAsice(box, filePaths, options = {}) {
    const { createAsiceContainer } = require('./asice');
    return createAsiceContainer(box, filePaths, options);
  }

  /**
   * Encrypts a file or folder into an encrypted vault container (ГОСТ 28147:89 / ДСТУ 4145).
   */
  async encryptFile(box, inputPath, options = {}) {
    const { CryptoVault } = require('./vault');
    const vault = new CryptoVault({ algo: this.algo });
    return vault.encryptFile(box, inputPath, options);
  }

  /**
   * Decrypts an encrypted vault container back into original content.
   */
  async decryptFile(box, inputPath, options = {}) {
    const { CryptoVault } = require('./vault');
    const vault = new CryptoVault({ algo: this.algo });
    return vault.decryptFile(box, inputPath, options);
  }
}

module.exports = { QESEngine };
