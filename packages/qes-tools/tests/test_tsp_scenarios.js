/**
 * test_tsp_scenarios.js — Rigorous test suite for Qualified Electronic Signature (QES)
 * timestamping (TSP / RFC 3161) across all container formats and key types.
 *
 * Scenarios tested:
 * 1. Key 1 (PBES2 file key) + CAdES (.p7s detached) + Monobank QTSP
 * 2. Key 2 (IIT encrypted store key) + CAdES (.p7s detached) + DepositSign QTSP
 * 3. CAdES Negative Control: Signing with --no-tsp produces has_tsp === false
 * 4. PAdES (embedded PDF) with visual stamp + Monobank QTSP
 * 5. PAdES without visual stamp (--no-stamp) + DepositSign QTSP
 * 6. PAdES Multi-signature (--append) with 2 different keys & QTSPs (verifies both timestamps)
 * 7. ETSI ASiC-E archive container (.asice) + Monobank QTSP (verifies manifest + TSP)
 * 8. ASiC-E Multi-signature (--append) with 2 different keys & QTSPs
 * 9. CAdES Parallel Multi-signature (--append) with 2 different keys & QTSPs
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const jk = require('jkurwa');
const { getAlgos } = require('../src/adapter');

const PACKAGE_DIR = path.resolve(__dirname, '..');
const CLI_SIGN = path.join(PACKAGE_DIR, 'bin', 'qes-sign.js');
const CLI_VERIFY = path.join(PACKAGE_DIR, 'bin', 'qes-verify');
const DATA_DIR = path.join(PACKAGE_DIR, 'node_modules', 'jkurwa', 'test', 'data');

const MONOBANK_TSP = 'http://ca.monobank.ua/services/tsp/dstu/';
const DEPOSITSIGN_TSP = 'http://ca.depositsign.com/services/tsp/dstu/';

// Temporary working directory for test artifacts
const WORK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'qes-tsp-test-'));

// Key 1: PBES2 format key
const KEY1_PATH = path.join(WORK_DIR, 'key1_pbes2.pfx');
const CERT1_PATH = path.join(WORK_DIR, 'cert1.cer');
const KEY1_PASS = 'test_pass_123';

// Key 2: IIT format key
const KEY2_PATH = path.join(WORK_DIR, 'STORE_A040.dat');
const CERT2_PATH = path.join(WORK_DIR, 'SELF_SIGNED_ENC_40A0.cer');
const KEY2_PASS = 'password';

// Sample files
const SAMPLE_TXT = path.join(WORK_DIR, 'test_document.txt');
const SAMPLE_PDF = path.join(WORK_DIR, 'test_document.pdf');
const SAMPLE_ANNEX = path.join(WORK_DIR, 'annex.txt');

// Helper to create mock agent response for password prompts
const MOCK_BIN_DIR = path.join(WORK_DIR, 'mock_bin');
fs.mkdirSync(MOCK_BIN_DIR, { recursive: true });

function setupEnvironment() {
  const algo = getAlgos();

  // Create Key 1 (PBES2)
  const priv1Buf = fs.readFileSync(path.join(DATA_DIR, 'PRIV1.cer'));
  const priv1 = jk.Priv.from_asn1(priv1Buf);
  const protectedBuf = priv1.to_pbes2(KEY1_PASS, algo);
  fs.writeFileSync(KEY1_PATH, protectedBuf);
  fs.copyFileSync(path.join(DATA_DIR, 'SELF_SIGNED1.cer'), CERT1_PATH);

  // Copy Key 2 (IIT) and enable signing keyUsage on its certificate
  fs.copyFileSync(path.join(DATA_DIR, 'STORE_A040.dat'), KEY2_PATH);
  const rawCert2 = fs.readFileSync(path.join(DATA_DIR, 'SELF_SIGNED_ENC_40A0.cer'));
  const targetKu = Buffer.from([0x03, 0x02, 0x03, 0x08]);
  const idxKu = rawCert2.indexOf(targetKu);
  const patchedCert2 = Buffer.from(rawCert2);
  if (idxKu !== -1) {
    patchedCert2[idxKu + 2] = 0x01;
    patchedCert2[idxKu + 3] = 0xfe;
  }
  fs.writeFileSync(CERT2_PATH, patchedCert2);

  // Write sample text files
  fs.writeFileSync(SAMPLE_TXT, 'Тестовий процесуальний документ для перевірки мітки часу TSP (RFC 3161).\nВміст документа захищено електронним цифровим підписом.', 'utf-8');
  fs.writeFileSync(SAMPLE_ANNEX, 'Додаток №1 до договору про надання правничої допомоги.', 'utf-8');

  // Create mock qes-dialog that returns appropriate passwords without GUI
  const mockDialog = path.join(MOCK_BIN_DIR, 'qes-dialog');
  fs.writeFileSync(mockDialog, `#!/bin/bash
if [[ "$1" == "password" ]]; then
    # Inspect arguments to see which key or pass is requested
    if echo "$@" | grep -q "STORE_A040"; then
        echo '{"status": "ok", "password": "${KEY2_PASS}"}'
    else
        echo '{"status": "ok", "password": "${KEY1_PASS}"}'
    fi
    exit 0
fi
echo '{"status": "cancelled"}'
exit 1
`, { mode: 0o755 });

  // Create mock zenity as fallback
  const mockZenity = path.join(MOCK_BIN_DIR, 'zenity');
  fs.writeFileSync(mockZenity, `#!/bin/bash
if [[ "$*" == *"--password"* ]]; then
    echo "${KEY1_PASS}"
    exit 0
fi
exit 0
`, { mode: 0o755 });
}

async function createSamplePdf(outputPath) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText('UKRAINIAN QUALIFIED ELECTRONIC SIGNATURE (QES / KEP) TEST', {
    x: 50,
    y: 780,
    size: 14,
    font,
    color: rgb(0.1, 0.4, 0.2),
  });
  page.drawText('Document ID: TEST-QES-TSP-2026', {
    x: 50,
    y: 750,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawText('This document is signed with cryptographic timestamp token (RFC 3161).', {
    x: 50,
    y: 720,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

function verifyFileJson(filePath) {
  const res = spawnSync(CLI_VERIFY, ['-j', filePath], {
    encoding: 'utf-8',
    env: { ...process.env, PATH: `${MOCK_BIN_DIR}:${process.env.PATH}` },
  });
  assert.strictEqual(res.status, 0, `qes-verify failed on ${filePath}: ${res.stderr || res.stdout}`);
  const parsed = JSON.parse(res.stdout);
  assert.ok(Array.isArray(parsed) && parsed.length > 0, `qes-verify returned empty array for ${filePath}`);
  return parsed;
}

function assertValidTimestamp(tspTimeStr, toleranceMinutes = 10) {
  assert.ok(tspTimeStr, 'Timestamp (tsp_time) must not be empty');
  const tspDate = new Date(tspTimeStr);
  assert.ok(!isNaN(tspDate.getTime()), `Invalid ISO timestamp: ${tspTimeStr}`);
  
  const now = Date.now();
  const diffMs = Math.abs(now - tspDate.getTime());
  const maxDiffMs = toleranceMinutes * 60 * 1000;
  assert.ok(
    diffMs <= maxDiffMs,
    `Timestamp ${tspTimeStr} is off by ${Math.round(diffMs / 1000)}s from system time (max allowed: ${toleranceMinutes}m)`
  );
}

test.before(async () => {
  setupEnvironment();
  await createSamplePdf(SAMPLE_PDF);
});

test.after(() => {
  try {
    fs.rmSync(WORK_DIR, { recursive: true, force: true });
  } catch (_) {}
});

// 1. SCENARIO 1: CAdES (.p7s detached) with Key 1 + Monobank TSP
test('Scenario 1: CAdES (.p7s detached) with PBES2 key and live Monobank TSP', () => {
  const p7sOut = path.join(WORK_DIR, 'doc_key1_mono.p7s');
  const res = spawnSync('node', [
    CLI_SIGN,
    '--key', KEY1_PATH,
    '--cert', CERT1_PATH,
    '--tsp-url', MONOBANK_TSP,
    '-o', p7sOut,
    SAMPLE_TXT,
  ], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
      QES_PASSWORD: KEY1_PASS,
    },
  });

  assert.strictEqual(res.status, 0, `Signing failed: ${res.stderr || res.stdout}`);
  assert.ok(fs.existsSync(p7sOut), 'Output .p7s file must exist');

  const verification = verifyFileJson(p7sOut);
  assert.strictEqual(verification[0].container_format, 'PKCS#7 / CAdES (.p7s)');
  assert.strictEqual(verification[0].has_tsp, true, 'has_tsp must be true');
  assertValidTimestamp(verification[0].tsp_time);

  // Inspect raw ASN.1 DER with openssl to prove cryptographic timeStampToken presence
  const asnRes = spawnSync('openssl', ['asn1parse', '-inform', 'DER', '-in', p7sOut], { encoding: 'utf-8' });
  assert.strictEqual(asnRes.status, 0);
  assert.match(asnRes.stdout, /id-smime-aa-timeStampToken/);
  assert.match(asnRes.stdout, /id-smime-ct-TSTInfo/);
});

// 2. SCENARIO 2: CAdES (.p7s detached) with Key 2 (IIT) + DepositSign TSP
test('Scenario 2: CAdES (.p7s detached) with IIT encrypted key and live DepositSign TSP', () => {
  const p7sOut = path.join(WORK_DIR, 'doc_key2_depositsign.p7s');
  const res = spawnSync('node', [
    CLI_SIGN,
    '--key', KEY2_PATH,
    '--cert', CERT2_PATH,
    '--tsp-url', DEPOSITSIGN_TSP,
    '-o', p7sOut,
    SAMPLE_TXT,
  ], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
      QES_PASSWORD: KEY2_PASS,
    },
  });

  assert.strictEqual(res.status, 0, `Signing failed: ${res.stderr || res.stdout}`);
  assert.ok(fs.existsSync(p7sOut), 'Output .p7s file must exist');

  const verification = verifyFileJson(p7sOut);
  assert.strictEqual(verification[0].container_format, 'PKCS#7 / CAdES (.p7s)');
  assert.strictEqual(verification[0].has_tsp, true, 'has_tsp must be true');
  assertValidTimestamp(verification[0].tsp_time);
});

// 3. SCENARIO 3: Negative Control (--no-tsp)
test('Scenario 3: Negative control (--no-tsp) confirms timestamp is omitted when disabled', () => {
  const p7sOut = path.join(WORK_DIR, 'doc_no_tsp.p7s');
  const res = spawnSync('node', [
    CLI_SIGN,
    '--key', KEY1_PATH,
    '--cert', CERT1_PATH,
    '--no-tsp',
    '-o', p7sOut,
    SAMPLE_TXT,
  ], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
      QES_PASSWORD: KEY1_PASS,
    },
  });

  assert.strictEqual(res.status, 0, `Signing failed: ${res.stderr || res.stdout}`);
  const verification = verifyFileJson(p7sOut);
  assert.strictEqual(verification[0].has_tsp, false, 'has_tsp must be false');
  assert.strictEqual(verification[0].tsp_time, null, 'tsp_time must be null');
});

// 4. SCENARIO 4: PAdES (embedded PDF) with visual stamp + Monobank TSP
test('Scenario 4: PAdES embedded PDF signature with visual stamp and Monobank TSP', () => {
  const pdfOut = path.join(WORK_DIR, 'contract_signed_pades.pdf');
  const res = spawnSync('node', [
    CLI_SIGN,
    '--pades',
    '--key', KEY1_PATH,
    '--cert', CERT1_PATH,
    '--tsp-url', MONOBANK_TSP,
    '-o', pdfOut,
    SAMPLE_PDF,
  ], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
      QES_PASSWORD: KEY1_PASS,
    },
  });

  assert.strictEqual(res.status, 0, `PAdES signing failed: ${res.stderr || res.stdout}`);
  assert.ok(fs.existsSync(pdfOut), 'Signed PDF must exist');

  const verification = verifyFileJson(pdfOut);
  assert.strictEqual(verification.length, 1);
  assert.strictEqual(verification[0].container_format, 'PAdES (PDF Embedded Signature)');
  assert.strictEqual(verification[0].has_tsp, true, 'PAdES signature must contain valid TSP');
  assertValidTimestamp(verification[0].tsp_time);
});

// 5. SCENARIO 5: PAdES without visual stamp (--no-stamp) + DepositSign TSP
test('Scenario 5: PAdES without visual stamp (--no-stamp) with DepositSign TSP', () => {
  const pdfOut = path.join(WORK_DIR, 'contract_nostamp_pades.pdf');
  const res = spawnSync('node', [
    CLI_SIGN,
    '--pades',
    '--no-stamp',
    '--key', KEY2_PATH,
    '--cert', CERT2_PATH,
    '--tsp-url', DEPOSITSIGN_TSP,
    '-o', pdfOut,
    SAMPLE_PDF,
  ], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
      QES_PASSWORD: KEY2_PASS,
    },
  });

  assert.strictEqual(res.status, 0, `PAdES no-stamp failed: ${res.stderr || res.stdout}`);
  const verification = verifyFileJson(pdfOut);
  assert.strictEqual(verification.length, 1);
  assert.strictEqual(verification[0].has_tsp, true);
  assertValidTimestamp(verification[0].tsp_time);
});

// 6. SCENARIO 6: PAdES Multi-signature (--append) with 2 different keys & TSP
test('Scenario 6: PAdES Multi-signature (--append) with two distinct keys, verifying both TSP timestamps', () => {
  // First signature: Key 1 + Monobank TSP
  const step1Pdf = path.join(WORK_DIR, 'multisig_step1.pdf');
  const res1 = spawnSync('node', [
    CLI_SIGN,
    '--pades',
    '--key', KEY1_PATH,
    '--cert', CERT1_PATH,
    '--tsp-url', MONOBANK_TSP,
    '-o', step1Pdf,
    SAMPLE_PDF,
  ], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
      QES_PASSWORD: KEY1_PASS,
    },
  });
  assert.strictEqual(res1.status, 0, `Step 1 failed: ${res1.stderr || res1.stdout}`);

  // Second signature: Key 2 + DepositSign TSP
  const multiPdf = path.join(WORK_DIR, 'multisig_step2.pdf');
  const res2 = spawnSync('node', [
    CLI_SIGN,
    '--pades',
    '--append',
    '--key', KEY2_PATH,
    '--cert', CERT2_PATH,
    '--tsp-url', DEPOSITSIGN_TSP,
    '-o', multiPdf,
    step1Pdf,
  ], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
      QES_PASSWORD: KEY2_PASS,
    },
  });
  assert.strictEqual(res2.status, 0, `Step 2 failed: ${res2.stderr || res2.stdout}`);

  // Verification of multi-signed PDF
  const verification = verifyFileJson(multiPdf);
  assert.strictEqual(verification.length, 2, 'Must detect exactly 2 signatures');
  
  // Both signatures must have independent valid TSP tokens
  assert.strictEqual(verification[0].has_tsp, true, 'Signature #1 must have TSP');
  assertValidTimestamp(verification[0].tsp_time);

  assert.strictEqual(verification[1].has_tsp, true, 'Signature #2 must have TSP');
  assertValidTimestamp(verification[1].tsp_time);
});

// 7. SCENARIO 7: ETSI ASiC-E archive container (.asice) + Monobank TSP
test('Scenario 7: ETSI ASiC-E package container (.asice) with live Monobank TSP', () => {
  const asiceOut = path.join(WORK_DIR, 'case_files.asice');
  const res = spawnSync('node', [
    CLI_SIGN,
    '--asice',
    '--key', KEY1_PATH,
    '--cert', CERT1_PATH,
    '--tsp-url', MONOBANK_TSP,
    '-o', asiceOut,
    SAMPLE_TXT,
    SAMPLE_ANNEX,
  ], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
      QES_PASSWORD: KEY1_PASS,
    },
  });

  assert.strictEqual(res.status, 0, `ASiC-E creation failed: ${res.stderr || res.stdout}`);
  assert.ok(fs.existsSync(asiceOut), 'ASiC-E archive must exist');

  const verification = verifyFileJson(asiceOut);
  assert.strictEqual(verification.length, 1);
  assert.strictEqual(verification[0].manifest_verified, true, 'Manifest checksums must match');
  assert.strictEqual(verification[0].has_tsp, true, 'ASiC-E signature must have TSP');
  assertValidTimestamp(verification[0].tsp_time);
  assert.strictEqual(verification[0].signed_files.length, 2);
});

// 8. SCENARIO 8: ASiC-E Multi-signature (--append) with 2 different keys & TSP
test('Scenario 8: ASiC-E Multi-signature (--append) appends second signature with DepositSign TSP', () => {
  const asice1 = path.join(WORK_DIR, 'asice_multi_1.asice');
  const res1 = spawnSync('node', [
    CLI_SIGN,
    '--asice',
    '--key', KEY1_PATH,
    '--cert', CERT1_PATH,
    '--tsp-url', MONOBANK_TSP,
    '-o', asice1,
    SAMPLE_TXT,
  ], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
      QES_PASSWORD: KEY1_PASS,
    },
  });
  assert.strictEqual(res1.status, 0);

  const asice2 = path.join(WORK_DIR, 'asice_multi_2.asice');
  const res2 = spawnSync('node', [
    CLI_SIGN,
    '--append',
    '--key', KEY2_PATH,
    '--cert', CERT2_PATH,
    '--tsp-url', DEPOSITSIGN_TSP,
    '-o', asice2,
    asice1,
  ], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
      QES_PASSWORD: KEY2_PASS,
    },
  });
  assert.strictEqual(res2.status, 0, `ASiC-E append failed: ${res2.stderr || res2.stdout}`);

  const verification = verifyFileJson(asice2);
  assert.strictEqual(verification.length, 2, 'ASiC-E must contain 2 signatures');
  assert.strictEqual(verification[0].has_tsp, true, 'Sig #1 has TSP');
  assertValidTimestamp(verification[0].tsp_time);
  assert.strictEqual(verification[1].has_tsp, true, 'Sig #2 has TSP');
  assertValidTimestamp(verification[1].tsp_time);
});

// 9. SCENARIO 9: CAdES Parallel Multi-signature (--append) with 2 different keys & TSP
test('Scenario 9: CAdES Parallel Multi-signature merges two signers in one .p7s with valid TSP', () => {
  const p7s1 = path.join(WORK_DIR, 'cades_multi_1.p7s');
  const res1 = spawnSync('node', [
    CLI_SIGN,
    '--key', KEY1_PATH,
    '--cert', CERT1_PATH,
    '--tsp-url', MONOBANK_TSP,
    '-o', p7s1,
    SAMPLE_TXT,
  ], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
      QES_PASSWORD: KEY1_PASS,
    },
  });
  assert.strictEqual(res1.status, 0);

  const p7s2 = path.join(WORK_DIR, 'cades_multi_2.p7s');
  const res2 = spawnSync('node', [
    CLI_SIGN,
    '--append',
    '--key', KEY2_PATH,
    '--cert', CERT2_PATH,
    '--tsp-url', DEPOSITSIGN_TSP,
    '-o', p7s2,
    p7s1,
  ], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      PATH: `${MOCK_BIN_DIR}:${process.env.PATH}`,
      QES_PASSWORD: KEY2_PASS,
    },
  });
  assert.strictEqual(res2.status, 0, `CAdES append failed: ${res2.stderr || res2.stdout}`);

  const verification = verifyFileJson(p7s2);
  assert.strictEqual(verification[0].container_format, 'PKCS#7 / CAdES (.p7s)');
  assert.strictEqual(verification[0].signer_certs.length, 2, 'Must contain 2 signer certificates');
  assert.strictEqual(verification[0].has_tsp, true, 'Multi-signer CAdES must retain valid TSP');
  assertValidTimestamp(verification[0].tsp_time);
});
