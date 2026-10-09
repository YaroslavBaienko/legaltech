#!/usr/bin/env node
/**
 * qes-decrypt — Інструмент розшифрування файлів та контейнерів (ДСТУ 4145 / ГОСТ 28147:89).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const { QESEngine } = require('../src/engine');
const { getOrPromptPassword, sendAgentMessage } = require('../src/session');
const { t } = require('../src/i18n');

const CLR_RESET = '\x1b[0m';
const CLR_BOLD = '\x1b[1m';
const CLR_GREEN = '\x1b[32m';
const CLR_RED = '\x1b[31m';
const CLR_YELLOW = '\x1b[33m';
const CLR_CYAN = '\x1b[36m';
const CLR_GRAY = '\x1b[90m';

function askPassword(promptText, forceGui = false) {
  return new Promise((resolve, reject) => {
    if (process.env.QES_PASSWORD) {
      return resolve(process.env.QES_PASSWORD);
    }

    if ((forceGui || !process.stdin.isTTY) && (process.env.DISPLAY || process.env.WAYLAND_DISPLAY)) {
      const cleanPrompt = (promptText || t('enterPassword')).replace(/\x1b\[[0-9;]*m/g, '');
      const pangoText = `<span size="larger" weight="bold" color="#2a75d3">🔓 Розшифрування особистим КЕП</span>\n\n${cleanPrompt}\n<span size="small" color="#666666">Введіть пароль вашого особистого ключа для відкриття зашифрованого файлу (.enc):</span>`;
      const PAPIRUS_UNLOCK_ICON = fs.existsSync('/home/attor/.local/share/icons/Papirus/48x48/emblems/emblem-unlocked.svg')
        ? '/home/attor/.local/share/icons/Papirus/48x48/emblems/emblem-unlocked.svg'
        : null;

      const zenArgs = [
        '--password',
        `--title=${t('decryptDialogTitle')}`,
        `--text=${pangoText}`,
        '--icon-name=emblem-unlocked',
        '--ok-label=Розшифрувати',
        '--cancel-label=Скасувати',
      ];
      if (PAPIRUS_UNLOCK_ICON) zenArgs.push(`--window-icon=${PAPIRUS_UNLOCK_ICON}`);

      const zenityRes = spawnSync('zenity', zenArgs, { encoding: 'utf-8' });

      if (zenityRes.status === 0) {
        return resolve(zenityRes.stdout.trim());
      } else {
        return reject(new Error(t('pwdCancelled')));
      }
    }

    const stdin = process.stdin;
    const oldRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';
    process.stdout.write(promptText);

    const onData = function(chunk) {
      for (let i = 0; i < chunk.length; i++) {
        const c = chunk[i];
        if (c === '\r' || c === '\n') {
          stdin.removeListener('data', onData);
          stdin.setRawMode(oldRaw);
          stdin.pause();
          process.stdout.write('\n');
          return resolve(password);
        } else if (c === '\u0003') {
          stdin.removeListener('data', onData);
          stdin.setRawMode(oldRaw);
          stdin.pause();
          process.stdout.write('\n');
          process.exit(130);
        } else if (c === '\u007f' || c === '\b') {
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (c >= ' ' && c !== '\x7f') {
          password += c;
          process.stdout.write('*');
        }
      }
    };

    stdin.on('data', onData);
  });
}

function findDefaultKey() {
  if (process.env.QES_KEY && fs.existsSync(process.env.QES_KEY)) {
    return path.resolve(process.env.QES_KEY);
  }
  const secureDir = path.join(process.env.HOME || '/home/attor', '.secure_keys');
  if (fs.existsSync(secureDir)) {
    const files = fs.readdirSync(secureDir).filter((f) => f.endsWith('.pfx') || f.endsWith('.p12'));
    if (files.length > 0) {
      return path.join(secureDir, files[0]);
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(`
${CLR_BOLD}${CLR_CYAN}================================================================================${CLR_RESET}
${CLR_BOLD}${CLR_CYAN}  qes-decrypt — розшифрування файлів та контейнерів (ДСТУ 4145 / ГОСТ 28147:89)${CLR_RESET}
${CLR_BOLD}${CLR_CYAN}  100% Offline-First | Захист адвокатської таємниці${CLR_RESET}
${CLR_BOLD}${CLR_CYAN}================================================================================${CLR_RESET}

${CLR_BOLD}ОПИС:${CLR_RESET}
  Розшифровує криптографічні контейнери (.enc / .p7e), зашифровані за національними
  стандартами ДСТУ 4145 та ГОСТ 28147:89, за допомогою особистого ключа КЕП.

${CLR_BOLD}ВИКОРИСТАННЯ:${CLR_RESET}
  qes-decrypt [ОПЦІЇ] <зашифрований_файл>

${CLR_BOLD}ОПЦІЇ:${CLR_RESET}
  ${CLR_GREEN}--key <шлях>${CLR_RESET}        Контейнер особистого ключа (.pfx). За замовчуванням: ~/.secure_keys/
  ${CLR_GREEN}--ttl <хв>${CLR_RESET}          Час збереження пароля в сесії RAM (за замовчуванням 15 хв, до 120 хв)
  ${CLR_GREEN}--no-cache${CLR_RESET}          Вимкнути тимчасове збереження пароля в сесії для цієї операції
  ${CLR_GREEN}--clear-cache${CLR_RESET}       Очистити збережені паролі з оперативної пам'яті перед виконанням
  ${CLR_GREEN}--gui${CLR_RESET}               Графічне вікно введення пароля (Zenity)
  ${CLR_GREEN}-o, --output <шлях>${CLR_RESET} Шлях та назва збереження розшифрованого файлу
  ${CLR_GREEN}-h, --help${CLR_RESET}          Показати цю довідку

${CLR_BOLD}ПРИКЛАДИ КОМАНД:${CLR_RESET}

  ${CLR_BOLD}1. Розшифрування файлу з автовизначенням вихідної назви:${CLR_RESET}
     $ qes-decrypt private_case.pdf.enc
     ${CLR_GRAY}-> Відновлює оригінальний файл private_case.pdf.${CLR_RESET}

  ${CLR_BOLD}2. Розшифрування з графічним вікном GNOME:${CLR_RESET}
     $ qes-decrypt --gui dossier.zip.enc

  ${CLR_BOLD}3. Збереження розшифрованого файлу за власним шляхом:${CLR_RESET}
     $ qes-decrypt confidential.docx.enc -o /home/attor/Documents/restored.docx
================================================================================
`);
    process.exit(0);
  }

  const encPaths = [];
  let keyPath = null;
  let certPath = null;
  let outputPath = null;
  let useGui = false;
  let noCache = false;
  let clearCacheFirst = false;
  let ttl = 900;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--key' && i + 1 < args.length) {
      keyPath = path.resolve(args[++i]);
    } else if (arg === '--cert' && i + 1 < args.length) {
      certPath = path.resolve(args[++i]);
    } else if ((arg === '-o' || arg === '--output') && i + 1 < args.length) {
      outputPath = path.resolve(args[++i]);
    } else if (arg === '--gui') {
      useGui = true;
    } else if (arg === '--no-cache') {
      noCache = true;
    } else if (arg === '--clear-cache') {
      clearCacheFirst = true;
    } else if (arg === '--ttl' && i + 1 < args.length) {
      ttl = parseInt(args[++i], 10) * 60;
      if (isNaN(ttl) || ttl < 60) ttl = 900;
    } else if (!arg.startsWith('-')) {
      encPaths.push(path.resolve(arg));
    }
  }

  if (encPaths.length === 0) {
    if (useGui) {
      const selProc = spawnSync('zenity', [
        '--file-selection',
        '--title=Оберіть зашифрований файл для розшифрування КЕП (.enc / .p7e)',
        '--file-filter=Зашифровані файли (*.enc *.p7e) | *.enc *.p7e',
        '--file-filter=Усі файли (*.*) | *.*',
      ], { encoding: 'utf8' });
      const chosen = selProc.stdout ? selProc.stdout.trim() : '';
      if (!chosen) {
        process.exit(0);
      }
      encPaths.push(path.resolve(chosen));
    } else {
      console.error(`${CLR_RED}Помилка: не вказано зашифрований файл.${CLR_RESET}`);
      process.exit(1);
    }
  }

  for (const ep of encPaths) {
    if (!fs.existsSync(ep)) {
      console.error(`${CLR_RED}Помилка: файл '${ep}' не знайдено.${CLR_RESET}`);
      process.exit(1);
    }
  }

  if (!keyPath) {
    keyPath = findDefaultKey();
  }

  if (!keyPath || !fs.existsSync(keyPath)) {
    console.error(`${CLR_RED}Помилка: файл ключа не знайдено в ~/.secure_keys/. Вкажіть через --key <шлях>.${CLR_RESET}`);
    process.exit(1);
  }

  if (clearCacheFirst) {
    await sendAgentMessage({ action: 'clear' }).catch(() => {});
  }

  const engine = new QESEngine();

  let boxInfo;
  try {
    boxInfo = await getOrPromptPassword({
      keyPath,
      certPath,
      engine,
      useGui,
      noCache,
      ttl,
      askPasswordFn: askPassword,
    });
  } catch (err) {
    console.error(`\n${CLR_RED}❌ Помилка ініціалізації ключа: ${err.message}${CLR_RESET}\n`);
    process.exit(1);
  }

  for (let idx = 0; idx < encPaths.length; idx++) {
    const curEnc = encPaths[idx];
    console.log(`\n${CLR_GRAY}⏳ [${idx + 1}/${encPaths.length}] Розшифрування за ГОСТ 28147:89 (${path.basename(curEnc)})...${CLR_RESET}`);

    const curOutput = (encPaths.length === 1 && outputPath) ? outputPath : null;

    try {
      const res = await engine.decryptFile(boxInfo.box, curEnc, {
        outputPath: curOutput,
      });

      console.log(`${CLR_GREEN}================================================================================${CLR_RESET}`);
      console.log(`${CLR_BOLD}${CLR_GREEN} ✅ ФАЙЛ УСПІШНО РОЗШИФРОВАНО!${CLR_RESET}`);
      console.log(`  ${CLR_BOLD}Збережено як:${CLR_RESET}        ${res.outputPath} (${res.fileSize} байт)`);
      if (res.senderInfo) {
        console.log(`  ${CLR_BOLD}Зашифровано особою:${CLR_RESET}  ${res.senderInfo.commonName} (${res.senderInfo.rnokpp || '—'})`);
        console.log(`  ${CLR_BOLD}КНЕДП відправника:${CLR_RESET}   ${res.senderInfo.issuerName}`);
      }
      if (res.isZip) {
        console.log(`  ${CLR_CYAN}Вміст:${CLR_RESET}               Розшифровано архів (пакет файлів)`);
      }
      console.log(`${CLR_GREEN}================================================================================${CLR_RESET}`);
    } catch (err) {
      console.error(`\n${CLR_RED}❌ Помилка розшифрування '${path.basename(curEnc)}': ${err.message}${CLR_RESET}\n`);
    }
  }
}

main().catch((e) => {
  console.error(`${CLR_RED}Непередбачена помилка:${CLR_RESET}`, e);
  process.exit(1);
});
