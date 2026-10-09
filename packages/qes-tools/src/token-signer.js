/**
 * token-signer.js — Node.js interface for hardware token signing (ЗНОК)
 * and interactive context selection between file keys (~/.secure_keys/) and hardware tokens.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { detectHardwareTokens } = require('./providers');
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

  // --- GUI MODE (Zenity) ---
  if (useGui || process.env.DISPLAY || process.env.WAYLAND_DISPLAY) {
    if (useGui) {
      const title = lang === 'en'
        ? 'Select Signature Medium — QES Tools'
        : 'Вибір носія особистого ключа КЕП / УЕП';

      const promptText = lang === 'en'
        ? `Select private key medium for signing:\n<b>Object:</b> ${docDesc}\n<i>(File keys are stored in: ~/.secure_keys/)</i>`
        : `Оберіть спосіб підписання для виділених документів:\n<b>Об'єкт:</b> ${docDesc}\n<i>(Файлові ключі зберігаються в: ~/.secure_keys/)</i>`;

      const colChoice = lang === 'en' ? 'Select' : 'Вибір';
      const colCode = 'Code';
      const colMedium = lang === 'en' ? 'Key Medium' : 'Носій особистого ключа';
      const colDesc = lang === 'en' ? 'Details / Location' : 'Деталі / Розташування';

      const optFile = lang === 'en'
        ? '📁 File Key (~/.secure_keys/)'
        : '📁 Файловий ключ із папки (~/.secure_keys/)';
      const optToken = lang === 'en'
        ? '🔑 Hardware Token (USB ЗНОК)'
        : '🔑 Апаратний ключ (USB-токен / ЗНОК)';
      const optBrowse = lang === 'en'
        ? '📂 Choose another key file (.pfx)...'
        : '📂 Обрати інший файл ключа (.pfx / .p12)...';
      const descBrowse = lang === 'en'
        ? 'Browse file from computer'
        : 'Вибрати інший файл ключа з довільної папки';

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
        '--width=680',
        '--height=290',
        'TRUE', 'file', optFile, defaultKeyName,
        'FALSE', 'token', optToken, tokenLabel,
        'FALSE', 'browse', optBrowse, descBrowse,
      ];

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
        const fileProc = spawnSync('zenity', [
          '--file-selection',
          `--title=${fileSelTitle}`,
          '--file-filter=Ключі КЕП (*.pfx, *.p12) | *.pfx *.p12 *.jks',
          '--file-filter=Усі файли (*.*) | *.*',
        ], { encoding: 'utf-8' });
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
 * Signs a file or package using the hardware token via token_bridge.py
 */
function signWithHardwareToken(options = {}) {
  const {
    inputPath,
    outputPath,
    pin,
    typeIndex = 1,
    devIndex = 0,
    isAppend = false,
    isInternal = false,
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

  try {
    const res = JSON.parse(proc.stdout);
    if (!res.success) {
      throw new Error(res.error || 'Помилка підписання токеном');
    }
    return res;
  } catch (e) {
    throw new Error(e.message || 'Помилка парсингу відповіді токена');
  }
}

module.exports = {
  getConnectedHardwareTokens,
  chooseSigningMedium,
  signWithHardwareToken,
};
