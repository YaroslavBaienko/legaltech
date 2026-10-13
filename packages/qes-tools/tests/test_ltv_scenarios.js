/**
 * test_ltv_scenarios.js — Comprehensive test suite for Long-Term Validation (LTV)
 * PAdES-LTA / CAdES-X-Long / CAdES-A archival signatures (25+ years validity).
 *
 * Scenarios tested:
 * 1. resolveCertificateChain resolves full CA chain up to Root CA (ЦЗО) from certs/ua-all-cas.p7b
 * 2. ensureOcspLink resolves OCSP responder URL from AIA extension and providers registry
 * 3. attachLtvToCms embeds live Ukrainian QTSP OCSP response + CA chain (certificateRefs, certificateValues, revocationRefs, revocationValues)
 * 4. CAdES (.p7s) signing with LTV + live QTSP TSP produces CAdES-LTA with full CA chain
 * 5. PAdES (.pdf) signing with LTV embeds PDF /DSS (/Certs, /OCSPs, /VRI) incrementally without invalidating /ByteRange
 * 6. Keyless archival upgrade (qes-sign --upgrade-ltv / qes-tool ltv) upgrades existing .p7s, .pdf, and .asice to LTV without private key
 * 7. Negative control (--no-ltv) and offline resilience fallback (--ocsp-url unreachable)
 * 8. Nautilus script 15_upgrade_ltv.sh upgrades selected files in sandboxed GUI environment
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const jk = require('jkurwa');
const { getAlgos, createBox } = require('../src/adapter');
const {
  resolveCertificateChain,
  ensureOcspLink,
  extractLtvMaterialFromCms,
  attachLtvToCms,
  embedPdfDss,
  upgradeExistingFileToLtv,
} = require('../src/ltv');

const PACKAGE_DIR = path.resolve(__dirname, '..');
const CLI_SIGN = path.join(PACKAGE_DIR, 'bin', 'qes-sign.js');
const CLI_TOOL = path.join(PACKAGE_DIR, 'bin', 'qes-tool');
const CLI_VERIFY = path.join(PACKAGE_DIR, 'bin', 'qes-verify');
const DATA_DIR = path.join(PACKAGE_DIR, 'node_modules', 'jkurwa', 'test', 'data');

const MONOBANK_TSP = 'http://ca.monobank.ua/services/tsp/dstu/';
const DEPOSITSIGN_TSP = 'http://ca.depositsign.com/services/tsp/dstu/';
const DEPOSITSIGN_OCSP = 'http://ca.depositsign.com/services/ocsp/';

const WORK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'qes-ltv-test-'));
const KEY1_PATH = path.join(WORK_DIR, 'key1_pbes2.pfx');
const CERT1_PATH = path.join(WORK_DIR, 'cert1.cer');
const KEY1_PASS = 'test_ltv_pass_123';

const SAMPLE_TXT = path.join(WORK_DIR, 'archival_contract.txt');
const SAMPLE_PDF = path.join(WORK_DIR, 'archival_decision.pdf');

const MOCK_BIN_DIR = path.join(WORK_DIR, 'mock_bin');
fs.mkdirSync(MOCK_BIN_DIR, { recursive: true });

function setupEnvironment() {
  const algo = getAlgos();
  const priv1Buf = fs.readFileSync(path.join(DATA_DIR, 'PRIV1.cer'));
  const priv1 = jk.Priv.from_asn1(priv1Buf);
  const protectedBuf = priv1.to_pbes2(KEY1_PASS, algo);
  fs.writeFileSync(KEY1_PATH, protectedBuf);
  fs.copyFileSync(path.join(DATA_DIR, 'SELF_SIGNED1.cer'), CERT1_PATH);

  fs.writeFileSync(
    SAMPLE_TXT,
    'Договір архівного зберігання №2026/LTV.\nЦей документ підлягає довгостроковій перевірці (25+ років) за стандартом CAdES-X-Long / PAdES-LTA.',
    'utf-8'
  );

  // Create mock zenity and notify-send for Nautilus script testing
  fs.writeFileSync(
    path.join(MOCK_BIN_DIR, 'zenity'),
    '#!/usr/bin/env bash\ncat >/dev/null 2>&1 || true\nexit 0\n',
    { mode: 0o755 }
  );
  fs.writeFileSync(
    path.join(MOCK_BIN_DIR, 'notify-send'),
    '#!/usr/bin/env bash\nexit 0\n',
    { mode: 0o755 }
  );
  fs.symlinkSync(CLI_SIGN, path.join(MOCK_BIN_DIR, 'qes-sign'));
  fs.symlinkSync(CLI_TOOL, path.join(MOCK_BIN_DIR, 'qes-tool'));
  fs.symlinkSync(CLI_VERIFY, path.join(MOCK_BIN_DIR, 'qes-verify'));
}

async function createSamplePdf(outputPath) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText('ARCHIVAL LONG-TERM VALIDATION (PAdES-LTA) COURT DOCUMENT', {
    x: 50,
    y: 780,
    size: 13,
    font,
  });
  page.drawText('ETSI EN 319 142-1 Document Security Store (/DSS) Test.', {
    x: 50,
    y: 750,
    size: 11,
    font,
  });
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

function runSign(args) {
  const env = Object.assign({}, process.env, {
    PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
    QES_PASSWORD: KEY1_PASS,
  });
  return spawnSync(process.execPath, [CLI_SIGN, ...args], {
    cwd: WORK_DIR,
    env,
    encoding: 'utf-8',
    timeout: 60000,
  });
}

function runVerifyJson(filePath) {
  const res = spawnSync(CLI_VERIFY, ['-j', filePath], {
    cwd: WORK_DIR,
    encoding: 'utf-8',
    timeout: 30000,
  });
  assert.strictEqual(
    res.status,
    0,
    `qes-verify failed with status ${res.status}:\nSTDERR: ${res.stderr}\nSTDOUT: ${res.stdout}`
  );
  return JSON.parse(res.stdout.trim());
}

test.before(async () => {
  setupEnvironment();
  await createSamplePdf(SAMPLE_PDF);
});

test.after(() => {
  try {
    fs.rmSync(WORK_DIR, { recursive: true, force: true });
  } catch (e) {
    // ignore cleanup error
  }
});

test('Scenario 1: resolveCertificateChain resolves full CA chain up to Root CA (ЦЗО) from ua-all-cas.p7b', () => {
  const box = createBox();
  const rawCAs = Object.values(box.cas || {}).flat();
  assert.ok(rawCAs.length > 500, `Expected 500+ CA certs in bundle, got ${rawCAs.length}`);
  const allCaCerts = rawCAs.map((ob) => new jk.Certificate(ob));

  // Find a QTSP certificate issued by ЦЗО (Central Certifying Authority)
  const czoIssuedCert = allCaCerts.find(
    (c) =>
      !c.isRoot() &&
      (c.issuerDN() || '').includes('Центральний засвідчувальний орган')
  );
  assert.ok(czoIssuedCert, 'Expected at least one QTSP CA issued by ЦЗО in ua-all-cas.p7b');

  const chain = resolveCertificateChain(czoIssuedCert, box);
  assert.ok(Array.isArray(chain) && chain.length >= 1, 'Expected at least 1 Root CA certificate in chain');
  assert.strictEqual(typeof chain[chain.length - 1].isRoot, 'function');
  assert.strictEqual(chain[chain.length - 1].isRoot(), true, 'Expected top of chain to be self-signed Root CA (ЦЗО)');
});

test('Scenario 2: ensureOcspLink resolves OCSP URL from AIA extension or providers registry', () => {
  const box = createBox();
  const rawCAs = Object.values(box.cas || {}).flat();
  const allCaCerts = rawCAs.map((ob) => new jk.Certificate(ob));

  const dsCert = allCaCerts.find(
    (c) => (c.subjectDN() || '').includes('ДЕПОЗИТ САЙН') || (c.issuerDN() || '').includes('ДЕПОЗИТ САЙН')
  );
  assert.ok(dsCert, 'Expected DepositSign certificate in bundle');

  const ocspUrl = ensureOcspLink(dsCert);
  assert.ok(ocspUrl && ocspUrl.startsWith('http'), `Expected valid HTTP OCSP URL, got: ${ocspUrl}`);

  // Also test custom override on a cert without AIA (like SELF_SIGNED1.cer)
  const testCert = jk.models.Certificate.from_asn1(fs.readFileSync(CERT1_PATH));
  assert.strictEqual(testCert.ocspLink, null, 'Patched ocspLink getter should safely return null when AIA is null');
  const resolvedOverride = ensureOcspLink(testCert, DEPOSITSIGN_OCSP);
  assert.strictEqual(resolvedOverride, DEPOSITSIGN_OCSP);
  assert.strictEqual(testCert.ocspLink, DEPOSITSIGN_OCSP);
});

test('Scenario 3: attachLtvToCms embeds live QTSP TSP + CA chain into CMS signature', async () => {
  const { QESEngine } = require('../src/engine');
  const { safeBoxSign } = require('../src/adapter');
  const engine = new QESEngine();
  const { box } = await engine.initBox(KEY1_PATH, KEY1_PASS, CERT1_PATH);

  const contentBuf = fs.readFileSync(SAMPLE_TXT);
  // Create a basic CAdES-BES detached signature first
  const rawMsg = await safeBoxSign(box, contentBuf, null, null, {
    detached: true,
    tsp: false,
    ltv: false,
  });
  const rawCms = Buffer.from(rawMsg.as_asn1());

  // Upgrade the raw CMS signature with live DepositSign TSP + LTV
  const upgraded = await attachLtvToCms(rawCms, {
    content: contentBuf,
    tspUrl: DEPOSITSIGN_TSP,
    ocspUrl: DEPOSITSIGN_OCSP,
    box,
    addTimestampIfMissing: true,
  });

  assert.ok(
    upgraded.buffer.length > rawCms.length + 2000,
    `Expected LTV+TSP CMS (${upgraded.buffer.length}B) to be significantly larger than BES (${rawCms.length}B)`
  );
  assert.strictEqual(upgraded.hasCaChain, true, 'Expected hasCaChain === true');

  // Extract LTV material from the upgraded CMS (including TSP token's QTSP CA chain!)
  const mat = extractLtvMaterialFromCms(upgraded.buffer, box);
  assert.ok(
    mat.certsDer.length >= 2,
    `Expected at least 2 certificates (signer + QTSP TSP + CA chain), got ${mat.certsDer.length}`
  );
});

test('Scenario 4: CAdES (.p7s) signing with LTV + live QTSP TSP produces CAdES-LTA', () => {
  const docPath = path.join(WORK_DIR, 'scen4_cades_ltv.txt');
  const sigPath = `${docPath}.p7s`;
  fs.copyFileSync(SAMPLE_TXT, docPath);

  const res = runSign([
    '--key', KEY1_PATH,
    '--cert', CERT1_PATH,
    '--tsp-url', MONOBANK_TSP,
    '--ltv',
    '-o', sigPath,
    docPath,
  ]);
  assert.strictEqual(res.status, 0, `qes-sign failed: ${res.stderr}`);
  assert.ok(fs.existsSync(sigPath), 'Expected .p7s signature file');

  const verified = runVerifyJson(sigPath);
  assert.strictEqual(verified.length, 1);
  assert.ok(verified[0].signer_certs.length >= 1, 'Expected at least 1 signer certificate');
  assert.strictEqual(verified[0].has_tsp, true, 'Expected live TSP token');
  assert.strictEqual(verified[0].has_ca_chain, true, 'Expected embedded CA certificate chain');
  assert.strictEqual(verified[0].has_ltv, true, 'Expected has_ltv === true');
  assert.strictEqual(verified[0].signature_level, 'CAdES-LTA', 'Expected signature_level === CAdES-LTA');
});

test('Scenario 5: PAdES (.pdf) signing with LTV embeds PDF /DSS (/Certs, /OCSPs, /VRI) incrementally', () => {
  const outPdf = path.join(WORK_DIR, 'scen5_pades_lta.pdf');

  const res = runSign([
    '--pades',
    '--key', KEY1_PATH,
    '--cert', CERT1_PATH,
    '--tsp-url', DEPOSITSIGN_TSP,
    '--ltv',
    '-o', outPdf,
    SAMPLE_PDF,
  ]);
  assert.strictEqual(res.status, 0, `qes-sign --pades --ltv failed: ${res.stderr}`);
  assert.ok(fs.existsSync(outPdf), 'Expected signed PAdES-LTA PDF');

  // Verify raw PDF contains /DSS and /VRI incremental dictionaries
  const pdfLatin1 = fs.readFileSync(outPdf).toString('latin1');
  assert.ok(pdfLatin1.includes('/DSS'), 'Expected /DSS dictionary in signed PDF catalog');
  assert.ok(pdfLatin1.includes('/Certs'), 'Expected /Certs stream array in /DSS');
  assert.ok(pdfLatin1.includes('/VRI'), 'Expected /VRI validation-related info dictionary in /DSS');

  const verified = runVerifyJson(outPdf);
  assert.strictEqual(verified.length, 1);
  assert.ok(verified[0].signer_certs.length >= 1, 'Expected at least 1 signer certificate');
  assert.strictEqual(verified[0].has_tsp, true);
  assert.strictEqual(verified[0].has_pdf_dss, true, 'Expected qes-verify to detect PDF /DSS dictionary');
  assert.strictEqual(verified[0].has_ltv, true, 'Expected has_ltv === true');
  assert.strictEqual(verified[0].signature_level, 'PAdES-LTA', 'Expected signature_level === PAdES-LTA');
});

test('Scenario 6: Keyless archival upgrade (--upgrade-ltv / qes-tool ltv) upgrades .p7s, .pdf, and .asice without private key', () => {
  // 6a. Create a PAdES-BES PDF (--no-tsp --no-ltv)
  const besPdf = path.join(WORK_DIR, 'scen6_bes.pdf');
  const r1 = runSign([
    '--pades',
    '--key', KEY1_PATH,
    '--cert', CERT1_PATH,
    '--no-tsp',
    '--no-ltv',
    '-o', besPdf,
    SAMPLE_PDF,
  ]);
  assert.strictEqual(r1.status, 0, `Initial BES PDF sign failed: ${r1.stderr}`);

  const vBeforePdf = runVerifyJson(besPdf);
  assert.strictEqual(vBeforePdf[0].has_pdf_dss, false);
  assert.strictEqual(vBeforePdf[0].has_ltv, false);
  assert.strictEqual(vBeforePdf[0].signature_level, 'PAdES-BES');

  // Upgrade BES PDF to PAdES-LTA WITHOUT passing --key or password!
  const envNoKey = Object.assign({}, process.env, {
    PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
  });
  delete envNoKey.QES_PASSWORD;
  delete envNoKey.QES_KEY;

  const upPdfRes = spawnSync(
    process.execPath,
    [CLI_SIGN, '--upgrade-ltv', '--tsp-url', MONOBANK_TSP, besPdf],
    { cwd: WORK_DIR, env: envNoKey, encoding: 'utf-8', timeout: 60000 }
  );
  assert.strictEqual(upPdfRes.status, 0, `Keyless PDF --upgrade-ltv failed: ${upPdfRes.stderr}`);

  const vAfterPdf = runVerifyJson(besPdf);
  assert.ok(vAfterPdf[0].signer_certs.length >= 1);
  assert.strictEqual(vAfterPdf[0].has_pdf_dss, true, 'Expected /DSS embedded after --upgrade-ltv');
  assert.strictEqual(vAfterPdf[0].has_ltv, true, 'Expected has_ltv === true after --upgrade-ltv');
  assert.strictEqual(vAfterPdf[0].signature_level, 'PAdES-LTA');

  // 6b. Create a CAdES-BES .p7s (--no-tsp --no-ltv) and upgrade via `qes-tool ltv`
  const besTxt = path.join(WORK_DIR, 'scen6_bes.txt');
  const besP7s = `${besTxt}.p7s`;
  fs.copyFileSync(SAMPLE_TXT, besTxt);

  const r2 = runSign([
    '--key', KEY1_PATH,
    '--cert', CERT1_PATH,
    '--no-tsp',
    '--no-ltv',
    '-o', besP7s,
    besTxt,
  ]);
  assert.strictEqual(r2.status, 0);

  const vBeforeP7s = runVerifyJson(besP7s);
  assert.strictEqual(vBeforeP7s[0].has_ltv, false);
  assert.strictEqual(vBeforeP7s[0].signature_level, 'CAdES-BES');

  const upP7sRes = spawnSync(
    CLI_TOOL,
    ['ltv', '--tsp-url', DEPOSITSIGN_TSP, besP7s],
    { cwd: WORK_DIR, env: envNoKey, encoding: 'utf-8', timeout: 60000 }
  );
  assert.strictEqual(upP7sRes.status, 0, `qes-tool ltv failed on .p7s: ${upP7sRes.stderr}`);

  const vAfterP7s = runVerifyJson(besP7s);
  assert.ok(vAfterP7s[0].signer_certs.length >= 1);
  assert.strictEqual(vAfterP7s[0].has_tsp, true, 'Expected TSP added during keyless upgrade');
  assert.strictEqual(vAfterP7s[0].has_ltv, true, 'Expected LTV added during keyless upgrade');
  assert.strictEqual(vAfterP7s[0].signature_level, 'CAdES-LTA');

  // 6c. Create an ASiC-E container (--no-tsp --no-ltv) and upgrade via `--upgrade-ltv`
  const besAsice = path.join(WORK_DIR, 'scen6_bundle.asice');
  const r3 = runSign([
    '--asice',
    '--key', KEY1_PATH,
    '--cert', CERT1_PATH,
    '--no-tsp',
    '--no-ltv',
    '-o', besAsice,
    SAMPLE_TXT,
  ]);
  assert.strictEqual(r3.status, 0);

  const vBeforeAsice = runVerifyJson(besAsice);
  assert.strictEqual(vBeforeAsice[0].has_ltv, false);

  const upAsiceRes = spawnSync(
    process.execPath,
    [CLI_SIGN, '--upgrade-ltv', '--tsp-url', MONOBANK_TSP, besAsice],
    { cwd: WORK_DIR, env: envNoKey, encoding: 'utf-8', timeout: 60000 }
  );
  assert.strictEqual(upAsiceRes.status, 0, `Keyless ASiC-E --upgrade-ltv failed: ${upAsiceRes.stderr}`);

  const vAfterAsice = runVerifyJson(besAsice);
  assert.ok(vAfterAsice[0].signer_certs.length >= 1);
  assert.strictEqual(vAfterAsice[0].has_tsp, true);
  assert.strictEqual(vAfterAsice[0].has_ltv, true);
  assert.strictEqual(vAfterAsice[0].signature_level, 'CAdES-LTA');
});

test('Scenario 7: Negative control (--no-ltv) and graceful offline fallback when OCSP is unreachable', () => {
  // 7a. --no-ltv produces PAdES-T (has_tsp: true, has_pdf_dss: false)
  const noLtvPdf = path.join(WORK_DIR, 'scen7_no_ltv.pdf');
  const r1 = runSign([
    '--pades',
    '--key', KEY1_PATH,
    '--cert', CERT1_PATH,
    '--tsp-url', MONOBANK_TSP,
    '--no-ltv',
    '-o', noLtvPdf,
    SAMPLE_PDF,
  ]);
  assert.strictEqual(r1.status, 0);
  const v1 = runVerifyJson(noLtvPdf);
  assert.strictEqual(v1[0].has_tsp, true);
  assert.strictEqual(v1[0].has_pdf_dss, false, 'Expected no /DSS when --no-ltv is passed');
  assert.strictEqual(v1[0].signature_level, 'PAdES-T');

  // 7b. Unreachable OCSP URL (--ocsp-url http://127.0.0.1:59999/ocsp) falls back gracefully without crashing
  const fallbackTxt = path.join(WORK_DIR, 'scen7_fallback.txt');
  const fallbackSig = `${fallbackTxt}.p7s`;
  fs.copyFileSync(SAMPLE_TXT, fallbackTxt);

  const r2 = runSign([
    '--key', KEY1_PATH,
    '--cert', CERT1_PATH,
    '--tsp-url', MONOBANK_TSP,
    '--ocsp-url', 'http://127.0.0.1:59999/ocsp',
    '-o', fallbackSig,
    fallbackTxt,
  ]);
  assert.strictEqual(r2.status, 0, 'Expected signing to succeed even when OCSP endpoint is unreachable');
  assert.ok(fs.existsSync(fallbackSig));
});

test('Scenario 8: Nautilus script 15_upgrade_ltv.sh upgrades selected files seamlessly', () => {
  const nautPdf = path.join(WORK_DIR, 'scen8_nautilus.pdf');
  runSign([
    '--pades',
    '--key', KEY1_PATH,
    '--cert', CERT1_PATH,
    '--no-tsp',
    '--no-ltv',
    '-o', nautPdf,
    SAMPLE_PDF,
  ]);

  const script15 = path.join(PACKAGE_DIR, 'nautilus-scripts', '15_upgrade_ltv.sh');
  const env = Object.assign({}, process.env, {
    PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
    NAUTILUS_SCRIPT_SELECTED_FILE_PATHS: nautPdf,
  });

  const res = spawnSync('bash', [script15], {
    cwd: WORK_DIR,
    env,
    encoding: 'utf-8',
    timeout: 60000,
  });
  assert.strictEqual(res.status, 0, `15_upgrade_ltv.sh failed: ${res.stderr}`);

  const verified = runVerifyJson(nautPdf);
  assert.strictEqual(verified[0].has_pdf_dss, true);
  assert.strictEqual(verified[0].has_ltv, true);
  assert.strictEqual(verified[0].signature_level, 'PAdES-LTA');
});

test('Scenario 9: Official PDF Verification & Certificate Chain Protocol (--protocol & 16_pdf_protocol.sh)', () => {
  const signedPdf = path.join(WORK_DIR, 'scen9_protocol_doc.pdf');
  const rSign = runSign([
    '--pades',
    '--key', KEY1_PATH,
    '--cert', CERT1_PATH,
    '--tsp-url', DEPOSITSIGN_TSP,
    '--ltv',
    '-o', signedPdf,
    SAMPLE_PDF,
  ]);
  assert.strictEqual(rSign.status, 0, `Signing for Scenario 9 failed: ${rSign.stderr}`);

  // 9a. Verify JSON output contains cert_chain and file_sha256
  const verified = runVerifyJson(signedPdf);
  assert.strictEqual(verified.length, 1);
  assert.ok(Array.isArray(verified[0].cert_chain), 'Expected cert_chain array in verification result');
  assert.ok(verified[0].cert_chain.length >= 1, 'Expected at least 1 certificate in trust chain');
  assert.ok(verified[0].file_sha256 && verified[0].file_sha256.length === 64, 'Expected 64-char SHA-256 hex digest');

  // 9b. Generate PDF protocol via `qes-verify --protocol --lang ua` and `--lang en`
  const customProtocolUaPdf = path.join(WORK_DIR, 'scen9_custom_protocol_ua.pdf');
  const protoUaRes = spawnSync('python3', [CLI_VERIFY, '--protocol', '--lang', 'ua', '-o', customProtocolUaPdf, signedPdf], {
    cwd: WORK_DIR,
    encoding: 'utf-8',
    timeout: 60000,
  });
  assert.strictEqual(protoUaRes.status, 0, `qes-verify --protocol --lang ua failed: ${protoUaRes.stderr}`);
  assert.ok(fs.existsSync(customProtocolUaPdf), 'Expected UA protocol PDF to exist');
  const protoUaStat = fs.statSync(customProtocolUaPdf);
  assert.ok(protoUaStat.size > 5000, `Expected UA protocol PDF > 5 KB, got ${protoUaStat.size} bytes`);
  assert.strictEqual(fs.readFileSync(customProtocolUaPdf).subarray(0, 5).toString('ascii'), '%PDF-');

  const customProtocolEnPdf = path.join(WORK_DIR, 'scen9_custom_protocol_en.pdf');
  const protoEnRes = spawnSync('python3', [CLI_VERIFY, '--protocol', '--lang', 'en', '-o', customProtocolEnPdf, signedPdf], {
    cwd: WORK_DIR,
    encoding: 'utf-8',
    timeout: 60000,
  });
  assert.strictEqual(protoEnRes.status, 0, `qes-verify --protocol --lang en failed: ${protoEnRes.stderr}`);
  assert.ok(fs.existsSync(customProtocolEnPdf), 'Expected EN protocol PDF to exist');
  assert.ok(fs.statSync(customProtocolEnPdf).size > 5000);
  assert.strictEqual(fs.readFileSync(customProtocolEnPdf).subarray(0, 5).toString('ascii'), '%PDF-');

  // 9c. Generate PDF protocol via Nautilus script `16_pdf_protocol.sh`
  const script16 = path.join(PACKAGE_DIR, 'nautilus-scripts', '16_pdf_protocol.sh');
  const env = Object.assign({}, process.env, {
    PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
    NAUTILUS_SCRIPT_SELECTED_FILE_PATHS: signedPdf,
    DISPLAY: '',
    WAYLAND_DISPLAY: '',
  });
  const nautilusProtoRes = spawnSync('bash', [script16], {
    cwd: WORK_DIR,
    env,
    encoding: 'utf-8',
    timeout: 60000,
  });
  assert.strictEqual(nautilusProtoRes.status, 0, `16_pdf_protocol.sh failed: ${nautilusProtoRes.stderr}`);
  const autoProtocolPdf = path.join(WORK_DIR, 'scen9_protocol_doc_protocol.pdf');
  assert.ok(fs.existsSync(autoProtocolPdf), 'Expected <file>_protocol.pdf created by 16_pdf_protocol.sh');
  assert.ok(fs.statSync(autoProtocolPdf).size > 5000);
});
