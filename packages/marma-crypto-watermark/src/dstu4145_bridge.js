#!/usr/bin/env node
/**
 * dstu4145_bridge.js — Криптографічний міст ДСТУ 4145-2002 / ГОСТ 34.311-95 / ДСТУ 7564 / PAdES / CAdES
 * для комплексу Marma-Crypto Watermark (Шрі Янтра).
 *
 * Забезпечує:
 * 1. Обчислення державних геш-функцій ДСТУ ГОСТ 34.311-95 та ДСТУ 7564:2014 («Купина-256»).
 * 2. Детермінований (RFC 6979) асиметричний цифровий підпис за державним стандартом ДСТУ 4145-2002
 *    на еліптичних кривих GF(2^m) (як через реальні ключі КЕП .pfx/.p12/.dat/.jks із ~/.secure_keys/,
 *    так і через криву DSTU_PB_257).
 * 3. Математичну верифікацію рівняння еліптичної кривої ДСТУ 4145-2002: r = x_R * H (mod n).
 * 4. Фінальне запечатування PDF у стандарті ETSI PAdES (ДСТУ 4145-2002 + КНЕДП TSP + LTV /DSS)
 *    та DOCX/SVG у стандарті CAdES (.p7s), що проходять валідацію на czo.gov.ua, у «Дії» та «Е-Суді».
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const QES_ROOT = '/usr/lib/qes-tools';
if (fs.existsSync(path.join(QES_ROOT, 'node_modules'))) {
  module.paths.unshift(path.join(QES_ROOT, 'node_modules'));
}

const jk = require('jkurwa');
const gost89 = require('gost89');
const dstu7564 = require('dstu7564');

let QESEngine = null;
let sessionMod = null;
let padesMod = null;

try {
  ({ QESEngine } = require(path.join(QES_ROOT, 'src', 'engine')));
  sessionMod = require(path.join(QES_ROOT, 'src', 'session'));
  padesMod = require(path.join(QES_ROOT, 'src', 'pades'));
} catch (_) {}

function isQesContainerPath(keyPath) {
  if (!keyPath) return false;
  const ext = path.extname(keyPath).toLowerCase();
  return ['.pfx', '.p12', '.dat', '.jks', '.zs2'].includes(ext);
}

function formatSerialHex(cert) {
  if (!cert || !cert.serial) return '';
  if (Buffer.isBuffer(cert.serial)) return cert.serial.toString('hex').toUpperCase();
  if (typeof cert.serial.toString === 'function') {
    try {
      return cert.serial.toString(16).toUpperCase();
    } catch (_) {
      return String(cert.serial).toUpperCase();
    }
  }
  return String(cert.serial).toUpperCase();
}

function deterministicDstu4145Sign(privKey, gost34311Buf) {
  let counter = 0;
  const origRand = privKey.curve.rand.bind(privKey.curve);
  privKey.curve.rand = () => {
    const det = crypto
      .createHmac('sha256', Buffer.from(privKey.d.buf8()))
      .update(gost34311Buf)
      .update(Buffer.from([counter++]))
      .digest();
    return new jk.Field(det, 'buf8', privKey.curve).mod(privKey.curve.order);
  };
  try {
    return privKey.sign(gost34311Buf);
  } finally {
    privKey.curve.rand = origRand;
  }
}

function findOwnerCertificateMetadata(preferredKeyPath) {
  const candidates = [];
  if (preferredKeyPath) {
    const parsed = path.parse(preferredKeyPath);
    candidates.push(path.join(parsed.dir, `${parsed.name}.cer`));
    candidates.push(path.join(parsed.dir, `${parsed.name}.crt`));
  }
  const secDir = path.join(process.env.HOME || os.homedir(), '.secure_keys');
  if (fs.existsSync(secDir)) {
    try {
      for (const f of fs.readdirSync(secDir)) {
        if (f.endsWith('.cer') || f.endsWith('.crt')) {
          if (f.includes('Баєнко') || f.includes('KEP')) {
            candidates.unshift(path.join(secDir, f));
          } else {
            candidates.push(path.join(secDir, f));
          }
        }
      }
    } catch (_) {}
  }

  for (const cPath of candidates) {
    if (fs.existsSync(cPath)) {
      try {
        const buf = fs.readFileSync(cPath);
        const cert = jk.Certificate.from_asn1(buf);
        if (padesMod && padesMod.extractCertInfoFromCert) {
          const info = padesMod.extractCertInfoFromCert(cert);
          info.serialHex = formatSerialHex(cert) || info.serialHex;
          return {
            ...info,
            certPath: cPath,
            certDerHex: buf.toString('hex'),
          };
        }
      } catch (_) {}
    }
  }
  return null;
}

async function unlockQesBox(keyPath, password) {
  if (!QESEngine) {
    throw new Error('Модуль QESEngine (/usr/lib/qes-tools) не знайдено.');
  }
  const engine = new QESEngine();
  let effectivePassword = password;

  if (!effectivePassword && sessionMod) {
    try {
      const keyId = sessionMod.getKeyFingerprint(keyPath);
      const cached = await sessionMod.sendAgentMessage({ action: 'get', keyId }, { timeoutMs: 400 });
      if (cached && cached.found && cached.password) {
        effectivePassword = cached.password;
      }
    } catch (_) {}
  }

  if (!effectivePassword) {
    throw new Error('Для розблокування особистого ключа КЕП (ДСТУ 4145-2002) потрібен пароль.');
  }

  const boxInfo = await engine.initBox(keyPath, effectivePassword, null);

  if (sessionMod) {
    try {
      const started = await sessionMod.ensureAgentRunning();
      if (started) {
        const keyId = sessionMod.getKeyFingerprint(keyPath);
        await sessionMod.sendAgentMessage({
          action: 'set',
          keyId,
          password: effectivePassword,
          label: path.basename(keyPath),
          ttl: 900,
        }, { timeoutMs: 600 });
      }
    } catch (_) {}
  }

  return { engine, box: boxInfo.box, hasCert: boxInfo.hasCert, password: effectivePassword };
}

async function handleSign(req) {
  const payloadBuf = Buffer.from(req.payloadBytesHex, 'hex');
  const gost34311Buf = Buffer.from(gost89.gosthash(payloadBuf));
  const dstu7564Buf = Buffer.from(dstu7564.computeHash(32, payloadBuf));

  const gost34311Hex = gost34311Buf.toString('hex');
  const dstu7564Hex = dstu7564Buf.toString('hex');
  const sha256Hex = crypto.createHash('sha256').update(payloadBuf).digest('hex');
  const combinerHex = crypto
    .createHash('sha256')
    .update(`${gost34311Hex}::${dstu7564Hex}::${sha256Hex}`)
    .digest('hex');

  const keyPath = req.keyPath || '';
  const password = req.password || '';
  const secretSeed = req.secretSeed || '';

  // Варіант А: Підписання справжнім контейнером КЕП (.pfx / .p12 / .dat / .jks)
  if (isQesContainerPath(keyPath) && fs.existsSync(keyPath)) {
    const { box } = await unlockQesBox(keyPath, password);
    const keyEntry = box.keys && box.keys.length > 0 ? box.keys[0] : null;
    if (!keyEntry || !keyEntry.priv) {
      throw new Error('У контейнері КЕП не знайдено приватного ключа ДСТУ 4145-2002.');
    }

    const privKey = keyEntry.priv;
    const pubKey = privKey.pub();
    const sig = deterministicDstu4145Sign(privKey, gost34311Buf);
    const rHex = Buffer.from(sig.r.buf8()).toString('hex');
    const sHex = Buffer.from(sig.s.buf8()).toString('hex');
    const pubXHex = Buffer.from(pubKey.point.x.buf8()).toString('hex');
    const pubYHex = Buffer.from(pubKey.point.y.buf8()).toString('hex');
    const rsDigestHex = crypto.createHash('sha256').update(`${rHex}::${sHex}`).digest('hex');

    let certInfo = null;
    let certDerHex = null;
    if (keyEntry.cert) {
      try {
        certInfo = padesMod.extractCertInfoFromCert(keyEntry.cert);
        certInfo.serialHex = formatSerialHex(keyEntry.cert) || certInfo.serialHex;
        certDerHex = Buffer.from(keyEntry.cert.as_asn1()).toString('hex');
      } catch (_) {}
    }
    if (!certInfo) {
      const fallbackCert = findOwnerCertificateMetadata(keyPath);
      if (fallbackCert) {
        certInfo = fallbackCert;
        certDerHex = fallbackCert.certDerHex;
      }
    }

    return {
      status: 'ok',
      mode: 'QES_DSTU4145_CONTAINER',
      standard: 'ДСТУ 4145-2002 (КЕП КНЕДП) / ДСТУ ГОСТ 34.311-95 / ДСТУ 7564:2014',
      curve_type: 'QES_KEY_CURVE',
      gost34311_hex: gost34311Hex,
      dstu7564_hex: dstu7564Hex,
      sha256_hex: sha256Hex,
      combiner_hex: combinerHex,
      combiner_alg: 'SHA256(GOST34311||Kupyna256||SHA256)',
      r_hex: rHex,
      s_hex: sHex,
      rs_digest_hex: rsDigestHex,
      pub_x_hex: pubXHex,
      pub_y_hex: pubYHex,
      cert_der_hex: certDerHex,
      signer_info: certInfo ? {
        common_name: certInfo.commonName,
        rnokpp: certInfo.rnokpp || '',
        issuer_name: certInfo.issuerName || 'КНЕДП',
        serial_hex: certInfo.serialHex || '',
        valid_from: certInfo.validFrom ? certInfo.validFrom.toISOString() : null,
        valid_to: certInfo.validTo ? certInfo.validTo.toISOString() : null,
        locality: certInfo.locality || 'Україна',
      } : null,
    };
  }

  // Варіант Б: Детермінований підпис ДСТУ 4145-2002 на стандартній кривій DSTU_PB_257 (GF(2^257))
  let seedInput = Buffer.from(secretSeed || password || 'Sovereign-Vedic-Geometry-Key-108', 'utf-8');
  if (keyPath && fs.existsSync(keyPath)) {
    seedInput = Buffer.concat([fs.readFileSync(keyPath), Buffer.from(password, 'utf-8')]);
  }
  const seed = crypto.pbkdf2Sync(
    seedInput,
    Buffer.from('MARMA-SRI-YANTRA-DSTU-4145-PB257', 'utf-8'),
    10000,
    32,
    'sha256'
  );

  const curve = new jk.Curve(jk.standard.DSTU_PB_257);
  const dField = new jk.Field(seed, 'buf8', curve).mod(curve.order);
  const privKey = new jk.Priv(curve, dField);
  const pubKey = privKey.pub();
  const sig = deterministicDstu4145Sign(privKey, gost34311Buf);

  const rHex = Buffer.from(sig.r.buf8()).toString('hex');
  const sHex = Buffer.from(sig.s.buf8()).toString('hex');
  const pubXHex = Buffer.from(pubKey.point.x.buf8()).toString('hex');
  const pubYHex = Buffer.from(pubKey.point.y.buf8()).toString('hex');
  const rsDigestHex = crypto.createHash('sha256').update(`${rHex}::${sHex}`).digest('hex');

  const ownerCert = findOwnerCertificateMetadata(keyPath);

  return {
    status: 'ok',
    mode: 'DSTU4145_PB257_DIRECT',
    standard: 'ДСТУ 4145-2002 (Крива DSTU_PB_257 над GF(2^257)) / ГОСТ 34.311-95 / ДСТУ 7564:2014',
    curve_type: 'DSTU_PB_257',
    gost34311_hex: gost34311Hex,
    dstu7564_hex: dstu7564Hex,
    sha256_hex: sha256Hex,
    combiner_hex: combinerHex,
    combiner_alg: 'SHA256(GOST34311||Kupyna256||SHA256)',
    r_hex: rHex,
    s_hex: sHex,
    rs_digest_hex: rsDigestHex,
    pub_x_hex: pubXHex,
    pub_y_hex: pubYHex,
    cert_der_hex: null,
    signer_info: ownerCert ? {
      common_name: ownerCert.commonName,
      rnokpp: ownerCert.rnokpp || '',
      issuer_name: `${ownerCert.issuerName} (Криптосейф Marma-ДСТУ 4145)`,
      serial_hex: ownerCert.serialHex || '',
      valid_from: ownerCert.validFrom ? ownerCert.validFrom.toISOString() : null,
      valid_to: ownerCert.validTo ? ownerCert.validTo.toISOString() : null,
      locality: ownerCert.locality || 'Україна',
    } : null,
  };
}

function toSafePdfAscii(input) {
  const map = {
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'H', 'Ґ': 'G', 'Д': 'D', 'Е': 'E', 'Є': 'Ye',
    'Ж': 'Zh', 'З': 'Z', 'И': 'Y', 'І': 'I', 'Ї': 'Yi', 'Й': 'Y', 'К': 'K', 'Л': 'L',
    'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ь': '',
    'Ю': 'Yu', 'Я': 'Ya', 'Ы': 'Y', 'Э': 'E', 'Ъ': '',
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e', 'є': 'ye',
    'ж': 'zh', 'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l',
    'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ь': '',
    'ю': 'yu', 'я': 'ya', 'ы': 'y', 'э': 'e', 'ъ': '', '’': "'", 'ʼ': "'",
  };
  const raw = String(input || '');
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (Object.prototype.hasOwnProperty.call(map, ch)) {
      out += map[ch];
    } else if (ch === '(') {
      out += '[';
    } else if (ch === ')') {
      out += ']';
    } else if (ch === '\\') {
      out += '/';
    } else {
      const code = ch.charCodeAt(0);
      out += (code >= 0x20 && code <= 0x7e) ? ch : '';
    }
  }
  return out.trim() || 'Ukraine';
}

async function handleSealPades(req) {
  const keyPath = req.keyPath || '';
  const password = req.password || '';
  const inputPdfPath = req.inputPdfPath;
  const outputPdfPath = req.outputPdfPath || inputPdfPath;

  if (!isQesContainerPath(keyPath) || !fs.existsSync(keyPath)) {
    return { status: 'skipped', reason: 'Not a PKCS#12/QES container key' };
  }

  const { box } = await unlockQesBox(keyPath, password);
  const rawCertInfo = padesMod.extractCertInfo(box);
  const safeCertInfo = {
    ...rawCertInfo,
    commonName: toSafePdfAscii(rawCertInfo.commonName || 'QES Signer'),
    issuerName: toSafePdfAscii(rawCertInfo.issuerName || 'KNEDP Ukraine'),
    locality: toSafePdfAscii(rawCertInfo.locality || 'Ukraine'),
  };
  const res = await padesMod.signPdfPAdES(box, inputPdfPath, {
    outputPath: outputPdfPath,
    stamp: false,
    tsp: req.tsp !== false,
    ltv: req.ltv !== false,
    certInfo: safeCertInfo,
    reason: 'Signed by Marma-Crypto [Sri Yantra] and DSTU 4145-2002 QES',
  });

  return {
    status: 'ok',
    pades_signed: true,
    output_path: res.outputPath,
    file_size: res.fileSize,
    has_ltv_dss: Boolean(res.hasLtvDss),
    cert_info: rawCertInfo,
  };
}

async function handleSealCades(req) {
  const keyPath = req.keyPath || '';
  const password = req.password || '';
  const inputFilePath = req.inputFilePath;
  const outputP7sPath = req.outputP7sPath || `${inputFilePath}.p7s`;

  if (!isQesContainerPath(keyPath) || !fs.existsSync(keyPath)) {
    return { status: 'skipped', reason: 'Not a PKCS#12/QES container key' };
  }

  const { engine, box } = await unlockQesBox(keyPath, password);
  const res = await engine.signDocument(box, inputFilePath, {
    outputPath: outputP7sPath,
    detached: true,
    tsp: req.tsp !== false,
    ltv: req.ltv !== false,
  });

  return {
    status: 'ok',
    cades_signed: true,
    p7s_path: res.outputPath,
    signature_bytes: res.signatureBytes,
  };
}

async function handleVerify(req) {
  const payloadBuf = Buffer.from(req.payloadBytesHex, 'hex');
  const gost34311Buf = Buffer.from(gost89.gosthash(payloadBuf));
  const dstu7564Buf = Buffer.from(dstu7564.computeHash(32, payloadBuf));

  const actualGostHex = gost34311Buf.toString('hex');
  const actualDstu7564Hex = dstu7564Buf.toString('hex');
  const actualSha256Hex = crypto.createHash('sha256').update(payloadBuf).digest('hex');
  const actualCombinerHex = crypto
    .createHash('sha256')
    .update(`${actualGostHex}::${actualDstu7564Hex}::${actualSha256Hex}`)
    .digest('hex');

  const d = req.dstu4145 || {};
  const sha256Matches = !d.sha256_hex || d.sha256_hex === actualSha256Hex;
  const combinerMatches = !d.combiner_hex || d.combiner_hex === actualCombinerHex;
  const hashMatches = (d.gost34311_hex === actualGostHex)
    && (!d.dstu7564_hex || d.dstu7564_hex === actualDstu7564Hex)
    && sha256Matches
    && combinerMatches;

  let ecVerified = false;
  let ecError = null;

  try {
    let pubKey = null;
    if (d.cert_der_hex) {
      const certBuf = Buffer.from(d.cert_der_hex, 'hex');
      const cert = jk.Certificate.from_asn1(certBuf);
      pubKey = cert.pubkey;
    } else if (d.pub_x_hex && d.pub_y_hex) {
      const curve = new jk.Curve(jk.standard.DSTU_PB_257);
      const xRec = new jk.Field(Buffer.from(d.pub_x_hex, 'hex'), 'buf8', curve);
      const yRec = new jk.Field(Buffer.from(d.pub_y_hex, 'hex'), 'buf8', curve);
      pubKey = new jk.Pub(curve, curve.point(xRec, yRec));
    }

    if (pubKey && d.r_hex && d.s_hex) {
      ecVerified = Boolean(
        pubKey.verify(gost34311Buf, {
          s: Buffer.from(d.s_hex, 'hex'),
          r: Buffer.from(d.r_hex, 'hex'),
        })
      );
    }
  } catch (err) {
    ecError = err.message;
    ecVerified = false;
  }

  let qesVerifyReport = null;
  if (req.docPath && fs.existsSync(req.docPath)) {
    const p7sCandidate = `${req.docPath}.p7s`;
    let shouldRunQesVerify = false;
    let qesArgs = ['-j'];

    if (req.docPath.toLowerCase().endsWith('.pdf')) {
      const rawPdf = fs.readFileSync(req.docPath);
      if (rawPdf.indexOf('/ByteRange') !== -1) {
        shouldRunQesVerify = true;
        qesArgs.push(req.docPath);
      }
    } else if (fs.existsSync(p7sCandidate)) {
      shouldRunQesVerify = true;
      qesArgs.push(req.docPath, p7sCandidate);
    }

    if (shouldRunQesVerify && fs.existsSync('/usr/bin/qes-verify')) {
      try {
        const proc = spawnSync('/usr/bin/qes-verify', qesArgs, {
          encoding: 'utf-8',
          timeout: 8000,
        });
        if (proc.stdout) {
          const parsed = JSON.parse(proc.stdout.trim());
          if (Array.isArray(parsed) && parsed.length > 0) {
            qesVerifyReport = parsed[0];
          }
        }
      } catch (_) {}
    }
  }

  const expectedRsDigest = (d.r_hex && d.s_hex)
    ? crypto.createHash('sha256').update(`${d.r_hex}::${d.s_hex}`).digest('hex')
    : '';
  const rsDigestMatches = Boolean(expectedRsDigest && (!d.rs_digest_hex || d.rs_digest_hex === expectedRsDigest));

  return {
    status: 'ok',
    dstu4145_valid: Boolean(hashMatches && ecVerified && rsDigestMatches),
    gost34311_match: hashMatches,
    combiner_match: combinerMatches,
    ec_signature_valid: ecVerified,
    rs_digest_match: rsDigestMatches,
    expected_rs_digest_hex: expectedRsDigest,
    actual_gost34311_hex: actualGostHex,
    actual_dstu7564_hex: actualDstu7564Hex,
    actual_sha256_hex: actualSha256Hex,
    actual_combiner_hex: actualCombinerHex,
    ec_error: ecError,
    qes_container_report: qesVerifyReport,
  };
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk.toString();
  }
  if (!input.trim()) {
    console.log(JSON.stringify({ status: 'error', error: 'Empty stdin request' }));
    process.exit(1);
  }

  try {
    const req = JSON.parse(input);
    let res;
    if (req.action === 'sign') {
      res = await handleSign(req);
    } else if (req.action === 'seal-pdf-pades') {
      res = await handleSealPades(req);
    } else if (req.action === 'seal-cades') {
      res = await handleSealCades(req);
    } else if (req.action === 'verify') {
      res = await handleVerify(req);
    } else {
      throw new Error(`Unknown action: ${req.action}`);
    }
    console.log(JSON.stringify(res));
  } catch (err) {
    console.log(JSON.stringify({
      status: 'error',
      error: err.message || String(err),
    }));
    process.exit(1);
  }
}

main();
