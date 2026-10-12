/**
 * token-signer.js — Node.js interface for hardware token signing (ЗНОК)
 * and interactive context selection between file keys (~/.secure_keys/) and hardware tokens.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const jk = require('jkurwa');
const { queryAdapter, getAlgos } = require('./adapter');
const { detectHardwareTokens, detectProvider } = require('./providers');
const { getQESLang, t } = require('./i18n');

const PYTHON_BRIDGE = path.join(__dirname, 'token_bridge.py');

/**
 * Discovers connected hardware tokens using both Python ctypes and USB catalog.
 */
function getConnectedHardwareTokens() {
  if (fs.existsSync(PYTHON_BRIDGE)) {
    try {
      const res = spawnSync('python3', [PYTHON_BRIDGE, 'detect'], {
        encoding: 'utf-8',
        timeout: 3000,
      });
      if (res.status === 0 && res.stdout) {
        const parsed = JSON.parse(res.stdout);
        if (parsed.detected && parsed.tokens && parsed.tokens.length > 0) {
          return {
            detected: true,
            tokens: parsed.tokens.map((t) => ({
              ...t,
              displayName: `${t.name} (№ ${t.serial})`,
            })),
          };
        }
      }
    } catch (_) {}
  }

  // Fallback to catalog detection from providers.js
  const fallback = detectHardwareTokens();
  return {
    detected: fallback.detected,
    tokens: (fallback.tokens || []).map((t) => ({
      hwId: `${t.vendorId}:${t.productId}`,
      typeIndex: t.vendorId === '03eb' && t.productId === '9324' ? 1 : (t.productId === '9325' ? 3 : 17),
      devIndex: 0,
      serial: 'USB',
      name: t.name,
      displayName: t.name,
    })),
  };
}

/**
 * Interactive selection window (Zenity GUI or Terminal menu) to choose between:
 * 1. File key in ~/.secure_keys/
 * 2. Hardware token (USB token / ЗНОК)
 * 3. Custom file key (.pfx)
 */
async function chooseSigningMedium(options = {}) {
  const {
    useGui = false,
    defaultKeyPath = null,
    inputFiles = [],
    askPasswordFn = null,
    isPades = false,
  } = options;

  const lang = getQESLang();
  const tokenState = getConnectedHardwareTokens();
  const hasToken = tokenState.detected && tokenState.tokens.length > 0;
  const activeToken = hasToken ? tokenState.tokens[0] : null;

  const defaultKeyName = defaultKeyPath
    ? path.basename(defaultKeyPath)
    : (lang === 'en' ? 'No key in ~/.secure_keys/' : 'Ключ не знайдено в ~/.secure_keys/');

  const tokenLabel = activeToken
    ? `${activeToken.displayName} [🟢 ${lang === 'en' ? 'Connected' : 'Підключено'}]`
    : `ЗНОК (Алмаз-1К, SecureToken) [⚠️ ${lang === 'en' ? 'Not connected' : 'Не підключено'}]`;

  const docDesc = inputFiles.length === 1
    ? path.basename(inputFiles[0])
    : (lang === 'en' ? `${inputFiles.length} files in batch` : `${inputFiles.length} файлів у пакеті`);

  // --- GUI MODE (GNOME HIG Libadwaita / Zenity fallback) ---
  if (useGui || process.env.DISPLAY || process.env.WAYLAND_DISPLAY) {
    if (useGui) {
      // 1. First priority: native GNOME HIG Libadwaita dialog (qes-dialog) with Papirus Green theme
      let qesDialogBin = null;
      try {
        const whichRes = spawnSync('which', ['qes-dialog'], { encoding: 'utf-8' });
        if (whichRes.status === 0 && whichRes.stdout.trim() && fs.existsSync(whichRes.stdout.trim())) {
          qesDialogBin = whichRes.stdout.trim();
        }
      } catch (_) {}

      if (!qesDialogBin) {
        const qesDialogCandidates = [
          path.join(__dirname, '../bin/qes-dialog'),
          '/usr/lib/qes-tools/bin/qes-dialog',
          '/usr/bin/qes-dialog',
        ];
        for (const cand of qesDialogCandidates) {
          if (fs.existsSync(cand)) {
            qesDialogBin = cand;
            break;
          }
        }
      }

      if (qesDialogBin) {
        const dialogArgs = [
          'select-medium',
          `--doc-desc=${docDesc}`,
          `--lang=${lang}`,
        ];
        if (defaultKeyPath) {
          dialogArgs.push(`--key-path=${defaultKeyPath}`);
          dialogArgs.push(`--key-name=${defaultKeyName}`);
        }
        if (isPades) {
          dialogArgs.push('--is-pades');
        }
        if (activeToken) {
          dialogArgs.push('--token-detected');
          dialogArgs.push(`--token-name=${activeToken.displayName}`);
        }

        try {
          const res = spawnSync(qesDialogBin, dialogArgs, { encoding: 'utf-8' });
          if (res.status === 0 && res.stdout) {
            const parsed = JSON.parse(res.stdout.trim());
            if (parsed.status === 'ok') {
              if (parsed.choice === 'file') {
                return { type: 'file', keyPath: parsed.path || defaultKeyPath };
              } else if (parsed.choice === 'token') {
                return { type: 'token', tokenInfo: activeToken };
              } else if (parsed.choice === 'browse' && parsed.path) {
                return { type: 'file', keyPath: parsed.path };
              }
            } else if (parsed.status === 'cancelled') {
              return { cancelled: true };
            }
          } else if (res.status === 1) {
            // User cancelled via window close button or Esc
            return { cancelled: true };
          }
        } catch (_) {
          // If qes-dialog fails, fall back to Zenity
        }
      }

      // 2. Secondary fallback: Zenity (clean plain text strings, no raw HTML tags in list columns)
      const userIcon = path.join(process.env.HOME || '', '.local/share/icons/Papirus/48x48/mimetypes/application-certificate.svg');
      const sysIcon = '/usr/share/icons/Papirus/48x48/mimetypes/application-certificate.svg';
      const PAPIRUS_CERT_ICON = fs.existsSync(userIcon) ? userIcon : (fs.existsSync(sysIcon) ? sysIcon : null);

      const title = lang === 'en'
        ? 'Select Signature Medium — QES Tools'
        : 'Вибір носія особистого ключа — QES Tools';

      const promptText = lang === 'en'
        ? `<span size="larger" weight="bold" color="#2e7d32">🔐 Electronic Signature (QES / DSTU 4145)</span>\n\n<b>Object:</b> ${docDesc}\n<span size="small" color="#555555">Select key storage medium to perform digital signing:</span>`
        : `<span size="larger" weight="bold" color="#2e7d32">🔐 Електронний підпис (КЕП / ДСТУ 4145)</span>\n\n<b>Об'єкт:</b> ${docDesc}\n<span size="small" color="#555555">Оберіть носій особистого ключа для накладання підпису:</span>`;

      const colChoice = lang === 'en' ? 'Select' : 'Вибір';
      const colCode = 'Code';
      const colMedium = lang === 'en' ? 'Key Medium' : 'Носій особистого ключа';
      const colDesc = lang === 'en' ? 'Details / Location' : 'Деталі / Розташування';

      const optFile = lang === 'en'
        ? '📁  File Key'
        : '📁  Файловий ключ';
      const optFileDesc = defaultKeyPath
        ? (isPades
            ? `${defaultKeyName}  (PAdES штамп + QR)`
            : `${defaultKeyName}  (~/.secure_keys/)`)
        : (lang === 'en' ? 'No key in ~/.secure_keys/' : 'Ключ відсутній у ~/.secure_keys/');

      const optToken = lang === 'en'
        ? '🔑  Hardware Token (ЗНОК)'
        : '🔑  Апаратний ключ (ЗНОК)';
      const optTokenDesc = activeToken
        ? (isPades
            ? `🟢 ${activeToken.displayName}  (PAdES штамп + QR / USB ЗНОК)`
            : `🟢 ${activeToken.displayName}  (USB смарт-чіп)`)
        : (lang === 'en'
          ? '⚠️ USB token not connected (Almaz-1K, SecureToken-337)'
          : '⚠️ USB-токен не підключено (Алмаз-1К, SecureToken-337)');

      const optBrowse = lang === 'en'
        ? '📂  Choose Another Key File...'
        : '📂  Обрати інший файл ключа...';
      const descBrowse = lang === 'en'
        ? 'Browse .pfx / .p12 container from disk or USB flash drive'
        : 'Вибрати файл .pfx / .p12 з довільної папки або USB-флешки';

      const zenityArgs = [
        '--list',
        '--radiolist',
        `--title=${title}`,
        `--text=${promptText}`,
        `--column=${colChoice}`,
        `--column=${colCode}`,
        `--column=${colMedium}`,
        `--column=${colDesc}`,
        '--hide-column=2',
        '--print-column=2',
        '--width=760',
        '--height=370',
        '--ok-label=' + (lang === 'en' ? 'Continue' : 'Продовжити'),
        '--cancel-label=' + (lang === 'en' ? 'Cancel' : 'Скасувати'),
        '--icon-name=application-certificate',
        'TRUE', 'file', optFile, optFileDesc,
        'FALSE', 'token', optToken, optTokenDesc,
        'FALSE', 'browse', optBrowse, descBrowse,
      ];
      if (PAPIRUS_CERT_ICON) {
        zenityArgs.push(`--window-icon=${PAPIRUS_CERT_ICON}`);
      }

      const proc = spawnSync('zenity', zenityArgs, { encoding: 'utf-8' });
      if (proc.status !== 0 || !proc.stdout) {
        // User cancelled selection
        return { cancelled: true };
      }

      const choice = proc.stdout.trim();

      if (choice === 'file') {
        return { type: 'file', keyPath: defaultKeyPath };
      } else if (choice === 'browse') {
        const fileSelTitle = lang === 'en'
          ? 'Choose Private Key Container (.pfx, .p12)'
          : 'Оберіть файл особистого ключа (.pfx, .p12)';
        const fileArgs = [
          '--file-selection',
          `--title=${fileSelTitle}`,
          '--file-filter=Ключі КЕП (*.pfx, *.p12) | *.pfx *.p12 *.jks',
          '--file-filter=Усі файли (*.*) | *.*',
          '--icon-name=application-certificate',
        ];
        if (PAPIRUS_CERT_ICON) {
          fileArgs.push(`--window-icon=${PAPIRUS_CERT_ICON}`);
        }
        const fileProc = spawnSync('zenity', fileArgs, { encoding: 'utf-8' });
        if (fileProc.status !== 0 || !fileProc.stdout.trim()) {
          return { cancelled: true };
        }
        return { type: 'file', keyPath: fileProc.stdout.trim() };
      } else if (choice === 'token') {
        return { type: 'token', tokenInfo: activeToken };
      } else {
        return { type: 'file', keyPath: defaultKeyPath };
      }
    }
  }

  // --- CLI INTERACTIVE MODE (TTY) ---
  if (process.stdin.isTTY) {
    const CLR_RESET = '\x1b[0m';
    const CLR_BOLD = '\x1b[1m';
    const CLR_CYAN = '\x1b[36m';
    const CLR_GREEN = '\x1b[32m';
    const CLR_YELLOW = '\x1b[33m';
    const CLR_GRAY = '\x1b[90m';

    console.log(`\n${CLR_CYAN}╔═══════════════════════════════════════════════════════════════════════════════════════╗${CLR_RESET}`);
    console.log(`${CLR_CYAN}║ ${CLR_BOLD}ВИБІР НОСІЯ ОСОБИСТОГО КЛЮЧА КЕП (ДСТУ 4145-2002)${CLR_RESET}`);
    console.log(`${CLR_CYAN}║ Об'єкт: ${docDesc}${CLR_RESET}`);
    console.log(`${CLR_CYAN}╟───────────────────────────────────────────────────────────────────────────────────────╢${CLR_RESET}`);
    console.log(`${CLR_CYAN}║ ${CLR_BOLD}[1] 📁 Файловий ключ із ~/.secure_keys/${CLR_RESET}`);
    console.log(`${CLR_CYAN}║     -> ${CLR_GREEN}${defaultKeyName}${CLR_RESET} ${CLR_GRAY}(папка ~/.secure_keys/)${CLR_RESET}`);
    console.log(`${CLR_CYAN}║${CLR_RESET}`);
    console.log(`${CLR_CYAN}║ ${CLR_BOLD}[2] 🔑 Апаратний ключ (USB-токен / ЗНОК)${CLR_RESET}`);
    if (activeToken) {
      console.log(`${CLR_CYAN}║     -> ${CLR_GREEN}${activeToken.displayName}${CLR_RESET} [🟢 ${CLR_GREEN}підключено${CLR_RESET}]`);
    } else {
      console.log(`${CLR_CYAN}║     -> ${CLR_YELLOW}Апаратний USB-токен${CLR_RESET} [⚠️ ${CLR_YELLOW}не виявлено в USB${CLR_RESET}]`);
    }
    console.log(`${CLR_CYAN}║${CLR_RESET}`);
    console.log(`${CLR_CYAN}║ ${CLR_BOLD}[3] 📂 Обрати інший файл ключа (.pfx / .p12)...${CLR_RESET}`);
    console.log(`${CLR_CYAN}╚═══════════════════════════════════════════════════════════════════════════════════════╝${CLR_RESET}`);

    const promptUser = () => new Promise((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      readline.question(`${CLR_BOLD}Оберіть варіант [1-3] (за замовчуванням 1): ${CLR_RESET}`, (ans) => {
        readline.close();
        resolve(ans.trim());
      });
    });

    const ans = await promptUser();

    if (ans === '2') {
      return { type: 'token', tokenInfo: activeToken };
    } else if (ans === '3') {
      const askPath = () => new Promise((resolve) => {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        readline.question(`${CLR_BOLD}Вкажіть повний шлях до файлу ключа: ${CLR_RESET}`, (p) => {
          readline.close();
          resolve(p.trim());
        });
      });
      const customPath = await askPath();
      if (!customPath) return { cancelled: true };
      return { type: 'file', keyPath: path.resolve(customPath) };
    } else {
      return { type: 'file', keyPath: defaultKeyPath };
    }
  }

  // Non-interactive fallback (pipes, automated scripts)
  return { type: 'file', keyPath: defaultKeyPath };
}

/**
 * Requests an RFC 3161 TimeStampToken from a qualified TSP server (QTSP)
 * using Gost34311 message imprint over the signature digest.
 */
function getStamp(tspUrl, signHash, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    let timer = null;
    let settled = false;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      settled = true;
    };

    timer = setTimeout(() => {
      if (!settled) {
        cleanup();
        reject(new Error(`TSP server timeout (${timeoutMs}ms) for ${tspUrl}`));
      }
    }, timeoutMs);

    const tspReq = jk.rfc3161.TimeStampReq.encode(
      {
        version: 1,
        messageImprint: {
          hashAlgorithm: { algorithm: 'Gost34311' },
          hashedMessage: signHash,
        },
      },
      'der'
    );

    queryAdapter(
      'POST',
      tspUrl,
      {
        'Content-Type': 'application/tsp-request',
        'Content-Length': tspReq.length,
      },
      tspReq,
      (respBuf, statusCode) => {
        if (settled) return;
        cleanup();
        if (!respBuf || (statusCode && statusCode >= 400)) {
          return reject(new Error(`TSP server error HTTP ${statusCode || 'unreachable'} (${tspUrl})`));
        }
        try {
          const rtsp = jk.rfc3161.TimeStampResp.decode(respBuf, 'der');
          if (rtsp.status.status !== 'granted') {
            return reject(new Error(`TSP server returned status: ${rtsp.status.status}`));
          }
          const token = jk.dstszi2010.ContentInfo.encode(rtsp.timeStampToken, 'der');
          resolve(token);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

/**
 * Embeds an RFC 3161 Qualified Timestamp Token (CAdES-T / PAdES-T) into an existing
 * CMS / PKCS#7 signature produced by a hardware token.
 *
 * Invariant: RFC 5652 / CAdES places the timestamp in unauthenticatedAttributes
 * (id-aa-timeStampToken), which does not affect or invalidate the hardware token's
 * cryptographic signature over the document.
 */
async function attachTspToSignature(signatureBuffer, certOrCertPath = null, options = {}) {
  if (!Buffer.isBuffer(signatureBuffer) || signatureBuffer.length === 0) {
    return signatureBuffer;
  }

  let msg;
  try {
    msg = new jk.models.Message(signatureBuffer);
  } catch (err) {
    return signatureBuffer;
  }

  if (msg.type !== 'signedData' || !msg.info || !msg.info.signerInfos || !msg.info.signerInfos.length) {
    return signatureBuffer;
  }

  // 1. Resolve certificate
  let cert = null;
  if (msg.info.certificate && msg.info.certificate.length > 0) {
    try {
      cert = new jk.Certificate(msg.info.certificate[0]);
    } catch (_) {}
  }

  if (!cert && certOrCertPath) {
    try {
      if (typeof certOrCertPath === 'string' && fs.existsSync(certOrCertPath)) {
        const cBuf = fs.readFileSync(certOrCertPath);
        cert = jk.Certificate.from_asn1(cBuf);
      } else if (Buffer.isBuffer(certOrCertPath)) {
        cert = jk.Certificate.from_asn1(certOrCertPath);
      } else if (certOrCertPath && typeof certOrCertPath === 'object' && certOrCertPath.subject) {
        cert = certOrCertPath;
      }
    } catch (_) {}
  }

  if (!cert) {
    try {
      const resolved = getHardwareTokenCertificate(options);
      if (resolved && resolved.cert) {
        cert = resolved.cert;
      } else if (resolved && resolved.certBuf) {
        cert = jk.Certificate.from_asn1(resolved.certBuf);
      }
    } catch (_) {}
  }

  // If cert was missing from CMS info.certificate, inject it so verifiers have full offline cert
  if ((!msg.info.certificate || !msg.info.certificate.length) && cert && cert.ob) {
    msg.info.certificate = [cert.ob];
  }

  // 2. Resolve TSP URL
  let tspUrl = options.tspUrl;
  if (!tspUrl && cert && cert.extension && cert.extension.subjectInfoAccess && cert.extension.subjectInfoAccess.link) {
    tspUrl = cert.extension.subjectInfoAccess.link;
  }
  if (!tspUrl && cert) {
    try {
      const prov = detectProvider(cert);
      if (prov && prov.tsp && prov.tsp.length > 0) {
        tspUrl = prov.tsp[0];
      }
    } catch (_) {}
  }
  if (!tspUrl) {
    tspUrl = 'http://ca.depositsign.com/services/tsp/dstu/';
  }

  // 3. Compute Gost34311 hash over the signature value
  const algo = getAlgos();
  const signHash = algo.hash(msg.signature);

  // 4. Request timestamp token from QTSP
  let token;
  try {
    token = await getStamp(tspUrl, signHash, options.tspTimeout || 7000);
  } catch (tspErr) {
    if (options.verbose) {
      console.warn(`[QES TSP] Помилка отримання мітки часу TSP (${tspErr.message}). Збережено підпис CAdES-BES без мітки.`);
    }
    return signatureBuffer;
  }

  // 5. Attach timestamp token to unauthenticatedAttributes (CAdES-T)
  // Workaround for jkurwa bug where msg.puattrs.list is undefined when parsing external CMS
  if (!msg.puattrs.list) {
    msg.puattrs.list = [];
  }
  msg.addSignatureToken(token);

  try {
    return Buffer.from(msg.as_asn1());
  } catch (err) {
    if (options.verbose) {
      console.warn(`[QES TSP] Не вдалося перекодувати підпис з міткою часу (${err.message})`);
    }
    return signatureBuffer;
  }
}

/**
 * Signs a file or package using the hardware token via token_bridge.py
 */
async function signWithHardwareToken(options = {}) {
  const {
    inputPath,
    outputPath,
    pin,
    typeIndex = 1,
    devIndex = 0,
    isAppend = false,
    isInternal = false,
    tsp = true,
  } = options;

  if (!fs.existsSync(PYTHON_BRIDGE)) {
    throw new Error(`Python міст token_bridge.py не знайдено: ${PYTHON_BRIDGE}`);
  }

  const payload = JSON.stringify({
    typeIndex,
    devIndex,
    pin,
    inputPath,
    outputPath,
    isAppend,
    isInternal,
  });

  const proc = spawnSync('python3', [PYTHON_BRIDGE, 'sign-file'], {
    input: payload,
    encoding: 'utf-8',
    timeout: 30000,
  });

  if (proc.status !== 0 || !proc.stdout) {
    const errText = proc.stderr || (proc.stdout ? JSON.parse(proc.stdout).error : 'Невідома помилка');
    throw new Error(errText);
  }

  let res;
  try {
    res = JSON.parse(proc.stdout);
    if (!res.success) {
      throw new Error(res.error || 'Помилка підписання токеном');
    }
  } catch (e) {
    throw new Error(e.message || 'Помилка парсингу відповіді токена');
  }

  // Attach RFC 3161 Qualified Timestamp Token (CAdES-T) if requested and output exists
  if (tsp !== false && fs.existsSync(outputPath)) {
    try {
      const sigBuf = fs.readFileSync(outputPath);
      const updatedBuf = await attachTspToSignature(sigBuf, options.cert || options.certPath, options);
      if (updatedBuf && updatedBuf.length !== sigBuf.length) {
        fs.writeFileSync(outputPath, updatedBuf);
        res.fileSize = updatedBuf.length;
      }
    } catch (_) {
      // Graceful offline fallback
    }
  }

  return res;
}

/**
 * Signs raw binary data or a buffer using the hardware token via token_bridge.py.
 * Generates detached PKCS#7 / CAdES signature required by PAdES and @signpdf/signpdf.
 */
function signDataWithHardwareToken(options = {}) {
  const {
    data,
    dataPath,
    pin,
    typeIndex = 1,
    devIndex = 0,
    isAppend = false,
  } = options;

  if (!fs.existsSync(PYTHON_BRIDGE)) {
    throw new Error(`Python міст token_bridge.py не знайдено: ${PYTHON_BRIDGE}`);
  }

  let tempInputFile = null;
  let tempOutputFile = null;

  try {
    let effectiveDataPath = dataPath;
    if (!effectiveDataPath && (Buffer.isBuffer(data) || typeof data === 'string')) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      tempInputFile = path.join(os.tmpdir(), `qes-tok-in-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
      fs.writeFileSync(tempInputFile, buf);
      effectiveDataPath = tempInputFile;
    }

    tempOutputFile = path.join(os.tmpdir(), `qes-tok-out-${Date.now()}-${Math.random().toString(36).slice(2)}.sig`);

    const payload = JSON.stringify({
      typeIndex,
      devIndex,
      pin,
      dataPath: effectiveDataPath,
      outputPath: tempOutputFile,
      isAppend,
    });

    const proc = spawnSync('python3', [PYTHON_BRIDGE, 'sign-data'], {
      input: payload,
      encoding: 'utf-8',
      timeout: 60000,
    });

    if (proc.status !== 0 || !proc.stdout) {
      const errText = proc.stderr || (proc.stdout ? JSON.parse(proc.stdout).error : 'Помилка взаємодії з апаратним токеном');
      throw new Error(errText);
    }

    const res = JSON.parse(proc.stdout);
    if (!res.success) {
      throw new Error(res.error || 'Помилка накладання підпису апаратним токеном');
    }

    if (fs.existsSync(tempOutputFile)) {
      return fs.readFileSync(tempOutputFile);
    } else if (res.signature) {
      return Buffer.from(res.signature, 'base64');
    } else {
      throw new Error('Отримано порожній підпис від апаратного токена');
    }
  } finally {
    if (tempInputFile && fs.existsSync(tempInputFile)) {
      try { fs.unlinkSync(tempInputFile); } catch (_) {}
    }
    if (tempOutputFile && fs.existsSync(tempOutputFile)) {
      try { fs.unlinkSync(tempOutputFile); } catch (_) {}
    }
  }
}

/**
 * Resolves the public certificate corresponding to the hardware token.
 * 1. Checks explicit certPath.
 * 2. Queries token_bridge.py get-cert.
 * 3. Scans ~/.secure_keys and ~/.local/share/qes-tools/certificates for digital signature cert.
 */
function getHardwareTokenCertificate(options = {}) {
  const {
    certPath = null,
    pin = null,
    typeIndex = 1,
    devIndex = 0,
  } = options;

  // 1. Explicit certPath
  if (certPath && fs.existsSync(certPath)) {
    const certBuf = fs.readFileSync(certPath);
    return { certBuf, certPath };
  }

  // 2. Call token_bridge.py get-cert
  if (fs.existsSync(PYTHON_BRIDGE)) {
    try {
      const payload = JSON.stringify({
        typeIndex,
        devIndex,
        pin,
        certPath,
      });
      const res = spawnSync('python3', [PYTHON_BRIDGE, 'get-cert'], {
        input: payload,
        encoding: 'utf-8',
        timeout: 5000,
      });
      if (res.status === 0 && res.stdout) {
        const parsed = JSON.parse(res.stdout);
        if (parsed.success && parsed.certB64) {
          const certBuf = Buffer.from(parsed.certB64, 'base64');
          return { certBuf, certPath: parsed.certPath || null };
        }
      }
    } catch (_) {}
  }

  // 3. Fallback: scan local certificate directories using jkurwa
  const jkurwa = require('jkurwa');
  const dirs = [
    path.join(process.env.HOME || '', '.secure_keys'),
    path.join(process.env.HOME || '', '.local/share/qes-tools/certificates'),
    '/usr/lib/qes-tools/certs',
    path.join(__dirname, '..', 'certs'),
    path.join(__dirname, '..', 'node_modules', 'jkurwa', 'test', 'data'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (!f.endsWith('.cer')) continue;
      const fullPath = path.join(dir, f);
      try {
        const certBuf = fs.readFileSync(fullPath);
        const cert = jkurwa.Certificate.from_asn1(certBuf);
        const subj = cert.subject || {};
        const ku = cert.extension && cert.extension.keyUsage;
        const isDigitalSig = ku && Buffer.isBuffer(ku) && ku.length >= 4 && (ku[3] & 0x80);
        if (isDigitalSig && (subj.commonName || subj.serialNumber)) {
          return { certBuf, certPath: fullPath, cert };
        }
      } catch (_) {}
    }
  }

  throw new Error('Відкритий сертифікат для апаратного токена не знайдено в ~/.secure_keys/ або сховищі.');
}

module.exports = {
  getConnectedHardwareTokens,
  chooseSigningMedium,
  signWithHardwareToken,
  signDataWithHardwareToken,
  getHardwareTokenCertificate,
  getStamp,
  attachTspToSignature,
};
