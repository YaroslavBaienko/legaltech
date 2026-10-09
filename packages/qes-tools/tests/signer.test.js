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
  assert.match(res.stderr, /не знайдено/);
});

test('Engine rejects wrong password without crash or leak', async () => {
  const keyPath = path.join(process.env.HOME || '/home/attor', '.secure_keys', 'Баєнко_Я_В_monoКЕП_2025-09-15T20_12_28.pfx');
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
  const samplePdf = '/home/attor/test_kep/test_doc.pdf';
  if (!fs.existsSync(samplePdf)) return;

  const mockCertInfo = {
    commonName: 'Баєнко Ярослав Володимирович',
    rnokpp: '3255419579',
    issuerName: 'КНЕДП monobank | Universal Bank',
    serialHex: '10FF6F932221FA00CB4407000000000130616768',
    validTo: new Date('2027-09-14T23:59:59Z'),
  };

  const stampedBytes = await applyVisualStamp(samplePdf, mockCertInfo, { page: 'z' });
  assert.ok(stampedBytes.length > 20000, 'Stamped PDF should have valid size');
  assert.strictEqual(stampedBytes.subarray(0, 5).toString('ascii'), '%PDF-');
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

