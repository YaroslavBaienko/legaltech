#!/usr/bin/env node
/**
 * qes-export-cert — Експорт відкритого сертифіката (.cer) з контейнера КЕП (.pfx).
 * Безпечно експортує лише відкритий ключ без витоку закритого ключа.
 */

'use strict';

const fs = require('fs');
const path = require('path');
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
      const pangoText = `<span size="larger" weight="bold" color="#2a75d3">📤 Експорт відкритого сертифіката (.cer)</span>\n\n${cleanPrompt}\n<span size="small" color="#666666">Введіть пароль для безпечного видобування відкритого сертифіката з контейнера КЕП:</span>`;
      const PAPIRUS_CERT_ICON = fs.existsSync('/home/attor/.local/share/icons/Papirus/48x48/mimetypes/application-certificate.svg')
        ? '/home/attor/.local/share/icons/Papirus/48x48/mimetypes/application-certificate.svg'
        : null;

      const zenArgs = [
        '--password',
        `--title=${t('exportCertDialogTitle')}`,
        `--text=${pangoText}`,
        '--icon-name=application-certificate',
        '--ok-label=Експортувати',
        '--cancel-label=Скасувати',
      ];
      if (PAPIRUS_CERT_ICON) zenArgs.push(`--window-icon=${PAPIRUS_CERT_ICON}`);

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
  if (args.includes('-h') || args.includes('--help')) {
    console.log(`
${CLR_BOLD}${CLR_CYAN}================================================================================${CLR_RESET}
${CLR_BOLD}${CLR_CYAN}  qes-export-cert — експорт відкритого сертифіката (.cer) з КЕП${CLR_RESET}
${CLR_BOLD}${CLR_CYAN}  100% Offline-First | Безпечний експорт для передачі клієнтам та колегам${CLR_RESET}
${CLR_BOLD}${CLR_CYAN}================================================================================${CLR_RESET}

${CLR_BOLD}ОПИС:${CLR_RESET}
  Видобуває відкритий сертифікат X.509 (.cer) з вашого контейнера .pfx.
  Цей файл НЕ містить закритого ключа або конфіденційних секретів.
  Ви можете сміливо передавати його клієнтам, судам чи партнерам, щоб вони могли
  перевіряти ваші підписи або шифрувати для вас документи через 'qes-encrypt -r'.

${CLR_BOLD}ВИКОРИСТАННЯ:${CLR_RESET}
  qes-export-cert [ОПЦІЇ]

${CLR_BOLD}ОПЦІЇ:${CLR_RESET}
  ${CLR_GREEN}--key <шлях>${CLR_RESET}        Контейнер особистого ключа (.pfx). За замовчуванням: ~/.secure_keys/
  ${CLR_GREEN}--ttl <хв>${CLR_RESET}          Час збереження пароля в сесії RAM (за замовчуванням 15 хв, до 120 хв)
  ${CLR_GREEN}--no-cache${CLR_RESET}          Вимкнути тимчасове збереження пароля в сесії для цієї операції
  ${CLR_GREEN}--clear-cache${CLR_RESET}       Очистити збережені паролі з оперативної пам'яті перед виконанням
  ${CLR_GREEN}-o, --output <шлях>${CLR_RESET} Куди зберегти сертифікат (.cer)
  ${CLR_GREEN}--gui${CLR_RESET}               Графічне вікно введення пароля (Zenity)
  ${CLR_GREEN}-h, --help${CLR_RESET}          Показати цю довідку

${CLR_BOLD}ПРИКЛАДИ КОМАНД:${CLR_RESET}
  $ qes-export-cert
  $ qes-export-cert -o /home/attor/Desktop/Мій_Сертифікат_КЕП.cer
================================================================================
`);
    process.exit(0);
  }

  let keyPath = null;
  let outputPath = null;
  let useGui = false;
  let noCache = false;
  let clearCacheFirst = false;
  let ttl = 900;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--key' && i + 1 < args.length) {
      keyPath = path.resolve(args[++i]);
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

  console.log(`${CLR_GRAY}⏳ Видобування відкритого сертифіката...${CLR_RESET}`);

  let boxInfo;
  try {
    boxInfo = await getOrPromptPassword({
      keyPath,
      engine,
      useGui,
      noCache,
      ttl,
      askPasswordFn: askPassword,
    });
  } catch (err) {
    console.error(`\n${CLR_RED}❌ Помилка зчитування ключа: ${err.message}${CLR_RESET}\n`);
    process.exit(1);
  }

  const cert = boxInfo.box.keys.find((k) => k.cert)?.cert;
  if (!cert) {
    console.error(`${CLR_RED}❌ Помилка: у файлі ключа не виявлено відкритого сертифіката.${CLR_RESET}`);
    process.exit(1);
  }

  const subj = cert.subject || {};
  const commonName = subj.commonName || subj.organizationName || 'Власник_КЕП';
  const cleanName = commonName.replace(/[\s/\\?%*:|"<>]/g, '_');

  if (!outputPath) {
    outputPath = path.resolve(`${cleanName}_сертифікат_КЕП.cer`);
  }

  const certDer = cert.as_asn1();
  fs.writeFileSync(outputPath, certDer);

  console.log(`\n${CLR_GREEN}================================================================================${CLR_RESET}`);
  console.log(`${CLR_BOLD}${CLR_GREEN} ✅ ВІДКРИТИЙ СЕРТИФІКАТ УСПІШНО ЕКСПОРТОВАНО!${CLR_RESET}`);
  console.log(`${CLR_GREEN}================================================================================${CLR_RESET}`);
  console.log(`  ${CLR_BOLD}Файл сертифіката:${CLR_RESET}  ${outputPath} (${certDer.length} байт)`);
  console.log(`  ${CLR_BOLD}Власник:${CLR_RESET}           ${commonName}`);
  if (subj.serialNumber) {
    console.log(`  ${CLR_BOLD}РНОКПП:${CLR_RESET}            ${subj.serialNumber}`);
  }
  const issuer = cert.issuer || {};
  console.log(`  ${CLR_BOLD}КНЕДП (АЦСК):${CLR_RESET}      ${issuer.commonName || issuer.organizationName || '—'}`);
  console.log(`\n${CLR_CYAN}ℹ️  Цей файл містить виключно публічні дані. Ви можете вільно пересилати${CLR_RESET}`);
  console.log(`${CLR_CYAN}   його клієнтам або партнерам для захищеного листування.${CLR_RESET}\n`);
}

main().catch((e) => {
  console.error(`${CLR_RED}Непередбачена помилка:${CLR_RESET}`, e);
  process.exit(1);
});
