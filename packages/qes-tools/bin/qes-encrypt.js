#!/usr/bin/env node
/**
 * qes-encrypt — Інструмент криптографічного шифрування (ДСТУ 4145 / ГОСТ 28147:89).
 * Захист адвокатської таємниці та конфіденційних документів.
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
      const zenityRes = spawnSync('zenity', [
        '--password',
        `--title=${t('encryptDialogTitle')}`,
      ], { encoding: 'utf-8' });

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
${CLR_BOLD}${CLR_CYAN}  qes-encrypt — шифрування файлів та папок (ДСТУ 4145 / ГОСТ 28147:89)${CLR_RESET}
${CLR_BOLD}${CLR_CYAN}  100% Offline-First | Захист адвокатської таємниці${CLR_RESET}
${CLR_BOLD}${CLR_CYAN}================================================================================${CLR_RESET}

${CLR_BOLD}ОПИС:${CLR_RESET}
  Шифрує файли або цілі каталоги на відкритий сертифікат отримувача або для себе.
  Використовує стійкий симетричний шифр ГОСТ 28147:89 та узгодження ключів
  ДСТУ 4145 (Diffie-Hellman на еліптичних кривих).
  Прочитати зашифрований файл зможе ВИКЛЮЧНО власник цільового ключа КЕП.

${CLR_BOLD}ВИКОРИСТАННЯ:${CLR_RESET}
  qes-encrypt [ОПЦІЇ] <файл_або_папка>

${CLR_BOLD}ОПЦІЇ:${CLR_RESET}
  ${CLR_GREEN}-r, --recipient <шлях>${CLR_RESET} Відкритий сертифікат отримувача (.cer / .crt).
                          За замовчуванням: шифрує на власний ключ (особистий сейф)
  ${CLR_GREEN}--key <шлях>${CLR_RESET}           Контейнер особистого ключа (.pfx). За замовчуванням: ~/.secure_keys/
  ${CLR_GREEN}--ttl <хв>${CLR_RESET}          Час збереження пароля в сесії RAM (за замовчуванням 15 хв, до 120 хв)
  ${CLR_GREEN}--no-cache${CLR_RESET}          Вимкнути тимчасове збереження пароля в сесії для цієї операції
  ${CLR_GREEN}--clear-cache${CLR_RESET}       Очистити збережені паролі з оперативної пам'яті перед виконанням
  ${CLR_GREEN}--gui${CLR_RESET}                  Графічне вікно введення пароля (Zenity)
  ${CLR_GREEN}-o, --output <шлях>${CLR_RESET}    Назва вихідного зашифрованого файлу (.enc)
  ${CLR_GREEN}--raw${CLR_RESET}                  Зберегти як ASN.1 CMS EnvelopedData (.p7e)
  ${CLR_GREEN}-h, --help${CLR_RESET}             Показати цю довідку

${CLR_BOLD}ПРИКЛАДИ КОМАНД:${CLR_RESET}

  ${CLR_BOLD}1. Особистий сейф (шифрування файлу тільки для себе):${CLR_RESET}
     $ qes-encrypt private_case.pdf
     ${CLR_GRAY}-> Створює private_case.pdf.enc, який відкрити зможете лише ви своїм ключем.${CLR_RESET}

  ${CLR_BOLD}2. Спрямоване шифрування на сертифікат клієнта / колеги / суду:${CLR_RESET}
     $ qes-encrypt -r /path/to/client.cer lawsuit.pdf
     ${CLR_GRAY}-> Створює lawsuit.pdf.enc. Розшифрувати файл зможе лише клієнт своїм КЕП.${CLR_RESET}

  ${CLR_BOLD}3. Зашифрувати цілу папку з документами:${CLR_RESET}
     $ qes-encrypt dossier_folder/
     ${CLR_GRAY}-> Автоматично пакує та шифрує папку у dossier_folder.enc.${CLR_RESET}

  ${CLR_BOLD}4. З графічним вікном введення пароля GNOME:${CLR_RESET}
     $ qes-encrypt --gui confidential.docx
================================================================================
`);
    process.exit(0);
  }

  const targetPaths = [];
  let recipientCertPath = null;
  let keyPath = null;
  let certPath = null;
  let outputPath = null;
  let useGui = false;
  let rawP7e = false;
  let noCache = false;
  let clearCacheFirst = false;
  let ttl = 900;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '-r' || arg === '--recipient') && i + 1 < args.length) {
      recipientCertPath = path.resolve(args[++i]);
    } else if (arg === '--key' && i + 1 < args.length) {
      keyPath = path.resolve(args[++i]);
    } else if (arg === '--cert' && i + 1 < args.length) {
      certPath = path.resolve(args[++i]);
    } else if ((arg === '-o' || arg === '--output') && i + 1 < args.length) {
      outputPath = path.resolve(args[++i]);
    } else if (arg === '--gui') {
      useGui = true;
    } else if (arg === '--raw') {
      rawP7e = true;
    } else if (arg === '--no-cache') {
      noCache = true;
    } else if (arg === '--clear-cache') {
      clearCacheFirst = true;
    } else if (arg === '--ttl' && i + 1 < args.length) {
      ttl = parseInt(args[++i], 10) * 60;
      if (isNaN(ttl) || ttl < 60) ttl = 900;
    } else if (!arg.startsWith('-')) {
      targetPaths.push(path.resolve(arg));
    }
  }

  if (targetPaths.length === 0) {
    console.error(`${CLR_RED}Помилка: не вказано файл або папку для шифрування.${CLR_RESET}`);
    process.exit(1);
  }

  for (const tp of targetPaths) {
    if (!fs.existsSync(tp)) {
      console.error(`${CLR_RED}Помилка: шлях '${tp}' не знайдено.${CLR_RESET}`);
      process.exit(1);
    }
  }

  if (!keyPath) {
    keyPath = findDefaultKey();
  }
  if (!certPath && process.env.QES_CERT && fs.existsSync(process.env.QES_CERT)) {
    certPath = path.resolve(process.env.QES_CERT);
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

  for (let idx = 0; idx < targetPaths.length; idx++) {
    const curPath = targetPaths[idx];
    console.log(`\n${CLR_GRAY}⏳ [${idx + 1}/${targetPaths.length}] Криптографічне шифрування (${path.basename(curPath)})...${CLR_RESET}`);

    const curOutput = (targetPaths.length === 1 && outputPath) ? outputPath : null;

    try {
      const res = await engine.encryptFile(boxInfo.box, curPath, {
        recipientCertPath,
        outputPath: curOutput,
        raw: rawP7e,
      });

      console.log(`${CLR_GREEN}================================================================================${CLR_RESET}`);
      console.log(`${CLR_BOLD}${CLR_GREEN} ✅ ОБ'ЄКТ УСПІШНО ЗАШИФРОВАНО!${CLR_RESET}`);
      console.log(`  ${CLR_BOLD}Зашифрований файл:${CLR_RESET}   ${res.outputPath} (${res.encryptedSize} байт)`);
      console.log(`  ${CLR_BOLD}Формат контейнера:${CLR_RESET}   ${res.format}`);
      console.log(`  ${CLR_BOLD}Режим шифрування:${CLR_RESET}    ${res.isSelfEncrypted ? '🔐 Особистий сейф (шифрування для себе)' : '🎯 Спрямоване шифрування на адресата'}`);
      if (res.recipientInfo) {
        console.log(`  ${CLR_BOLD}Отримувач:${CLR_RESET}           ${res.recipientInfo.commonName} (РНОКПП: ${res.recipientInfo.rnokpp || '—'})`);
      }
      console.log(`${CLR_GREEN}================================================================================${CLR_RESET}`);
    } catch (err) {
      console.error(`\n${CLR_RED}❌ Помилка шифрування '${path.basename(curPath)}': ${err.message}${CLR_RESET}\n`);
    }
  }
}

main().catch((e) => {
  console.error(`${CLR_RED}Непередбачена помилка:${CLR_RESET}`, e);
  process.exit(1);
});
