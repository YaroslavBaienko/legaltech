#!/usr/bin/env node
/**
 * qes-sign — CLI tool for signing documents with Ukrainian Qualified Electronic Signature (КЕП / ДСТУ 4145).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const { QESEngine } = require('../src/engine');
const { getOrPromptPassword, sendAgentMessage } = require('../src/session');
const { t } = require('../src/i18n');
const {
  chooseSigningMedium,
  getConnectedHardwareTokens,
  signWithHardwareToken,
} = require('../src/token-signer');

const CLR_RESET = '\x1b[0m';
const CLR_BOLD = '\x1b[1m';
const CLR_GREEN = '\x1b[32m';
const CLR_RED = '\x1b[31m';
const CLR_YELLOW = '\x1b[33m';
const CLR_CYAN = '\x1b[36m';
const CLR_GRAY = '\x1b[90m';

function askPassword(promptText, forceGui = false) {
  return new Promise((resolve, reject) => {
    // If environment variable provided
    if (process.env.QES_PASSWORD) {
      return resolve(process.env.QES_PASSWORD);
    }

    // If GUI requested or not a TTY terminal, check if GNOME graphical desktop is available
    if ((forceGui || !process.stdin.isTTY) && (process.env.DISPLAY || process.env.WAYLAND_DISPLAY)) {
      try {
        const cleanPrompt = promptText.replace(/\x1b\[[0-9;]*m/g, '');
        const isPin = cleanPrompt.toLowerCase().includes('pin');
        const lang = getQESLang();

        const dlgTitle = isPin
          ? (lang === 'en' ? 'Hardware Token Authorization — QES Tools' : 'Авторизація апаратного токена — QES Tools')
          : (lang === 'en' ? 'Private Key Authorization — QES Tools' : 'Авторизація особистого ключа — QES Tools');

        const header = isPin
          ? (lang === 'en' ? '🔑 Hardware Token PIN (ЗНОК)' : '🔑 Авторизація апаратного токена (ЗНОК)')
          : (lang === 'en' ? '🔐 Enter Private Key Password' : '🔐 Введення пароля особистого КЕП');

        const sub = isPin
          ? (lang === 'en' ? 'Key is hardware protected. Signing occurs directly on the crypto chip.' : 'Ключ захищено апаратно. Підписання відбувається всередині смарт-чіпа.')
          : (lang === 'en' ? 'Password is safe in RAM session cache (TTL 15 min).' : 'Пароль надійно зберігатиметься виключно в оперативній пам\'яті сесії RAM.');

        const pangoText = `<span size="larger" weight="bold" color="#2a75d3">${header}</span>\n\n${cleanPrompt}\n<span size="small" color="#666666">${sub}</span>`;

        const PAPIRUS_LOCK_ICON = fs.existsSync('/home/attor/.local/share/icons/Papirus/48x48/status/stock_lock.svg')
          ? '/home/attor/.local/share/icons/Papirus/48x48/status/stock_lock.svg'
          : null;

        const zenArgs = [
          '--password',
          `--title=${dlgTitle}`,
          `--text=${pangoText}`,
          '--icon-name=dialog-password',
          '--ok-label=' + (lang === 'en' ? 'Authorize' : 'Підтвердити'),
          '--cancel-label=' + (lang === 'en' ? 'Cancel' : 'Скасувати'),
        ];
        if (PAPIRUS_LOCK_ICON) zenArgs.push(`--window-icon=${PAPIRUS_LOCK_ICON}`);

        const zRes = spawnSync('zenity', zenArgs, { encoding: 'utf-8' });
        if (zRes.status === 0 && zRes.stdout) {
          return resolve(zRes.stdout.trim());
        } else if (zRes.status !== 0) {
          return reject(new Error(t('pwdCancelled')));
        }
      } catch (err) {
        // Fall back to readline
      }
    }

    const stdin = process.stdin;
    process.stdout.write(promptText);

    if (!stdin.isTTY) {
      // Non-interactive fallback: read line silently without echo
      let buf = '';
      const onChunk = (chunk) => {
        buf += chunk.toString();
        if (buf.includes('\n')) {
          stdin.removeListener('data', onChunk);
          return resolve(buf.split('\n')[0].replace(/\r$/, ''));
        }
      };
      stdin.on('data', onChunk);
      return;
    }

    let password = '';
    const oldRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();

    const onData = (chunk) => {
      const str = chunk.toString();
      for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (c === '\n' || c === '\r' || c === '\u0004') {
          stdin.removeListener('data', onData);
          stdin.setRawMode(oldRaw);
          stdin.pause();
          process.stdout.write('\n');
          return resolve(password);
        } else if (c === '\u0003') {
          // Ctrl+C
          stdin.removeListener('data', onData);
          stdin.setRawMode(oldRaw);
          stdin.pause();
          process.stdout.write('\n');
          process.exit(130);
        } else if (c === '\u007f' || c === '\b') {
          // Backspace
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
${CLR_BOLD}${CLR_CYAN}  qes-sign — автономний інструмент підписання КЕП (ДСТУ 4145-2002 / PAdES / CAdES)${CLR_RESET}
${CLR_BOLD}${CLR_CYAN}  Версія 1.0.0 | 100% Offline-First | Захист адвокатської таємниці${CLR_RESET}
${CLR_BOLD}${CLR_CYAN}================================================================================${CLR_RESET}

${CLR_BOLD}ОПИС:${CLR_RESET}
  Накладає кваліфікований або удосконалений електронний підпис (КЕП / УЕП) на будь-які
  файли (PDF, DOCX, XLSX, XML, ZIP тощо) згідно із законодавством України та стандартами
  ДСТУ 4145-2002, ETSI CAdES та ETSI PAdES.

${CLR_BOLD}ВИКОРИСТАННЯ:${CLR_RESET}
  qes-sign [ОПЦІЇ] <файл_для_підпису>

${CLR_BOLD}РЕЖИМИ ПІДПИСАННЯ:${CLR_RESET}
  ${CLR_GREEN}--pades${CLR_RESET}             Вшити підпис у структуру PDF (PAdES) зі штампом та QR-кодом
  ${CLR_GREEN}--asice${CLR_RESET}             Створити європейський пакетний архів ASiC-E (.asice) для кількох файлів
  ${CLR_GREEN}-a, --append${CLR_RESET}        Додати другий/черговий підпис (Мультипідписання: PDF PAdES, ASiC-E або .p7s)
  ${CLR_GREEN}--no-stamp${CLR_RESET}          Вимкнути накладання візуального штампа (для режиму --pades)
  ${CLR_GREEN}--stamp-page <стор>${CLR_RESET} Номер сторінки для розміщення штампа (за замовчуванням 'z' — остання)
  ${CLR_YELLOW}(за замовчуванням)${CLR_RESET}  Якщо прапорці відсутні: створює відокремлений файл підпису <файл>.p7s

${CLR_BOLD}ПАРАМЕТРИ КЛЮЧА ТА БЕЗПЕКИ:${CLR_RESET}
  ${CLR_GREEN}--key <шлях>${CLR_RESET}        Шлях до файлу контейнера ключа (.pfx / .p12).
                      За замовчуванням: діалог вибору носія (файловий ключ ~/.secure_keys/ або токен)
  ${CLR_GREEN}-t, --token${CLR_RESET}         Використати для підпису підключений апаратний USB-токен (ЗНОК)
  ${CLR_GREEN}--cert <шлях>${CLR_RESET}       Шлях до відкритого сертифіката (.cer / .crt).
                      Якщо не вказано: шукається всередині .pfx або поруч із ключем
  ${CLR_GREEN}--ttl <хв>${CLR_RESET}          Час збереження пароля в сесії RAM (за замовчуванням 15 хв, до 120 хв)
  ${CLR_GREEN}--no-cache${CLR_RESET}          Вимкнути тимчасове збереження пароля в сесії для цієї операції
  ${CLR_GREEN}--clear-cache${CLR_RESET}       Очистити всі збережені паролі з оперативної пам'яті перед виконанням
  ${CLR_GREEN}--gui${CLR_RESET}               Відображати графічне вікно введення пароля (Zenity) замість консолі
  ${CLR_GREEN}-o, --output <шлях>${CLR_RESET} Шлях та назва збереження вихідного файлу
  ${CLR_GREEN}--no-tsp${CLR_RESET}            Не додавати позначку точного часу TSP від АЦСК/КНЕДП
  ${CLR_GREEN}--no-verify${CLR_RESET}         Вимкнути автоматичну перевірку qes-verify після завершення підпису
  ${CLR_GREEN}-h, --help${CLR_RESET}          Показати цей розширений мануал та приклади команд

${CLR_BOLD}ПРИКЛАДИ КОМАНД:${CLR_RESET}

  ${CLR_BOLD}1. Пакетне підписання кількох документів в єдиний європейський архів ASiC-E:${CLR_RESET}
     $ qes-sign --asice contract.pdf appendix1.docx appendix2.xlsx -o package.asice
     ${CLR_GRAY}-> Формує стандартизований контейнер ETSI ASiC-E, завірений єдиним підписом КЕП.${CLR_RESET}

  ${CLR_BOLD}2. Судовий або клієнтський PDF (вшитий підпис зі штампом та QR-кодом):${CLR_RESET}
     $ qes-sign --pades statement.pdf
     ${CLR_GRAY}-> Створює statement_signed.pdf з офіційним векторизованим штампом та QR на останній сторінці.${CLR_RESET}

  ${CLR_BOLD}3. Графічне вікно введення пароля GNOME (зручно для робочого столу):${CLR_RESET}
     $ qes-sign --pades --gui statement.pdf

  ${CLR_BOLD}4. Підписання ключем іншої особи або ключем з іншої папки / флешки:${CLR_RESET}
     $ qes-sign --pades --key /media/usb/директор.pfx contract.pdf
     ${CLR_GRAY}-> Штамп автоматично формується з ПІБ, РНОКПП та КНЕДП власника вказаного ключа!${CLR_RESET}

  ${CLR_BOLD}5. Класичний відокремлений підпис (.p7s) для тендерів, Вчасно чи M.E.Doc:${CLR_RESET}
     $ qes-sign act_service.docx
     ${CLR_GRAY}-> Створює файл act_service.docx.p7s поруч з оригіналом.${CLR_RESET}

  ${CLR_BOLD}6. Вшитий PDF-підпис без візуального штампа (чистий криптографічний PAdES):${CLR_RESET}
     $ qes-sign --pades --no-stamp invoice.pdf

  ${CLR_BOLD}7. Розміщення візуального штампа на першій сторінці документа:${CLR_RESET}
     $ qes-sign --pades --stamp-page 1 resolution.pdf

  ${CLR_BOLD}8. Мультипідписання (накладання другого і наступних підписів):${CLR_RESET}
     $ qes-sign --append contract_signed.pdf
     ${CLR_GRAY}-> Додає другий підпис до PDF, автоматично розміщуючи штамп вище без пошкодження першого підпису!${CLR_RESET}
     $ qes-sign --append package.asice
     ${CLR_GRAY}-> Додає черговий підпис КЕП у європейський пакетний архів ASiC-E.${CLR_RESET}
     $ qes-sign --append act.docx.p7s
     ${CLR_GRAY}-> Об'єднує підписи двох сторін в єдиний файл .p7s (CAdES multi-signer).${CLR_RESET}

  ${CLR_BOLD}9. Керування пам'яттю сесії пароля (Session TTL):${CLR_RESET}
     $ qes-sign --pades --ttl 30 statement.pdf
     ${CLR_GRAY}-> Зберігає пароль у пам'яті RAM на 30 хвилин (наступні підписання не вимагатимуть вводу пароля).${CLR_RESET}
     $ qes-sign --no-cache contract.pdf
     ${CLR_GRAY}-> Підписує документ без збереження пароля в пам'яті.${CLR_RESET}
     $ qes-sign --clear-cache
     ${CLR_GRAY}-> Негайно вилучає всі паролі з оперативної пам'яті (скидання сесії).${CLR_RESET}

  ${CLR_BOLD}10. Збереження результату у спеціальну папку:${CLR_RESET}
     $ qes-sign --pades statement.pdf -o /home/attor/signed_docs/statement_final.pdf

${CLR_BOLD}СХОВИЩЕ КЛЮЧІВ: ~/.secure_keys/${CLR_RESET}
  • Якщо в ~/.secure_keys/ лежить один ключ, команда працює без вказування --key.
  • Відкриті сертифікати (.cer): більшість КНЕДП (ПриватБанк, Дія) вшивають відкритий
    сертифікат всередину .pfx. Для monobank достатньо покласти .cer поруч із .pfx.

${CLR_BOLD}ПЕРЕВІРКА ПІДПИСІВ:${CLR_RESET}
  Для швидкої перевірки будь-яких файлів використовуйте:
  $ qes-verify statement_signed.pdf
  $ qes-verify package.asice
  $ qes-verify act_service.docx.p7s
================================================================================
`);
    process.exit(0);
  }

  const inputFiles = [];
  let keyPath = null;
  let useToken = false;
  let certPath = null;
  let outputPath = null;
  let useTsp = true;
  let autoVerify = true;
  let useGui = false;
  let usePades = false;
  let useAsice = false;
  let useAppend = false;
  let useStamp = true;
  let stampPage = 'z';
  let noCache = false;
  let clearCacheFirst = false;
  let ttl = 900; // 15 min default (seconds)

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--key' && i + 1 < args.length) {
      keyPath = path.resolve(args[++i]);
    } else if (arg === '--token' || arg === '-t') {
      useToken = true;
    } else if (arg === '--cert' && i + 1 < args.length) {
      certPath = path.resolve(args[++i]);
    } else if ((arg === '--output' || arg === '-o') && i + 1 < args.length) {
      outputPath = path.resolve(args[++i]);
    } else if (arg === '--no-tsp') {
      useTsp = false;
    } else if (arg === '--no-verify') {
      autoVerify = false;
    } else if (arg === '--gui') {
      useGui = true;
    } else if (arg === '--pades') {
      usePades = true;
    } else if (arg === '--asice') {
      useAsice = true;
    } else if (arg === '--append' || arg === '-a') {
      useAppend = true;
    } else if (arg === '--no-stamp') {
      useStamp = false;
    } else if (arg === '--stamp-page' && i + 1 < args.length) {
      stampPage = args[++i];
    } else if (arg === '--no-cache') {
      noCache = true;
    } else if (arg === '--clear-cache') {
      clearCacheFirst = true;
    } else if (arg === '--ttl' && i + 1 < args.length) {
      ttl = parseInt(args[++i], 10) * 60;
      if (isNaN(ttl) || ttl < 60) ttl = 900;
    } else if (!arg.startsWith('-')) {
      inputFiles.push(path.resolve(arg));
    }
  }

  if (inputFiles.length === 0) {
    if (useGui) {
      const filterArgs = usePades
        ? ['--file-filter=PDF Документи (*.pdf) | *.pdf', '--file-filter=Усі файли (*.*) | *.*']
        : ['--file-filter=Усі файли (*.*) | *.*'];
      const title = usePades
        ? 'Оберіть PDF-документ для накладання КЕП (PAdES зі штампом)'
        : 'Оберіть документ або папку для підписання КЕП';
      const selProc = spawnSync('zenity', [
        '--file-selection',
        `--title=${title}`,
        ...filterArgs,
      ], { encoding: 'utf8' });
      const chosen = selProc.stdout ? selProc.stdout.trim() : '';
      if (!chosen) {
        process.exit(0);
      }
      inputFiles.push(path.resolve(chosen));
    } else {
      console.error(`${CLR_RED}Помилка: не вказано файл(и) або папку для підписання.${CLR_RESET}`);
      process.exit(1);
    }
  }

  const resolvedFiles = [];
  let detectedFolder = null;

  for (const fp of inputFiles) {
    if (!fs.existsSync(fp)) {
      console.error(`${CLR_RED}Помилка: шлях '${fp}' не знайдено.${CLR_RESET}`);
      process.exit(1);
    }

    const stat = fs.statSync(fp);
    if (stat.isDirectory()) {
      detectedFolder = fp;
      useAsice = true; // Passing a folder implies batch container signing!
      const dirEntries = fs.readdirSync(fp).sort();
      for (const entry of dirEntries) {
        if (entry.startsWith('.')) continue; // ignore hidden
        if (entry.endsWith('.asice') || entry.endsWith('.asics') || entry.endsWith('.p7s')) continue;
        const entryPath = path.join(fp, entry);
        if (fs.statSync(entryPath).isFile()) {
          resolvedFiles.push(entryPath);
        }
      }
    } else if (stat.isFile()) {
      resolvedFiles.push(fp);
    }
  }

  if (resolvedFiles.length === 0) {
    console.error(`${CLR_RED}Помилка: не знайдено файлів для підписання.${CLR_RESET}`);
    process.exit(1);
  }

  if (detectedFolder) {
    console.log(`${CLR_CYAN}📁 Виявлено папку: ${path.basename(detectedFolder)}/ (знайдено файлів для підписання: ${resolvedFiles.length})${CLR_RESET}`);
    if (useAsice && !outputPath) {
      const parentDir = path.dirname(detectedFolder);
      const baseName = path.basename(detectedFolder);
      outputPath = path.join(parentDir, `${baseName}.asice`);
    }
  }

  // Update inputFiles with all expanded files
  inputFiles.length = 0;
  inputFiles.push(...resolvedFiles);

  const docPath = inputFiles[0];
  const docDesc = inputFiles.length === 1
    ? `${path.basename(inputFiles[0])} (${fs.statSync(inputFiles[0]).size} байт)`
    : `${inputFiles.length} файлів у пакеті`;

  // Контекстне вікно вибору носія підпису (файловий ключ або апаратний токен)
  if (!keyPath && !useToken) {
    const defaultCand = findDefaultKey();
    const mediumRes = await chooseSigningMedium({
      useGui,
      defaultKeyPath: defaultCand,
      inputFiles,
      askPasswordFn: askPassword,
    });

    if (mediumRes.cancelled) {
      console.log(`${CLR_YELLOW}Операцію підписання скасовано.${CLR_RESET}`);
      process.exit(0);
    }

    if (mediumRes.type === 'token') {
      useToken = true;
    } else if (mediumRes.type === 'file') {
      keyPath = mediumRes.keyPath;
    }
  }

  // Обробка підписання апаратним токеном (ЗНОК)
  if (useToken) {
    const tokState = getConnectedHardwareTokens();
    if (!tokState.detected || tokState.tokens.length === 0) {
      if (useGui) {
        spawnSync('zenity', [
          '--warning',
          '--title=Апаратний ключ КЕП',
          '--text=⚠️ Жодного апаратного токена не виявлено в USB-портах.\n\nБудь ласка, підключіть ваш апаратний носій (Алмаз-1К, Кристал-1К, SecureToken-337 тощо) у USB-порт комп\'ютера та спробуйте ще раз.',
        ]);
      } else {
        console.error(`${CLR_RED}Помилка: апаратних USB-токенів не виявлено в системі. Вставте токен і повторіть спробу.${CLR_RESET}`);
      }
      process.exit(1);
    }

    const activeTok = tokState.tokens[0];
    console.log(`${CLR_CYAN}╔═══════════════════════════════════════════════════════════════════════════════════════╗${CLR_RESET}`);
    console.log(`${CLR_CYAN}║ ПІДПИСАННЯ ДОКУМЕНТІВ КЕП (АПАРАТНИЙ ТОКЕН / ЗНОК)${CLR_RESET}`);
    console.log(`${CLR_CYAN}║ Об'єкт:   ${docDesc}${CLR_RESET}`);
    console.log(`${CLR_CYAN}║ Пристрій: ${activeTok.displayName}${CLR_RESET}`);
    console.log(`${CLR_CYAN}╚═══════════════════════════════════════════════════════════════════════════════════════╝${CLR_RESET}`);

    let pin = null;
    try {
      pin = await askPassword(`Введіть PIN-код доступу до токена (${activeTok.displayName}):`, useGui);
    } catch (e) {
      console.log(`${CLR_YELLOW}Операцію введення PIN-коду скасовано.${CLR_RESET}`);
      process.exit(0);
    }

    if (!pin) {
      process.exit(0);
    }

    for (let fIdx = 0; fIdx < inputFiles.length; fIdx++) {
      const curDoc = inputFiles[fIdx];
      const curOutput = (inputFiles.length === 1 && outputPath) ? outputPath : `${curDoc}.p7s`;

      console.log(`\n${CLR_GRAY}⏳ [${fIdx + 1}/${inputFiles.length}] Підписання апаратним токеном: ${path.basename(curDoc)}...${CLR_RESET}`);

      try {
        const res = signWithHardwareToken({
          inputPath: curDoc,
          outputPath: curOutput,
          pin,
          typeIndex: activeTok.typeIndex || 1,
          devIndex: activeTok.devIndex || 0,
          isAppend: useAppend,
          isInternal: false,
        });

        console.log(`\n${CLR_GREEN}✅ ДОКУМЕНТ УСПІШНО ПІДПИСАНО АПАРАТНИМ ТОКЕНОМ!${CLR_RESET}`);
        console.log(`  ${CLR_BOLD}Файл підпису:${CLR_RESET} ${res.outputPath} (${res.fileSize} байт)`);

        if (autoVerify) {
          console.log(`${CLR_CYAN}── Контрольна перевірка через qes-verify ──────────────────────────────────────────${CLR_RESET}`);
          spawnSync('qes-verify', [res.outputPath], { stdio: 'inherit' });
        }
      } catch (err) {
        if (useGui) {
          spawnSync('zenity', [
            '--error',
            '--title=Помилка апаратного токена',
            `--text=❌ ${err.message}`,
          ]);
        }
        console.error(`\n${CLR_RED}❌ Помилка підписання: ${err.message}${CLR_RESET}\n`);
        process.exit(1);
      }
    }
    process.exit(0);
  }

  // Обробка файлового ключа (.pfx / .p12)
  if (!certPath && process.env.QES_CERT && fs.existsSync(process.env.QES_CERT)) {
    certPath = path.resolve(process.env.QES_CERT);
  }

  if (!keyPath || !fs.existsSync(keyPath)) {
    console.error(`${CLR_RED}Помилка: файл ключа не знайдено в ~/.secure_keys/. Вкажіть через --key <шлях>.${CLR_RESET}`);
    process.exit(1);
  }

  console.log(`${CLR_CYAN}╔═══════════════════════════════════════════════════════════════════════════════════════╗${CLR_RESET}`);
  console.log(`${CLR_CYAN}║ ПІДПИСАННЯ ДОКУМЕНТІВ КЕП (ДСТУ 4145-2002)${CLR_RESET}`);
  console.log(`${CLR_CYAN}║ Об'єкт: ${docDesc}${CLR_RESET}`);
  console.log(`${CLR_CYAN}║ Ключ:   ${path.basename(keyPath)}${CLR_RESET}`);
  console.log(`${CLR_CYAN}╚═══════════════════════════════════════════════════════════════════════════════════════╝${CLR_RESET}`);

  // Load national CA bundle (all 21 accredited Ukrainian QTSPs) if available
  const caBundlePath = path.join(__dirname, '..', 'certs', 'ua-all-cas.p7b');
  const fallbackCaBundlePath = path.join(__dirname, '..', 'certs', 'mono.p7b');
  let casBuffer = null;
  if (fs.existsSync(caBundlePath)) {
    casBuffer = fs.readFileSync(caBundlePath);
  } else if (fs.existsSync(fallbackCaBundlePath)) {
    casBuffer = fs.readFileSync(fallbackCaBundlePath);
  }

  if (clearCacheFirst) {
    await sendAgentMessage({ action: 'clear' }).catch(() => {});
  }

  const engine = new QESEngine({ casBuffer });

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
    console.error(`\n${CLR_RED}❌ Помилка ініціалізації: ${err.message}${CLR_RESET}\n`);
    process.exit(1);
  }

  if (!boxInfo.hasCert) {
    console.warn(`${CLR_YELLOW}⚠️ Увага: не вдалося знайти сертифікат відкритого ключа (.cer) локально чи через CMP.${CLR_RESET}`);
  }

  let hasErrors = false;
  const isSingleAsice = inputFiles.length === 1 && inputFiles[0].toLowerCase().endsWith('.asice');

  if (useAsice || isSingleAsice) {
    console.log(`${CLR_GRAY}⏳ Формування / оновлення контейнера ETSI ASiC-E...${CLR_RESET}`);

    try {
      const res = await engine.signAsice(boxInfo.box, inputFiles, {
        outputPath: outputPath,
        tsp: useTsp,
        append: useAppend,
      });

      if (res.isMultiSignature) {
        console.log(`\n${CLR_GREEN}✅ МУЛЬТИПІДПИС УСПІШНО ДОДАНО ДО ASiC-E! (Підпис #${res.sigCount})${CLR_RESET}`);
      } else {
        console.log(`\n${CLR_GREEN}✅ ПАКЕТНИЙ КОНТЕЙНЕР ASiC-E УСПІШНО СТВОРЕНО!${CLR_RESET}`);
      }
      console.log(`  ${CLR_BOLD}Файл контейнера:${CLR_RESET} ${res.outputPath} (${res.containerSize} байт)`);
      console.log(`  ${CLR_CYAN}Підписані файли (${res.fileCount}):${CLR_RESET} ${res.signedFiles.join(', ')}\n`);

      if (autoVerify) {
        console.log(`${CLR_CYAN}── Контрольна перевірка через qes-verify ──────────────────────────────────────────${CLR_RESET}`);
        const vRes = spawnSync('qes-verify', [res.outputPath], { stdio: 'inherit' });
        if (vRes.status !== 0) {
          console.warn(`${CLR_YELLOW}⚠️ Валідатор повернув статус ${vRes.status}${CLR_RESET}`);
        }
      }
    } catch (asiceErr) {
      console.error(`\n${CLR_RED}❌ Помилка обробки ASiC-E контейнера: ${asiceErr.message}${CLR_RESET}\n`);
      process.exit(1);
    }
  } else if (usePades || (useAppend && inputFiles.every((f) => f.toLowerCase().endsWith('.pdf')))) {
    for (let fIdx = 0; fIdx < inputFiles.length; fIdx++) {
      const curDoc = inputFiles[fIdx];
      if (!curDoc.toLowerCase().endsWith('.pdf')) {
        console.warn(`${CLR_YELLOW}⚠️ Пропуск файлу '${path.basename(curDoc)}': режим PAdES підтримується лише для PDF-файлів.${CLR_RESET}`);
        continue;
      }

      console.log(`\n${CLR_GRAY}⏳ [${fIdx + 1}/${inputFiles.length}] Підписання PAdES: ${path.basename(curDoc)}...${CLR_RESET}`);
      const curOutput = (inputFiles.length === 1 && outputPath) ? outputPath : null;

      try {
        const res = await engine.signPdfPAdES(boxInfo.box, curDoc, {
          outputPath: curOutput,
          stamp: useStamp,
          page: stampPage,
          tsp: useTsp,
          append: useAppend,
        });

        if (res.isMultiSignature) {
          console.log(`${CLR_GREEN}✅ МУЛЬТИПІДПИС УСПІШНО ВШИТО У PDF (Підпис #${res.sigCount}):${CLR_RESET} ${res.outputPath} (${res.fileSize} байт)`);
        } else {
          console.log(`${CLR_GREEN}✅ УСПІШНО ВШИТО У PDF (PAdES):${CLR_RESET} ${res.outputPath} (${res.fileSize} байт)`);
        }
        if (autoVerify) {
          spawnSync('qes-verify', [res.outputPath], { stdio: 'inherit' });
        }
      } catch (padesErr) {
        hasErrors = true;
        console.error(`${CLR_RED}❌ Помилка PAdES підписання для '${path.basename(curDoc)}': ${padesErr.message}${CLR_RESET}`);
      }
    }
  } else {
    for (let fIdx = 0; fIdx < inputFiles.length; fIdx++) {
      const curDoc = inputFiles[fIdx];
      console.log(`\n${CLR_GRAY}⏳ [${fIdx + 1}/${inputFiles.length}] Підписання CAdES: ${path.basename(curDoc)}...${CLR_RESET}`);
      const curOutput = (inputFiles.length === 1 && outputPath) ? outputPath : (curDoc.toLowerCase().endsWith('.p7s') ? curDoc : `${curDoc}.p7s`);

      try {
        const res = await engine.signDocument(boxInfo.box, curDoc, {
          outputPath: curOutput,
          detached: true,
          tsp: useTsp,
          append: useAppend,
        });

        if (res.isMultiSignature) {
          console.log(`${CLR_GREEN}✅ МУЛЬТИПІДПИС CAdES УСПІШНО ДОДАНО (Підпис #${res.sigCount}):${CLR_RESET} ${res.outputPath} (${res.signatureBytes} байт)`);
        } else {
          console.log(`${CLR_GREEN}✅ ПІДПИС СТВОРЕНО:${CLR_RESET} ${res.outputPath} (${res.signatureBytes} байт)`);
        }
        if (autoVerify) {
          spawnSync('qes-verify', [res.outputPath], { stdio: 'inherit' });
        }
      } catch (signErr) {
        hasErrors = true;
        console.error(`${CLR_RED}❌ Помилка підписання '${path.basename(curDoc)}': ${signErr.message}${CLR_RESET}`);
      }
    }
  }

  if (hasErrors) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`${CLR_RED}Непередбачена помилка:${CLR_RESET}`, e);
  process.exit(1);
});
