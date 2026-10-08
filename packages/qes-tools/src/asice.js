/**
 * asice.js — Associated Signature Container Extended (ETSI ASiC-E / TS 102 918 & EN 319 162).
 * Packages multiple files into an official European/Ukrainian ASiC-E container with CAdES signature.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { safeBoxSign } = require('./adapter');

/**
 * Standard MIME types lookup.
 */
const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.zip': 'application/zip',
  '.p7s': 'application/pkcs7-signature',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Computes standard CRC-32 checksum.
 */
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Creates standard PKZIP archive conforming to ETSI TS 102 918 (mimetype first & uncompressed).
 */
function createZipArchive(entries) {
  const localChunks = [];
  const cdChunks = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const dataBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const uncompressedSize = dataBuf.length;
    const crc = crc32(dataBuf);

    let method = entry.compress ? 8 : 0;
    let compressedData = dataBuf;
    if (entry.compress && uncompressedSize > 0) {
      compressedData = zlib.deflateRawSync(dataBuf);
    } else {
      method = 0;
    }
    const compressedSize = compressedData.length;

    // Local File Header (30 bytes)
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); // signature
    lh.writeUInt16LE(20, 4);         // version needed (2.0)
    lh.writeUInt16LE(0x0800, 6);     // general purpose bit flag (Bit 11: UTF-8 encoding)
    lh.writeUInt16LE(method, 8);     // compression method
    lh.writeUInt16LE(0, 10);         // mod time
    lh.writeUInt16LE(0, 12);         // mod date
    lh.writeUInt32LE(crc, 14);       // crc32
    lh.writeUInt32LE(compressedSize, 18);
    lh.writeUInt32LE(uncompressedSize, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);         // extra field len

    localChunks.push(lh, nameBuf, compressedData);

    // Central Directory Header (46 bytes)
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0); // signature
    cdh.writeUInt16LE(20, 4);         // version made by
    cdh.writeUInt16LE(20, 6);         // version needed
    cdh.writeUInt16LE(0x0800, 8);     // bit flag (Bit 11: UTF-8 encoding)
    cdh.writeUInt16LE(method, 10);    // compression method
    cdh.writeUInt16LE(0, 12);         // mod time
    cdh.writeUInt16LE(0, 14);         // mod date
    cdh.writeUInt32LE(crc, 16);       // crc32
    cdh.writeUInt32LE(compressedSize, 20);
    cdh.writeUInt32LE(uncompressedSize, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);         // extra field len
    cdh.writeUInt16LE(0, 32);         // comment len
    cdh.writeUInt16LE(0, 34);         // disk start
    cdh.writeUInt16LE(0, 36);         // internal attrs
    cdh.writeUInt32LE(0, 38);         // external attrs
    cdh.writeUInt32LE(offset, 42);    // offset of local header

    cdChunks.push(cdh, nameBuf);
    offset += lh.length + nameBuf.length + compressedData.length;
  }

  const cdBuf = Buffer.concat(cdChunks);
  const cdOffset = offset;
  const cdSize = cdBuf.length;

  // End of Central Directory (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);          // disk number
  eocd.writeUInt16LE(0, 6);          // start disk
  eocd.writeUInt16LE(entries.length, 8);  // entries on disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, cdBuf, eocd]);
}

/**
 * Parses a standard PKZIP archive buffer into entries array [{ name, data, compress }].
 */
function parseZipEntries(buf) {
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('Невалідний ZIP архів (EOCD не знайдено)');

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  const entries = [];
  let curr = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(curr) !== 0x02014b50) break;
    const method = buf.readUInt16LE(curr + 10);
    const compressedSize = buf.readUInt32LE(curr + 20);
    const nameLen = buf.readUInt16LE(curr + 28);
    const extraLen = buf.readUInt16LE(curr + 30);
    const commentLen = buf.readUInt16LE(curr + 32);
    const localHeaderOffset = buf.readUInt32LE(curr + 42);

    const name = buf.toString('utf8', curr + 46, curr + 46 + nameLen);

    const lhNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const lhExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + lhNameLen + lhExtraLen;
    const rawData = buf.subarray(dataOffset, dataOffset + compressedSize);

    let data;
    if (method === 8) {
      data = zlib.inflateRawSync(rawData);
    } else {
      data = rawData;
    }

    entries.push({
      name,
      data,
      compress: method === 8,
    });

    curr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * Builds ETSI ASiC-E Manifest XML (clause 5.2.2).
 */
function buildManifestXml(fileInfos) {
  let entriesXml = '';
  for (const info of fileInfos) {
    entriesXml += `    <asic:DataObjectReference URI="${info.name}" MimeType="${info.mime}">\n` +
      `      <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>\n` +
      `      <ds:DigestValue>${info.sha256Base64}</ds:DigestValue>\n` +
      `    </asic:DataObjectReference>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<asic:ASiCManifest xmlns:asic="http://uri.etsi.org/02918/v1.2.1#" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">\n` +
    `  <asic:SigReference URI="META-INF/signature.p7s" MimeType="application/pkcs7-signature"/>\n` +
    entriesXml +
    `</asic:ASiCManifest>\n`;
}

/**
 * Appends a secondary or subsequent signature to an existing ETSI ASiC-E container.
 */
async function appendAsiceSignature(box, asicePath, options = {}) {
  if (!fs.existsSync(asicePath)) {
    throw new Error(`Файл ASiC-E не знайдено: ${asicePath}`);
  }

  const asiceBuf = fs.readFileSync(asicePath);
  const entries = parseZipEntries(asiceBuf);

  // Check manifest
  const manifestEntry = entries.find((e) => e.name === 'META-INF/manifest.xml');
  if (!manifestEntry) {
    throw new Error('У контейнері ASiC-E не знайдено META-INF/manifest.xml.');
  }

  // Count existing signatures
  const existingSigs = entries.filter((e) => e.name.startsWith('META-INF/signature') && (e.name.endsWith('.p7s') || e.name.endsWith('.p7b')));
  const nextSigIndex = existingSigs.length + 1;
  const nextSigName = `META-INF/signature-${nextSigIndex}.p7s`;

  // Sign manifest with box.sign
  const signOpts = {
    detached: true,
    tsp: options.tsp !== false ? 'all' : false,
    includeChain: true,
    time: options.time ? Math.floor(new Date(options.time).getTime() / 1000) : undefined,
  };

  const message = await safeBoxSign(box, manifestEntry.data, null, null, signOpts);
  const sigDer = Buffer.from(message.as_asn1());

  entries.push({
    name: nextSigName,
    data: sigDer,
    compress: true,
  });

  const updatedAsiceBuffer = createZipArchive(entries);

  let outputPath = options.outputPath;
  if (!outputPath) {
    const parsed = path.parse(asicePath);
    if (parsed.name.endsWith('_signed')) {
      outputPath = path.join(parsed.dir, `${parsed.name}_multisigned.asice`);
    } else {
      outputPath = asicePath; // In-place update or append
    }
  }

  fs.writeFileSync(outputPath, updatedAsiceBuffer);

  const signedFiles = entries
    .filter((e) => !e.name.startsWith('META-INF/') && e.name !== 'mimetype')
    .map((e) => e.name);

  return {
    outputPath,
    containerSize: updatedAsiceBuffer.length,
    signedFiles,
    fileCount: signedFiles.length,
    sigCount: nextSigIndex,
    sigName: nextSigName,
    isMultiSignature: true,
  };
}

/**
 * Signs multiple files into an ETSI ASiC-E container (.asice).
 */
async function createAsiceContainer(box, filePaths, options = {}) {
  if (!filePaths || filePaths.length === 0) {
    throw new Error('Не вказано файлів для створення ASiC-E контейнера.');
  }

  // If a single .asice file is provided, append signature
  if (filePaths.length === 1 && filePaths[0].toLowerCase().endsWith('.asice')) {
    return appendAsiceSignature(box, filePaths[0], options);
  }

  // 1. Read files and compute digests
  const fileInfos = [];
  const zipEntries = [];

  // MUST be first entry: mimetype (uncompressed)
  zipEntries.push({
    name: 'mimetype',
    data: Buffer.from('application/vnd.etsi.asic-e+zip', 'utf8'),
    compress: false,
  });

  for (const fp of filePaths) {
    if (!fs.existsSync(fp)) {
      throw new Error(`Файл не знайдено: ${fp}`);
    }
    const data = fs.readFileSync(fp);
    const basename = path.basename(fp);
    const mime = getMimeType(fp);
    const sha256Base64 = crypto.createHash('sha256').update(data).digest('base64');

    fileInfos.push({
      name: basename,
      mime,
      sha256Base64,
      size: data.length,
    });

    zipEntries.push({
      name: basename,
      data,
      compress: true,
    });
  }

  // 2. Generate META-INF/manifest.xml
  const manifestXml = buildManifestXml(fileInfos);
  const manifestBuffer = Buffer.from(manifestXml, 'utf8');

  zipEntries.push({
    name: 'META-INF/manifest.xml',
    data: manifestBuffer,
    compress: true,
  });

  // 3. Sign manifest with CAdES (box.sign)
  const signOpts = {
    detached: true,
    tsp: options.tsp !== false ? 'all' : false,
    includeChain: true,
    time: options.time ? Math.floor(new Date(options.time).getTime() / 1000) : undefined,
  };

  const message = await safeBoxSign(box, manifestBuffer, null, null, signOpts);
  const sigDer = Buffer.from(message.as_asn1());

  zipEntries.push({
    name: 'META-INF/signature.p7s',
    data: sigDer,
    compress: true,
  });

  // 4. Build ZIP buffer
  const asiceBuffer = createZipArchive(zipEntries);

  // 5. Output path resolution
  let outputPath = options.outputPath;
  if (!outputPath) {
    if (filePaths.length === 1) {
      const parsed = path.parse(filePaths[0]);
      outputPath = path.join(parsed.dir, `${parsed.name}.asice`);
    } else {
      outputPath = path.resolve('package.asice');
    }
  }

  fs.writeFileSync(outputPath, asiceBuffer);

  return {
    outputPath,
    containerSize: asiceBuffer.length,
    signedFiles: fileInfos.map((f) => f.name),
    fileCount: fileInfos.length,
    isMultiSignature: false,
    sigCount: 1,
  };
}

module.exports = {
  createAsiceContainer,
  appendAsiceSignature,
  parseZipEntries,
  createZipArchive,
  buildManifestXml,
  getMimeType,
};
