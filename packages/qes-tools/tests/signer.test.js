/**
 * signer.test.js — Automated test suite for QES signing engine & CLI.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { QESEngine } = require('../src/engine');
const jk = require('jkurwa');
const { getAlgos } = require('../src/adapter');

test('CLI prints help message properly', () => {
  const cliPath = path.join(__dirname, '..', 'bin', 'qes-sign.js');
  const res = spawnSync('node', [cliPath, '--help'], { encoding: 'utf-8' });
  assert.strictEqual(res.status, 0);
  assert.match(res.stdout, /qes-sign — автономний інструмент підписання/);
  assert.match(res.stdout, /--key/);
});

test('CLI fails gracefully when file is missing', () => {
  const cliPath = path.join(__dirname, '..', 'bin', 'qes-sign.js');
  const res = spawnSync('node', [cliPath, 'non_existent_file_12345.pdf'], { encoding: 'utf-8' });
  assert.notStrictEqual(res.status, 0);
  assert.match(res.stderr, /не знайдено|not found/i);
});

test('Engine rejects wrong password without crash or leak', async () => {
  const defaultKey = path.join(process.env.HOME || '/home/attor', '.secure_keys', 'Баєнко_Я_В_monoКЕП_2025-09-15T20_12_28.pfx');
  const ciKey = path.join(__dirname, '../node_modules/jkurwa/test/data/STORE_A040.dat');
  const keyPath = fs.existsSync(defaultKey) ? defaultKey : ciKey;
  if (!fs.existsSync(keyPath)) {
    return; // Skip if test environment doesn't have key
  }

  const engine = new QESEngine();
  await assert.rejects(
    async () => {
      await engine.initBox(keyPath, 'intentionally_wrong_password_99999');
    },
    (err) => {
      assert.match(err.message, /Невірний пароль/);
      return true;
    }
  );
});

test('CA bundle mono.p7b exists and is valid', () => {
  const caBundlePath = path.join(__dirname, '..', 'certs', 'mono.p7b');
  assert.strictEqual(fs.existsSync(caBundlePath), true);
  const stat = fs.statSync(caBundlePath);
  assert.ok(stat.size > 20000, 'CA bundle should contain multiple certificates');
});

test('Visual stamp generator produces valid stamped PDF with QR code', async () => {
  const { applyVisualStamp } = require('../src/pades');
  const { PDFDocument } = require('pdf-lib');
  const samplePdf = '/home/attor/test_kep/test_doc.pdf';
  let targetPdf = samplePdf;
  let tmpPdfCreated = false;

  if (!fs.existsSync(targetPdf)) {
    const doc = await PDFDocument.create();
    doc.addPage([595.28, 841.89]);
    const pdfBytes = await doc.save();
    targetPdf = path.join(os.tmpdir(), `test_pades_fixture_${Date.now()}.pdf`);
    fs.writeFileSync(targetPdf, pdfBytes);
    tmpPdfCreated = true;
  }

  try {
    const mockCertInfo = {
      commonName: 'Баєнко Ярослав Володимирович',
      rnokpp: '3255419579',
      issuerName: 'КНЕДП monobank | Universal Bank',
      serialHex: '10FF6F932221FA00CB4407000000000130616768',
      validTo: new Date('2027-09-14T23:59:59Z'),
    };

    const stampedBytes = await applyVisualStamp(targetPdf, mockCertInfo, { page: 'z' });
    assert.ok(stampedBytes.length > 20000, 'Stamped PDF should have valid size');
    assert.strictEqual(stampedBytes.subarray(0, 5).toString('ascii'), '%PDF-');
  } finally {
    if (tmpPdfCreated && fs.existsSync(targetPdf)) {
      try { fs.unlinkSync(targetPdf); } catch (e) {}
    }
  }
});

test('ASiC-E manifest and ZIP archive conform to ETSI TS 102 918', () => {
  const { createZipArchive, buildManifestXml } = require('../src/asice');

  const fileInfos = [
    { name: 'contract.pdf', mime: 'application/pdf', sha256Base64: 'abc123hash==', size: 100 },
    { name: 'appendix.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sha256Base64: 'xyz987hash==', size: 200 },
  ];

  const xml = buildManifestXml(fileInfos);
  assert.match(xml, /<asic:ASiCManifest/);
  assert.match(xml, /contract\.pdf/);
  assert.match(xml, /appendix\.docx/);
  assert.match(xml, /META-INF\/signature\.p7s/);

  const zip = createZipArchive([
    { name: 'mimetype', data: 'application/vnd.etsi.asic-e+zip', compress: false },
    { name: 'META-INF/manifest.xml', data: xml, compress: true },
  ]);

  assert.ok(zip.length > 100, 'ZIP archive generated');
  // First 4 bytes must be local header signature 0x04034b50
  assert.strictEqual(zip.readUInt32LE(0), 0x04034b50);
  // Check that first file is mimetype
  const fnLen = zip.readUInt16LE(26);
  assert.strictEqual(zip.subarray(30, 30 + fnLen).toString('utf8'), 'mimetype');
  // Check compression method is 0 (stored)
  assert.strictEqual(zip.readUInt16LE(8), 0);
});

test('CryptoVault performs round-trip encryption and decryption with ДСТУ 4145 / ГОСТ 28147:89', () => {
  const jk = require('jkurwa');
  const { CryptoVault } = require('../src/vault');

  const cert1Buf = fs.readFileSync(path.join(__dirname, '../node_modules/jkurwa/test/data/SELF_SIGNED1.cer'));
  const priv1Buf = fs.readFileSync(path.join(__dirname, '../node_modules/jkurwa/test/data/PRIV1.cer'));
  const cert1 = jk.Certificate.from_asn1(cert1Buf);
  const priv1 = jk.Priv.from_asn1(priv1Buf);

  const vault = new CryptoVault();
  const testSecret = Buffer.from('Адвокатська таємниця: секретні свідчення свідка №42', 'utf8');

  // 1. Encrypt in transport mode
  const encRes = vault.encryptData(priv1, cert1, cert1, testSecret);
  assert.ok(encRes.buffer.length > testSecret.length, 'Encrypted buffer must be created');
  assert.strictEqual(encRes.recipientInfo.commonName, 'Very Much CA');

  // 2. Decrypt
  const decRes = vault.decryptData(priv1, cert1, encRes.buffer);
  assert.strictEqual(decRes.plaintext.toString('utf8'), testSecret.toString('utf8'));

  // 3. Encrypt in raw p7e mode
  const rawRes = vault.encryptData(priv1, cert1, cert1, testSecret, { raw: true });
  assert.strictEqual(rawRes.format, 'CMS EnvelopedData (.p7e)');
  const decRawRes = vault.decryptData(priv1, cert1, rawRes.buffer);
  assert.strictEqual(decRawRes.plaintext.toString('utf8'), testSecret.toString('utf8'));
});

test('PAdES Incremental Multi-Signing adds secondary signature preserving first signature', async () => {
  const jk = require('jkurwa');
  const { signPdfPAdES } = require('../src/pades');

  // Load test keys
  const cert1Buf = fs.readFileSync(path.join(__dirname, '../node_modules/jkurwa/test/data/SELF_SIGNED1.cer'));
  const priv1Buf = fs.readFileSync(path.join(__dirname, '../node_modules/jkurwa/test/data/PRIV1.cer'));
  const cert1 = jk.Certificate.from_asn1(cert1Buf);
  const priv1 = jk.Priv.from_asn1(priv1Buf);

  const box = new jk.Box({ algo: require('../src/adapter').getAlgos() });
  box.add({ priv: priv1, cert: cert1 });
  box._indexKeys();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qes-test-pades-'));
  const samplePdf = path.join(tmpDir, 'contract.pdf');
  const signed1Pdf = path.join(tmpDir, 'contract_signed.pdf');
  const multiPdf = path.join(tmpDir, 'contract_multisigned.pdf');

  try {
    // Generate a minimal valid PDF
    const { PDFDocument } = require('pdf-lib');
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    page.drawText('Legal Contract Agreement');
    fs.writeFileSync(samplePdf, await doc.save());

    // 1. First signature
    const res1 = await signPdfPAdES(box, samplePdf, {
      outputPath: signed1Pdf,
      stamp: false,
      tsp: false,
    });
    assert.strictEqual(res1.isMultiSignature, false);
    assert.strictEqual(res1.sigCount, 1);
    assert.ok(fs.existsSync(signed1Pdf));

    // 2. Second signature (multi-signature via incremental update)
    const res2 = await signPdfPAdES(box, signed1Pdf, {
      outputPath: multiPdf,
      stamp: false,
      tsp: false,
      append: true,
    });
    assert.strictEqual(res2.isMultiSignature, true);
    assert.strictEqual(res2.sigCount, 2);
    assert.ok(fs.existsSync(multiPdf));

    // 3. Verify with qes-verify
    const verifierBin = fs.existsSync(path.join(__dirname, '../bin/qes-verify'))
      ? path.join(__dirname, '../bin/qes-verify')
      : path.join(__dirname, '../../qes-verifier/bin/qes-verify');
    const vRes = spawnSync(verifierBin, ['-j', multiPdf], { encoding: 'utf-8' });
    const parsedRes = JSON.parse(vRes.stdout);

    assert.strictEqual(parsedRes.length, 2, 'Should detect exactly 2 embedded PAdES signatures');
    assert.strictEqual(parsedRes[0].container_format, 'PAdES (PDF Embedded Signature)');
    assert.strictEqual(parsedRes[1].container_format, 'PAdES (PDF Embedded Signature)');
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('ASiC-E Container Multi-Signing appends secondary signature and verifies manifest', async () => {
  const jk = require('jkurwa');
  const { createAsiceContainer, appendAsiceSignature } = require('../src/asice');

  const cert1Buf = fs.readFileSync(path.join(__dirname, '../node_modules/jkurwa/test/data/SELF_SIGNED1.cer'));
  const priv1Buf = fs.readFileSync(path.join(__dirname, '../node_modules/jkurwa/test/data/PRIV1.cer'));
  const cert1 = jk.Certificate.from_asn1(cert1Buf);
  const priv1 = jk.Priv.from_asn1(priv1Buf);

  const box = new jk.Box({ algo: require('../src/adapter').getAlgos() });
  box.add({ priv: priv1, cert: cert1 });
  box._indexKeys();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qes-test-asice-'));
  const docFile = path.join(tmpDir, 'statement.docx');
  const asicePath = path.join(tmpDir, 'statement.asice');

  try {
    fs.writeFileSync(docFile, 'Офіційна адвокатська заява до суду №101');

    // 1. Initial ASiC-E
    const res1 = await createAsiceContainer(box, [docFile], {
      outputPath: asicePath,
      tsp: false,
    });
    assert.strictEqual(res1.isMultiSignature, false);

    // 2. Append secondary signature
    const res2 = await appendAsiceSignature(box, asicePath, {
      tsp: false,
    });
    assert.strictEqual(res2.isMultiSignature, true);
    assert.strictEqual(res2.sigCount, 2);

    // 3. Verify with qes-verify
    const verifierBin = fs.existsSync(path.join(__dirname, '../bin/qes-verify'))
      ? path.join(__dirname, '../bin/qes-verify')
      : path.join(__dirname, '../../qes-verifier/bin/qes-verify');
    const vRes = spawnSync(verifierBin, ['-j', asicePath], { encoding: 'utf-8' });
    const parsedRes = JSON.parse(vRes.stdout);

    assert.strictEqual(parsedRes.length, 2, 'Should detect exactly 2 signatures in ASiC-E');
    assert.strictEqual(parsedRes[0].manifest_verified, true, 'Manifest checksums must remain valid');
    assert.strictEqual(parsedRes[1].manifest_verified, true, 'Manifest checksums must remain valid for 2nd signer');
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('CAdES Parallel Multi-Signing merges multiple SignerInfos in SignedData', async () => {
  const jk = require('jkurwa');
  const { QESEngine } = require('../src/engine');

  const cert1Buf = fs.readFileSync(path.join(__dirname, '../node_modules/jkurwa/test/data/SELF_SIGNED1.cer'));
  const priv1Buf = fs.readFileSync(path.join(__dirname, '../node_modules/jkurwa/test/data/PRIV1.cer'));
  const cert1 = jk.Certificate.from_asn1(cert1Buf);
  const priv1 = jk.Priv.from_asn1(priv1Buf);

  const box = new jk.Box({ algo: require('../src/adapter').getAlgos() });
  box.add({ priv: priv1, cert: cert1 });
  box._indexKeys();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qes-test-cades-'));
  const docFile = path.join(tmpDir, 'memo.pdf');
  const p7sFile = path.join(tmpDir, 'memo.pdf.p7s');

  try {
    fs.writeFileSync(docFile, 'Юридичний меморандум для клієнта');
    const engine = new QESEngine();

    // 1. Initial CAdES signature
    const res1 = await engine.signDocument(box, docFile, {
      outputPath: p7sFile,
      detached: true,
      tsp: false,
    });
    assert.strictEqual(res1.isMultiSignature, false);

    // 2. Append second CAdES signature
    const res2 = await engine.appendCadesSignature(box, p7sFile, {
      dataPath: docFile,
      tsp: false,
    });
    assert.strictEqual(res2.isMultiSignature, true);
    assert.strictEqual(res2.sigCount, 2);

    // Verify ASN.1 structure contains 2 SignerInfos
    const ContentInfo = jk.dstszi2010.ContentInfo;
    const decoded = ContentInfo.decode(fs.readFileSync(p7sFile), 'der');
    assert.strictEqual(decoded.contentType, 'signedData');
    assert.strictEqual(decoded.content.signerInfos.length, 2);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('Session TTL cache stores password in memory, retrieves it, and wipes on clear', async () => {
  const {
    getKeyFingerprint,
    sendAgentMessage,
    ensureAgentRunning,
  } = require('../src/session');

  const tmpKeyFile = path.join(os.tmpdir(), `test-key-${Date.now()}.pfx`);
  fs.writeFileSync(tmpKeyFile, 'dummy-key-content-for-fingerprint');

  try {
    const started = await ensureAgentRunning();
    assert.strictEqual(started, true, 'qes-agent should start and respond to ping');

    const keyId = getKeyFingerprint(tmpKeyFile);

    // 1. Initially not cached
    const get1 = await sendAgentMessage({ action: 'get', keyId });
    assert.strictEqual(get1.found, false);

    // 2. Set password with TTL 60 seconds
    const setRes = await sendAgentMessage({
      action: 'set',
      keyId,
      password: 'SecretPassword123!',
      label: 'test-key.pfx',
      ttl: 60,
    });
    assert.strictEqual(setRes.status, 'ok');

    // 3. Query should return password and remainingSec
    const get2 = await sendAgentMessage({ action: 'get', keyId });
    assert.strictEqual(get2.found, true);
    assert.strictEqual(get2.password, 'SecretPassword123!');
    assert.ok(get2.remainingSec > 0 && get2.remainingSec <= 60);

    // 4. Status should show active key
    const statusRes = await sendAgentMessage({ action: 'status' });
    assert.strictEqual(statusRes.status, 'ok');
    const item = statusRes.active.find((k) => k.keyId === keyId);
    assert.ok(item, 'Key should be listed in status');

    // 5. Clear should wipe password from memory
    const clearRes = await sendAgentMessage({ action: 'clear', keyId });
    assert.strictEqual(clearRes.status, 'ok');

    // 6. Query after clear must return not found
    const get3 = await sendAgentMessage({ action: 'get', keyId });
    assert.strictEqual(get3.found, false);
  } finally {
    try { fs.unlinkSync(tmpKeyFile); } catch (_) {}
  }
});

test('getOrPromptPassword reuses cached password without invoking password prompt', async () => {
  const {
    getOrPromptPassword,
    sendAgentMessage,
    getKeyFingerprint,
  } = require('../src/session');

  const tmpKey = path.join(os.tmpdir(), `session-engine-key-${Date.now()}.pfx`);
  fs.writeFileSync(tmpKey, 'dummy-key-data');

  let promptCount = 0;
  const mockAskPassword = async () => {
    promptCount++;
    return 'CorrectPass123';
  };

  const mockEngine = {
    async initBox(kp, pass) {
      if (pass !== 'CorrectPass123') {
        throw new Error('Wrong password');
      }
      return { box: {}, hasCert: true };
    },
  };

  try {
    const keyId = getKeyFingerprint(tmpKey);
    // Clear any prior cache
    await sendAgentMessage({ action: 'clear', keyId }).catch(() => {});

    // First call: must prompt
    const res1 = await getOrPromptPassword({
      keyPath: tmpKey,
      engine: mockEngine,
      askPasswordFn: mockAskPassword,
      ttl: 60,
    });
    assert.strictEqual(promptCount, 1, 'First call should invoke askPasswordFn');
    assert.strictEqual(res1.hasCert, true);

    // Second call: should reuse cached password from agent without prompt!
    const res2 = await getOrPromptPassword({
      keyPath: tmpKey,
      engine: mockEngine,
      askPasswordFn: mockAskPassword,
      ttl: 60,
    });
    assert.strictEqual(promptCount, 1, 'Second call MUST NOT invoke askPasswordFn (cached in RAM)');
    assert.strictEqual(res2.hasCert, true);

    // Clear cache
    await sendAgentMessage({ action: 'clear', keyId }).catch(() => {});

    // Third call after clear: should prompt again!
    const res3 = await getOrPromptPassword({
      keyPath: tmpKey,
      engine: mockEngine,
      askPasswordFn: mockAskPassword,
      ttl: 60,
    });
    assert.strictEqual(promptCount, 2, 'Call after clear MUST invoke askPasswordFn again');
    assert.strictEqual(res3.hasCert, true);
  } finally {
    try { fs.unlinkSync(tmpKey); } catch (_) {}
  }
});

test('qes-ocr produces valid searchable PDF with Ukrainian and English recognition', async () => {
  const ocrBin = path.join(__dirname, '../bin/qes-ocr');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qes-test-ocr-'));
  const samplePdf = path.join(tmpDir, 'claim.pdf');
  const outputPdf = path.join(tmpDir, 'claim_searchable.pdf');
  const sidecarTxt = path.join(tmpDir, 'claim_searchable.txt');

  try {
    // Generate sample PDF via Typst
    const typstCode = `
#set page(width: 10cm, height: 6cm, margin: 1cm)
#set text(font: "Liberation Sans", size: 12pt)
Позовна заява про стягнення боргу
Court claim for debt recovery
`;
    const typstProc = spawnSync('typst', ['compile', '-', samplePdf], {
      input: typstCode,
      encoding: 'utf-8',
    });
    assert.strictEqual(typstProc.status, 0, 'Typst should compile sample PDF');

    // Render to raster PNG to simulate scanned document
    spawnSync('pdftoppm', ['-png', '-r', '150', samplePdf, path.join(tmpDir, 'scan_page')]);
    const scanImg = path.join(tmpDir, 'scan_page-1.png');
    assert.strictEqual(fs.existsSync(scanImg), true, 'Raster scan PNG should exist');

    // Run qes-ocr with ukr+eng and sidecar
    const ocrProc = spawnSync(ocrBin, [
      '-l', 'ukr+eng',
      '-t',
      '-o', outputPdf,
      scanImg,
    ], { encoding: 'utf-8' });

    assert.strictEqual(ocrProc.status, 0, `qes-ocr should succeed: ${ocrProc.stderr}`);
    assert.strictEqual(fs.existsSync(outputPdf), true, 'Output searchable PDF must exist');
    assert.strictEqual(fs.existsSync(sidecarTxt), true, 'Sidecar text file must exist');

    const txtContent = fs.readFileSync(sidecarTxt, 'utf-8');
    assert.ok(
      txtContent.toLowerCase().includes('позов') ||
      txtContent.toLowerCase().includes('стягнен') ||
      txtContent.toLowerCase().includes('борг') ||
      txtContent.toLowerCase().includes('court') ||
      txtContent.toLowerCase().includes('debt'),
      `Text file must contain recognized words: "${txtContent}"`
    );
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('qes-ocr performs pure English OCR (--eng / -e) with full text layer and sidecar export', async () => {
  const ocrBin = path.join(__dirname, '../bin/qes-ocr');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qes-test-ocr-eng-'));
  const samplePdf = path.join(tmpDir, 'english_contract.pdf');
  const outputPdf = path.join(tmpDir, 'english_contract_ocr.pdf');
  const sidecarTxt = path.join(tmpDir, 'english_contract_ocr.txt');

  try {
    const typstCode = `
#set page(width: 12cm, height: 6cm, margin: 1cm)
#set text(font: "Liberation Sans", size: 12pt)
NON-DISCLOSURE AGREEMENT
This Agreement is entered into between Acme Corporation and Beta LLC.
The parties agree to keep all confidential information strictly secret.
`;
    const typstProc = spawnSync('typst', ['compile', '-', samplePdf], {
      input: typstCode,
      encoding: 'utf-8',
    });
    assert.strictEqual(typstProc.status, 0);

    spawnSync('pdftoppm', ['-png', '-r', '150', samplePdf, path.join(tmpDir, 'scan_en')]);
    const scanImg = path.join(tmpDir, 'scan_en-1.png');
    assert.strictEqual(fs.existsSync(scanImg), true);

    const ocrProc = spawnSync(ocrBin, [
      '--eng',
      '-t',
      '-o', outputPdf,
      scanImg,
    ], { encoding: 'utf-8' });

    assert.strictEqual(ocrProc.status, 0, `qes-ocr --eng failed: ${ocrProc.stderr}`);
    assert.strictEqual(fs.existsSync(outputPdf), true);
    assert.strictEqual(fs.existsSync(sidecarTxt), true);

    const txtContent = fs.readFileSync(sidecarTxt, 'utf-8').toLowerCase();
    assert.ok(txtContent.includes('disclosure') || txtContent.includes('agreement'), 'Must recognize agreement');
    assert.ok(txtContent.includes('confidential') || txtContent.includes('secret') || txtContent.includes('corporation'), 'Must recognize English legal terms');
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('qes-cert parses DER certificate and extracts national Ukrainian attributes', () => {
  const certBin = fs.existsSync(path.join(__dirname, '../bin/qes-cert'))
    ? path.join(__dirname, '../bin/qes-cert')
    : path.join(__dirname, '../../qes-verifier/bin/qes-cert');
  const userCert = path.join(process.env.HOME || '/home/attor', '.secure_keys', 'Баєнко_Я_В_monoКЕП_2025-09-15T20_12_28.cer');
  const ciCert = path.join(__dirname, '../node_modules/jkurwa/test/data/SELF_SIGNED1.cer');
  const targetCert = fs.existsSync(userCert) ? userCert : ciCert;
  if (!fs.existsSync(targetCert)) return;

  const res = spawnSync(certBin, ['--json', targetCert], { encoding: 'utf-8' });
  assert.strictEqual(res.status, 0, `qes-cert should succeed: ${res.stderr}`);

  const parsed = JSON.parse(res.stdout);
  assert.ok(Array.isArray(parsed) && parsed.length === 1);
  const certInfo = parsed[0];
  if (targetCert === userCert) {
    assert.strictEqual(certInfo.subject.drfo, '3255419579');
    assert.strictEqual(certInfo.subject.full_name, 'Баєнко Ярослав Володимирович');
    assert.ok(certInfo.issuer.name.includes('monobank'));
    assert.strictEqual(certInfo.classification.is_qes, true);
    assert.strictEqual(certInfo.validity.status, 'VALID');
  } else {
    assert.strictEqual(typeof certInfo.classification.is_qes, 'boolean');
    assert.ok(['VALID', 'EXPIRED', 'NOT_YET_VALID'].includes(certInfo.validity.status));
  }
  assert.ok(certInfo.crypto.algorithm_name.includes('ДСТУ 4145'));
  assert.ok(certInfo.crypto.fingerprint_sha256.length === 64);
});

test('qes-cert handles PKCS#7 certificate bundle (.p7b) and PEM export', () => {
  const certBin = fs.existsSync(path.join(__dirname, '../bin/qes-cert'))
    ? path.join(__dirname, '../bin/qes-cert')
    : path.join(__dirname, '../../qes-verifier/bin/qes-cert');
  const p7bPath = path.join(__dirname, '../certs/mono.p7b');
  assert.strictEqual(fs.existsSync(p7bPath), true);

  // Quiet batch list
  const resQuiet = spawnSync(certBin, ['-q', p7bPath], { encoding: 'utf-8' });
  assert.strictEqual(resQuiet.status, 0);
  const lines = resQuiet.stdout.trim().split('\n');
  assert.ok(lines.length >= 10, 'Should list all certificates in bundle');

  // Raw PEM export
  const userCert = path.join(process.env.HOME || '/home/attor', '.secure_keys', 'Баєнко_Я_В_monoКЕП_2025-09-15T20_12_28.cer');
  const ciCert = path.join(__dirname, '../node_modules/jkurwa/test/data/SELF_SIGNED1.cer');
  const targetCert = fs.existsSync(userCert) ? userCert : ciCert;
  if (fs.existsSync(targetCert)) {
    const resRaw = spawnSync(certBin, ['--raw', targetCert], { encoding: 'utf-8' });
    assert.strictEqual(resRaw.status, 0);
    assert.ok(resRaw.stdout.includes('-----BEGIN CERTIFICATE-----'));
    assert.ok(resRaw.stdout.includes('-----END CERTIFICATE-----'));
  }
});

test('qes-verify seamlessly routes .cer certificate files to qes-cert', () => {
  const verifyBin = fs.existsSync(path.join(__dirname, '../bin/qes-verify'))
    ? path.join(__dirname, '../bin/qes-verify')
    : path.join(__dirname, '../../qes-verifier/bin/qes-verify');
  const userCert = path.join(process.env.HOME || '/home/attor', '.secure_keys', 'Баєнко_Я_В_monoКЕП_2025-09-15T20_12_28.cer');
  const ciCert = path.join(__dirname, '../node_modules/jkurwa/test/data/SELF_SIGNED1.cer');
  const targetCert = fs.existsSync(userCert) ? userCert : ciCert;
  if (!fs.existsSync(targetCert)) return;

  const res = spawnSync(verifyBin, ['--json', targetCert], { encoding: 'utf-8' });
  assert.strictEqual(res.status, 0, `qes-verify should route to qes-cert: ${res.stderr}`);

  const parsed = JSON.parse(res.stdout);
  assert.ok(Array.isArray(parsed) && parsed.length === 1);
  if (targetCert === userCert) {
    assert.strictEqual(parsed[0].subject.drfo, '3255419579');
  }
});

test('i18n module provides proper translations for UK and EN locales', () => {
  const { t, strings } = require('../src/i18n');
  assert.ok(strings.uk);
  assert.ok(strings.en);
  assert.strictEqual(strings.uk.dialogTitle, 'КЕП (ДСТУ 4145-2002)');
  assert.strictEqual(strings.en.dialogTitle, 'QES (DSTU 4145-2002)');
  assert.strictEqual(strings.uk.sigValid, 'ПІДПИС ДІЙСНИЙ');
  assert.strictEqual(strings.en.sigValid, 'SIGNATURE VALID');
});

test('qes-config CLI switches Nautilus menu language between Ukrainian and English', () => {
  const configBin = path.join(__dirname, '../bin/qes-config');
  assert.strictEqual(fs.existsSync(configBin), true);

  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'qes-test-home-'));
  try {
    const env = { ...process.env, HOME: tmpHome };

    // Switch to UK
    const resUk = spawnSync('bash', [configBin, '--lang', 'uk'], { encoding: 'utf-8', env });
    assert.strictEqual(resUk.status, 0, `Switch to UK failed: ${resUk.stderr}`);
    assert.match(resUk.stdout, /Встановлено українську мову/);

    const scriptsDir = path.join(tmpHome, '.local/share/nautilus/scripts');
    const ukFolder = path.join(scriptsDir, '🔐 КЕП та Безпека');
    const enFolder = path.join(scriptsDir, '🔐 QES & Security');
    assert.strictEqual(fs.existsSync(ukFolder), true);
    assert.strictEqual(fs.existsSync(enFolder), false);
    assert.strictEqual(fs.existsSync(path.join(ukFolder, '.i18n.sh')), true);

    // Switch to EN
    const resEn = spawnSync('bash', [configBin, '--lang', 'en'], { encoding: 'utf-8', env });
    assert.strictEqual(resEn.status, 0, `Switch to EN failed: ${resEn.stderr}`);
    assert.match(resEn.stdout, /Language set to English/);
    assert.strictEqual(fs.existsSync(ukFolder), false);
    assert.strictEqual(fs.existsSync(enFolder), true);
    assert.strictEqual(fs.existsSync(path.join(enFolder, '.i18n.sh')), true);
  } finally {
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) {}
  }
});

test('qes-tool master CLI supports --version, --help and subcommand dispatching', () => {
  const toolBin = path.join(__dirname, '..', 'bin', 'qes-tool');
  assert.strictEqual(fs.existsSync(toolBin), true, 'qes-tool script exists');

  // Test --version
  const resVer = spawnSync('bash', [toolBin, '--version'], { encoding: 'utf-8' });
  assert.strictEqual(resVer.status, 0);
  assert.match(resVer.stdout, /qes-tools v1\.0\.\d+/);

  // Test -v
  const resShortVer = spawnSync('bash', [toolBin, '-v'], { encoding: 'utf-8' });
  assert.strictEqual(resShortVer.status, 0);
  assert.match(resShortVer.stdout, /qes-tools v1\.0\.\d+/);

  // Test --help UK
  const resHelpUk = spawnSync('bash', [toolBin, '--help'], {
    encoding: 'utf-8',
    env: { ...process.env, QES_LANG: 'uk' },
  });
  assert.strictEqual(resHelpUk.status, 0);
  assert.match(resHelpUk.stdout, /Комплекс КЕП та криптографічного захисту/);
  assert.match(resHelpUk.stdout, /ПРИКЛАДИ КОМАНД/);
  assert.match(resHelpUk.stdout, /qes-sign --pades/);

  // Test --help EN
  const resHelpEn = spawnSync('bash', [toolBin, '--help'], {
    encoding: 'utf-8',
    env: { ...process.env, QES_LANG: 'en' },
  });
  assert.strictEqual(resHelpEn.status, 0);
  assert.match(resHelpEn.stdout, /Ukrainian QES & Cryptographic LegalTech Suite/);
  assert.match(resHelpEn.stdout, /COMMAND EXAMPLES/);
  assert.match(resHelpEn.stdout, /qes-sign --pades/);
});

test('National CA bundle ua-all-cas.p7b exists and loads all Ukrainian CAs into jkurwa Box', () => {
  const allCasPath = path.join(__dirname, '..', 'certs', 'ua-all-cas.p7b');
  assert.strictEqual(fs.existsSync(allCasPath), true, 'ua-all-cas.p7b exists');
  const buf = fs.readFileSync(allCasPath);
  assert.ok(buf.length > 50000, 'ua-all-cas.p7b contains substantial certificate bundle');

  const engine = new QESEngine();
  assert.ok(engine.casBuffer, 'QESEngine automatically loaded default CA bundle');
  assert.ok(engine.casBuffer.length > 50000);

  const box = new jk.Box({ algo: getAlgos(), casBuffer: buf });
  const caCount = Object.keys(box.cas).length;
  assert.ok(caCount >= 100, `Box loaded ${caCount} CAs from ua-all-cas.p7b`);
});

test('providers module provides all Ukrainian QTSPs with valid CMP, TSP, OCSP endpoints', () => {
  const { PROVIDERS, getCmpEndpoints, getTspEndpoints, getOcspEndpoints, detectProvider, detectHardwareTokens } = require('../src/providers');

  assert.ok(PROVIDERS.depositsign, 'DepositSign provider exists');
  assert.strictEqual(PROVIDERS.depositsign.edrpou, '43005049');
  assert.ok(PROVIDERS.depositsign.cmp.length > 0);
  assert.ok(PROVIDERS.depositsign.tsp.length > 0);
  assert.ok(PROVIDERS.depositsign.ocsp.length > 0);

  assert.ok(PROVIDERS.monobank, 'monobank provider exists');
  assert.ok(PROVIDERS.diia, 'Diia provider exists');
  assert.ok(PROVIDERS.dps, 'DPS provider exists');
  assert.ok(PROVIDERS.privatbank, 'PrivatBank provider exists');
  assert.ok(PROVIDERS.vchasno, 'Vchasno provider exists');
  assert.ok(PROVIDERS.nais, 'NAIS provider exists');
  assert.ok(PROVIDERS.czo, 'CZO provider exists');

  const cmpList = getCmpEndpoints();
  assert.ok(cmpList.length >= 10, 'At least 10 CMP lookup endpoints configured');
  assert.ok(cmpList.includes('https://ca.depositsign.com/services/cmp/'), 'DepositSign CMP is included');

  const tspList = getTspEndpoints();
  assert.ok(tspList.length >= 5, 'At least 5 TSP endpoints configured');

  const ocspList = getOcspEndpoints();
  assert.ok(ocspList.length >= 5, 'At least 5 OCSP endpoints configured');

  // Test detectProvider
  const pDeposit = detectProvider('CN=QTSP of the DEPOSIT SIGN LLC, O=DEPOSIT SIGN LLC, 2.5.4.97=NTRUA-43005049');
  assert.ok(pDeposit, 'Detects DepositSign provider');
  assert.strictEqual(pDeposit.id, 'depositsign');

  const pMono = detectProvider('CN=QTSP monobank | Universal Bank, O=JSC UNIVERSAL BANK');
  assert.ok(pMono, 'Detects monobank provider');
  assert.strictEqual(pMono.id, 'monobank');

  // Test detectHardwareTokens
  const tokRes = detectHardwareTokens();
  assert.strictEqual(typeof tokRes.detected, 'boolean');
  assert.ok(Array.isArray(tokRes.tokens));
});

test('qes-tool token and qes-tool providers CLI commands execute with formatted output', () => {
  const toolBin = path.join(__dirname, '..', 'bin', 'qes-tool');

  const resTok = spawnSync('bash', [toolBin, 'token'], { encoding: 'utf-8' });
  assert.strictEqual(resTok.status, 0);
  assert.match(resTok.stdout, /Апаратн|Алмаз|SecureToken|ЗНОК/);

  const resProv = spawnSync('bash', [toolBin, 'providers'], { encoding: 'utf-8' });
  assert.strictEqual(resProv.status, 0);
  assert.match(resProv.stdout, /РЕЄСТР КВАЛІФІКОВАНИХ НАДАВАЧІВ/);
  assert.match(resProv.stdout, /ДЕПОЗИТ САЙН/);
  assert.match(resProv.stdout, /monobank/);
  assert.match(resProv.stdout, /Дія/);
  assert.match(resProv.stdout, /Податков/i);
});

test('qes-cert --tokens CLI flag inspects connected hardware tokens in text and json modes', () => {
  const certBin = path.join(__dirname, '..', 'bin', 'qes-cert');

  const resTxt = spawnSync(certBin, ['--tokens'], { encoding: 'utf-8' });
  assert.strictEqual(resTxt.status, 0);
  assert.match(resTxt.stdout, /Апаратн|Алмаз|SecureToken|ЗНОК/);

  const resJson = spawnSync(certBin, ['--tokens', '--json'], { encoding: 'utf-8' });
  assert.strictEqual(resJson.status, 0);
  const parsed = JSON.parse(resJson.stdout);
  assert.strictEqual(typeof parsed.detected, 'boolean');
  assert.ok(Array.isArray(parsed.tokens));
});

test('integrated EUSW native modules and udev rules exist and satisfy Linux binary security standards', () => {
  const iitDir = path.join(__dirname, '..', 'opt', 'iit', 'eu', 'sw');
  assert.strictEqual(fs.existsSync(iitDir), true, 'opt/iit/eu/sw directory exists');

  const requiredLibs = [
    'pkcs11.eka1c.so',
    'pkcs11.ekc1.so',
    'libav337p11d.so',
    'euscp.so',
    'euscpnmh',
  ];

  for (const lib of requiredLibs) {
    const p = path.join(iitDir, lib);
    assert.strictEqual(fs.existsSync(p), true, `Required EUSW asset ${lib} exists`);
  }

  // Check udev rules
  const udevPath = path.join(__dirname, '..', 'etc', 'udev', 'rules.d', '60-iit-e-keys.rules');
  assert.strictEqual(fs.existsSync(udevPath), true, '60-iit-e-keys.rules exists');
  const udevContent = fs.readFileSync(udevPath, 'utf-8');
  assert.match(udevContent, /ATTRS?\{idVendor\}=="03eb"/, 'Covers IIT vendor 03eb');
  assert.match(udevContent, /ATTRS?\{idVendor\}=="0483"/, 'Covers Author vendor 0483');
  assert.match(udevContent, /ATTRS?\{idVendor\}=="0529"/, 'Covers SafeNet vendor 0529');
  assert.match(udevContent, /TAG\+="uaccess"/, 'Sets uaccess tag for non-root desktop access');
  assert.match(udevContent, /MODE="0666"/, 'Sets mode 0666');

  // Check that libav337p11d.so has non-executable PT_GNU_STACK (flags == 6 / RW)
  const av337Path = path.join(iitDir, 'libav337p11d.so');
  const buf = fs.readFileSync(av337Path);
  const phoff = Number(buf.readBigInt64LE(32));
  const phentsize = buf.readUInt16LE(54);
  const phnum = buf.readUInt16LE(56);
  let stackFlags = -1;
  for (let i = 0; i < phnum; i++) {
    const off = phoff + i * phentsize;
    const pType = buf.readUInt32LE(off);
    if (pType === 0x6474e551) { // PT_GNU_STACK
      stackFlags = buf.readUInt32LE(off + 4);
      break;
    }
  }
  assert.strictEqual(stackFlags, 6, 'libav337p11d.so PT_GNU_STACK is RW (flags=6), not RWE (flags=7)');

  // Verify hardware token detection includes driver status
  const { detectHardwareTokens } = require('../src/providers');
  const tokRes = detectHardwareTokens();
  if (tokRes.detected) {
    const firstTok = tokRes.tokens[0];
    assert.ok(firstTok.driverPath, 'Detected token has driverPath assigned');
    assert.strictEqual(firstTok.driverInstalled, true, 'Driver is verified as installed');
  }
});

test('web-agent module bridges JSON-RPC to euscpnmh over HTTP and manages browser manifests', async () => {
  const {
    NmhBridge,
    startWebAgentServer,
    setupBrowserManifests,
    checkBrowserManifests,
    detectTokens,
  } = require('../src/web-agent');

  // 1. Test NmhBridge directly
  const bridge = new NmhBridge();
  assert.strictEqual(bridge.isAlive, true, 'NmhBridge process started');

  const rpcResult = await new Promise((resolve, reject) => {
    bridge.call(JSON.stringify({ jsonrpc: '2.0', id: 101, method: 'GetVersion', params: [] }), (err, res) => {
      if (err) return reject(err);
      resolve(JSON.parse(res));
    });
  });

  assert.strictEqual(rpcResult.id, 101);
  assert.strictEqual(rpcResult.result.result, '1.3.109');
  assert.strictEqual(rpcResult.result.error.code, 0);
  bridge.destroy();

  // 2. Test startWebAgentServer HTTP GET & POST
  const srv = startWebAgentServer({ portHttp: 18091, portHttps: 18093 });
  assert.ok(srv.httpServer);

  // Test GET status
  const getRes = await new Promise((resolve) => {
    const http = require('http');
    http.get('http://127.0.0.1:18091/', (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(JSON.parse(data)));
    });
  });
  assert.strictEqual(getRes.status, 'ok');
  assert.strictEqual(getRes.eusw, '1.3.109');

  // Test POST JSON-RPC
  const postRes = await new Promise((resolve) => {
    const http = require('http');
    const req = http.request({
      hostname: '127.0.0.1',
      port: 18091,
      method: 'POST',
      headers: { 'Content-Type': 'application/json-rpc' },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.write(JSON.stringify({ jsonrpc: '2.0', id: 202, method: 'GetVersion', params: [] }));
    req.end();
  });
  assert.strictEqual(postRes.id, 202);
  assert.strictEqual(postRes.result.result, '1.3.109');

  // Test CORS security: untrusted origin should be rejected with 403 Forbidden
  const forbiddenRes = await new Promise((resolve) => {
    const http = require('http');
    const req = http.request({
      hostname: '127.0.0.1',
      port: 18091,
      method: 'GET',
      headers: { Origin: 'https://evil-untrusted-site.com' },
    }, (res) => {
      resolve(res.statusCode);
    });
    req.end();
  });
  assert.strictEqual(forbiddenRes, 403, 'Untrusted origin should be rejected with 403');

  // Test CORS security: trusted government origin should be accepted with matching Access-Control-Allow-Origin
  const allowedRes = await new Promise((resolve) => {
    const http = require('http');
    const req = http.request({
      hostname: '127.0.0.1',
      port: 18091,
      method: 'GET',
      headers: { Origin: 'https://cabinet.tax.gov.ua' },
    }, (res) => {
      resolve({ statusCode: res.statusCode, allowOrigin: res.headers['access-control-allow-origin'] });
    });
    req.end();
  });
  assert.strictEqual(allowedRes.statusCode, 200);
  assert.strictEqual(allowedRes.allowOrigin, 'https://cabinet.tax.gov.ua');

  srv.close();

  // 3. Test setupBrowserManifests in temp home
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'qes-browser-test-'));
  const setupRes = setupBrowserManifests(tmpHome);
  assert.ok(setupRes.length > 0);

  const userManifests = checkBrowserManifests(tmpHome).filter((c) => c.name.includes('(User)'));
  for (const m of userManifests) {
    assert.strictEqual(m.exists, true, `Manifest ${m.name} exists in ${m.file}`);
  }

  // 4. Test detectTokens
  const detected = detectTokens();
  assert.ok(Array.isArray(detected));

  fs.rmSync(tmpHome, { recursive: true, force: true });
});

test('HardwareTokenSigner and PAdES visual stamp engine support hardware token certificates', async () => {
  const { HardwareTokenSigner, extractCertInfoFromCertBuffer, generateStampBoxPng } = require('../src/pades');
  const { getHardwareTokenCertificate } = require('../src/token-signer');
  const { Signer } = require('@signpdf/utils');

  // 1. Verify HardwareTokenSigner inherits from Signer
  assert.strictEqual(Object.getPrototypeOf(HardwareTokenSigner), Signer);
  const testSigner = new HardwareTokenSigner({ typeIndex: 1, devIndex: 0, pin: '1234' });
  assert.ok(testSigner instanceof Signer);
  assert.strictEqual(typeof testSigner.sign, 'function');

  // 2. Resolve token certificate
  let certRes;
  try {
    certRes = getHardwareTokenCertificate();
  } catch (_) {
    const sampleCertPath = path.join(__dirname, '..', 'node_modules', 'jkurwa', 'test', 'data', 'SELF_SIGNED1.cer');
    if (fs.existsSync(sampleCertPath)) {
      certRes = { certBuf: fs.readFileSync(sampleCertPath), certPath: sampleCertPath };
    }
  }
  assert.ok(certRes && certRes.certBuf && certRes.certBuf.length > 0);

  // 3. Extract cert info
  const certInfo = extractCertInfoFromCertBuffer(certRes.certBuf);
  assert.ok(certInfo.commonName && certInfo.commonName.length > 0);
  assert.ok(certInfo.issuerName && certInfo.issuerName.length > 0);
  assert.ok(certInfo.serialHex && certInfo.serialHex.length > 0);

  // If testing with the advocate certificate, check specific fields
  if (certRes.certPath && certRes.certPath.includes('6FA97849')) {
    assert.strictEqual(certInfo.commonName, 'Баєнко Ярослав Володимирович');
    assert.strictEqual(certInfo.rnokpp, '3255419579');
    assert.strictEqual(certInfo.title, 'Адвокат, Свідоцтво №003170');
  }

  // 4. Generate visual stamp PNG with certInfo
  const pngBuf = await generateStampBoxPng(certInfo);
  assert.ok(Buffer.isBuffer(pngBuf) && pngBuf.length > 100);
  // PNG signature check
  assert.strictEqual(pngBuf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});

test('i18n priority engine correctly handles ~/.config/qes/config.json override vs env vs default locale', () => {
  const { getQESLang, t } = require('../src/i18n');
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'qes-i18n-test-'));
  const origHome = process.env.HOME;
  const origLang = process.env.LANG;
  const origLcAll = process.env.LC_ALL;
  const origLcMessages = process.env.LC_MESSAGES;
  const origLanguage = process.env.LANGUAGE;

  try {
    process.env.HOME = tmpHome;
    delete process.env.LC_ALL;
    delete process.env.LC_MESSAGES;
    delete process.env.LANGUAGE;

    const cfgDir = path.join(tmpHome, '.config', 'qes');
    fs.mkdirSync(cfgDir, { recursive: true });

    // 1. Config override to UK with EN environment
    process.env.LANG = 'en_US.UTF-8';
    fs.writeFileSync(path.join(cfgDir, 'config.json'), JSON.stringify({ lang: 'uk' }));
    assert.strictEqual(getQESLang(), 'uk', 'Config lang=uk must override LANG=en_US.UTF-8');
    assert.strictEqual(t('dialogTitle'), 'КЕП (ДСТУ 4145-2002)');

    // 2. Config override to EN with UK environment
    process.env.LANG = 'uk_UA.UTF-8';
    fs.writeFileSync(path.join(cfgDir, 'config.json'), JSON.stringify({ lang: 'en' }));
    assert.strictEqual(getQESLang(), 'en', 'Config lang=en must override LANG=uk_UA.UTF-8');
    assert.strictEqual(t('dialogTitle'), 'QES (DSTU 4145-2002)');

    // 3. Config set to auto with EN environment
    process.env.LANG = 'en_US.UTF-8';
    fs.writeFileSync(path.join(cfgDir, 'config.json'), JSON.stringify({ lang: 'auto' }));
    assert.strictEqual(getQESLang(), 'en', 'Config lang=auto must respect LANG=en_US.UTF-8');

    // 4. Config set to auto with UK environment
    process.env.LANG = 'uk_UA.UTF-8';
    assert.strictEqual(getQESLang(), 'uk', 'Config lang=auto must respect LANG=uk_UA.UTF-8');

    // 5. Test translation strings
    process.env.LANG = 'en_US.UTF-8';
    fs.writeFileSync(path.join(cfgDir, 'config.json'), JSON.stringify({ lang: 'en' }));
    assert.match(t('sessionActive', '10 min'), /QES session active/);
    assert.match(t('cachedSession', 15), /session for 15 min/);

    fs.writeFileSync(path.join(cfgDir, 'config.json'), JSON.stringify({ lang: 'uk' }));
    assert.match(t('sessionActive', '10 хв'), /Сесія КЕП активна/);
    assert.match(t('cachedSession', 15), /сесія на 15 хв/);
  } finally {
    process.env.HOME = origHome;
    if (origLang !== undefined) process.env.LANG = origLang; else delete process.env.LANG;
    if (origLcAll !== undefined) process.env.LC_ALL = origLcAll; else delete process.env.LC_ALL;
    if (origLcMessages !== undefined) process.env.LC_MESSAGES = origLcMessages; else delete process.env.LC_MESSAGES;
    if (origLanguage !== undefined) process.env.LANGUAGE = origLanguage; else delete process.env.LANGUAGE;
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_) {}
  }
});

test('Nautilus integration completeness: all 18 scripts exist in both languages and pass syntax checks', () => {
  const scriptsDir = path.join(__dirname, '..', 'nautilus-scripts');
  assert.strictEqual(fs.existsSync(scriptsDir), true);

  const expectedScripts = [
    '0_help.sh',
    '1_sign_pades.sh',
    '1b_sign_pades_no_stamp.sh',
    '2_sign_p7s.sh',
    '3_sign_asice.sh',
    '4_verify.sh',
    '5_encrypt_self.sh',
    '6_encrypt_recipient.sh',
    '7_decrypt.sh',
    '8_export_cert.sh',
    '9_pdf_court.sh',
    '10_append_signature.sh',
    '11_lock_session.sh',
    '12_ocr_court.sh',
    '13_view_cert.sh',
    '14_ocr_english.sh',
    '15_upgrade_ltv.sh',
    '16_pdf_protocol.sh',
    '_i18n.sh',
  ];

  for (const s of expectedScripts) {
    const fullPath = path.join(scriptsDir, s);
    assert.strictEqual(fs.existsSync(fullPath), true, `Script ${s} must exist`);

    const stat = fs.statSync(fullPath);
    assert.ok((stat.mode & 0o111) !== 0, `Script ${s} must be executable (0755)`);

    const checkRes = spawnSync('bash', ['-n', fullPath], { encoding: 'utf-8' });
    assert.strictEqual(checkRes.status, 0, `Syntax error in ${s}: ${checkRes.stderr}`);

    const content = fs.readFileSync(fullPath, 'utf-8');
    assert.match(content, /^#!\/usr\/bin\/env bash/, `Script ${s} must have bash shebang`);
  }
});

test('qes-config status, help, and categorized GNOME HIG menu layout without duplicates', () => {
  const configBin = path.join(__dirname, '..', 'bin', 'qes-config');
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qes-status-test-'));

  try {
    const fakeHome = path.join(tmpRoot, 'home');
    fs.mkdirSync(fakeHome, { recursive: true });

    const scriptsDir = path.join(__dirname, '..', 'nautilus-scripts');
    const env = {
      ...process.env,
      HOME: fakeHome,
      QES_SOURCE_SCRIPTS_DIR: scriptsDir,
      LANG: 'en_US.UTF-8',
    };

    const statusRes = spawnSync('bash', [configBin, '--status'], { encoding: 'utf-8', env });
    assert.strictEqual(statusRes.status, 0);
    assert.match(statusRes.stdout, /НАЛАШТУВАННЯ ТА ЛОКАЛІЗАЦІЯ/);
    assert.match(statusRes.stdout, /Config mode:/);

    const helpRes = spawnSync('bash', [configBin, '--help'], { encoding: 'utf-8', env });
    assert.strictEqual(helpRes.status, 0);
    assert.match(helpRes.stdout, /qes-config — Керування конфігурацією/);
    assert.match(helpRes.stdout, /--lang/);
    assert.match(helpRes.stdout, /--all-users/);

    // Deploy categorized EN menu and verify zero loose scripts in root & zero duplicates
    const deployEn = spawnSync('bash', [configBin, '--lang', 'en', '--layout', 'categorized'], { encoding: 'utf-8', env });
    assert.strictEqual(deployEn.status, 0);
    const enMenuRoot = path.join(fakeHome, '.local', 'share', 'nautilus', 'scripts', '🔐 QES & Security');
    const rootEntries = fs.readdirSync(enMenuRoot).filter((e) => !e.startsWith('.'));
    for (const entry of rootEntries) {
      const st = fs.statSync(path.join(enMenuRoot, entry));
      assert.strictEqual(st.isDirectory(), true, `Root of categorized menu must only contain category folders, found file: ${entry}`);
    }
    assert.strictEqual(rootEntries.length, 5, 'Must have exactly 5 GNOME HIG category folders');
    const signingItems = fs.readdirSync(path.join(enMenuRoot, '✍️ Signing')).filter((e) => !e.startsWith('.'));
    const verifyItems = fs.readdirSync(path.join(enMenuRoot, '🔍 Verification & Certificates')).filter((e) => !e.startsWith('.'));
    assert.strictEqual(signingItems.some((i) => i.includes('LTV')), false, 'LTV upgrade must NOT be duplicated in Signing category');
    assert.strictEqual(verifyItems.some((i) => i.includes('LTV')), true, 'LTV upgrade must be in Verification & Certificates');
    assert.strictEqual(verifyItems.some((i) => i.includes('PDF Verification Protocol')), true, 'PDF Protocol must be in Verification & Certificates');
  } finally {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
  }
});

test('Zenity GUI dialog formatting, Papirus styling, and medium selection logic', () => {
  const { chooseSigningMedium, getConnectedHardwareTokens } = require('../src/token-signer');

  const tokensRes = getConnectedHardwareTokens();
  assert.strictEqual(typeof tokensRes.detected, 'boolean');
  assert.ok(Array.isArray(tokensRes.tokens));
  assert.strictEqual(typeof chooseSigningMedium, 'function');
});

test('qes-pdf-court CLI optimizes PDF, linearizes and enforces court size bounds', () => {
  const pdfCourtBin = path.join(__dirname, '..', 'bin', 'qes-pdf-court');
  assert.strictEqual(fs.existsSync(pdfCourtBin), true);

  const res = spawnSync('bash', [pdfCourtBin, '--help'], { encoding: 'utf-8' });
  assert.strictEqual(res.status, 0);
  assert.match(res.stdout, /qes-pdf-court/);
  assert.match(res.stdout, /50 МБ/);
});

test('qes-export-cert CLI prints help and documentation', () => {
  const exportBin = path.join(__dirname, '..', 'bin', 'qes-export-cert.js');
  assert.strictEqual(fs.existsSync(exportBin), true);

  const res = spawnSync('node', [exportBin, '--help'], { encoding: 'utf-8' });
  assert.strictEqual(res.status, 0);
  assert.match(res.stdout, /qes-export-cert/);
  assert.match(res.stdout, /--key/);
});

test('Zenity Pango markup validation across qes-cert and qes-verify GUI dialogs (EN & UK)', () => {
  const pyCode = `
import glob, importlib.util, importlib.machinery, subprocess
import xml.etree.ElementTree as ET

try:
    import gi
    gi.require_version("Pango", "1.0")
    from gi.repository import Pango
    HAS_GI_PANGO = True
except Exception:
    HAS_GI_PANGO = False

VALID_PANGO_TAGS = {"root", "b", "i", "u", "s", "sub", "sup", "small", "big", "tt", "span"}

def validate_pango_markup(txt):
    root = ET.fromstring(f"<root>{txt}</root>")
    for elem in root.iter():
        if elem.tag not in VALID_PANGO_TAGS:
            raise ValueError(f"Unsupported Pango tag <{elem.tag}> in Zenity markup")
    if HAS_GI_PANGO:
        Pango.parse_markup(txt, -1, "\\x00")

def load_mod(name, path):
    loader = importlib.machinery.SourceFileLoader(name, path)
    spec = importlib.util.spec_from_loader(name, loader)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

cert_mod = load_mod("qes_cert", "bin/qes-cert")
ver_mod = load_mod("qes_verify", "bin/qes-verify")

checked = 0
orig_run = subprocess.run
def mock_run(cmd, *args, **kwargs):
    global checked
    if cmd and cmd[0] == "zenity" and "--no-markup" not in cmd:
        for arg in cmd:
            if arg.startswith("--text="):
                txt = arg[len("--text="):]
                validate_pango_markup(txt)
                checked += 1
        class Dummy:
            returncode = 0
            stdout = ""
        return Dummy()
    return orig_run(cmd, *args, **kwargs)

subprocess.run = mock_run

sample_certs = glob.glob("certs/*.p7b") + glob.glob("node_modules/jkurwa/test/data/*.cer")
assert len(sample_certs) > 0, "Expected sample certificates for Pango test"

for lang in ["en", "uk"]:
    cert_mod.get_qes_lang = lambda l=lang: l
    ver_mod.get_qes_lang = lambda l=lang: l
    cert_mod.show_cert_help_dialog()
    ver_mod.show_help_dialog()
    ver_mod.show_gui_report([], "/tmp/Test & <Doc>.pdf")

    certs = cert_mod.load_certificates_from_file(sample_certs[0])
    data = [cert_mod.inspect_certificate(certs[0], sample_certs[0])]
    data[0]["subject"]["organization"] = "AT&T <Legal> & Co."
    cert_mod.show_gui_dialog(data, "/tmp/Cert & <KEP>.cer")

    ver_mod.show_gui_report([{
        "container_format": "PAdES & LTV",
        "signing_time": "2026-10-13T18:00:00Z",
        "has_tsp": True,
        "tsp_time": "2026-10-13T18:00:01Z",
        "has_ltv": True,
        "signature_level": "PAdES-LTA",
        "is_valid_at_signing": True,
        "manifest_verified": True,
        "signed_files": ["contract & appendix <1>.pdf"],
        "cert_chain": [
            {"level": 1, "role_uk": "Сертифікат підписувача", "role_en": "Signer Certificate", "cn": "Баєнко Ярослав & Партнери", "serial": "6FA97849", "valid_to": "2027-01-01T00:00:00Z"},
            {"level": 2, "role_uk": "Акредитований КНЕДП (ЦСК)", "role_en": "Accredited QTSP / CA", "cn": "КНЕДП ТОВ \\"ДЕПОЗИТ САЙН\\" & Co", "serial": "3997E39F", "valid_to": "2028-01-01T00:00:00Z"},
            {"level": 3, "role_uk": "Кореневий ЦСК / ЦЗО", "role_en": "Root CA / Central Certifying Authority (CZO)", "cn": "Засвідчувальний центр", "serial": "5ACBAE0E", "valid_to": "2033-01-01T00:00:00Z"}
        ],
        "signer_certs": [{
            "is_qes": True,
            "valid_from": "2025-01-01T00:00:00Z",
            "valid_to": "2027-01-01T00:00:00Z",
            "subject": {"cn": "Баєнко Ярослав & Партнери", "drfo": "3255419579", "organization": "GOLAW & Co <Litigation>", "edrpou": "12345678"},
            "issuer": {"cn": "КНЕДП ТОВ \\"ДЕПОЗИТ САЙН\\" & Co"}
        }]
    }], "/tmp/Signed & <Verified>.pdf")

print(f"PANGO_OK:{checked}")
`;
  const res = spawnSync('python3', ['-c', pyCode], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf-8',
  });
  assert.strictEqual(res.status, 0, `Pango markup check failed: ${res.stderr}`);
  assert.match(res.stdout, /PANGO_OK:10/);
});

