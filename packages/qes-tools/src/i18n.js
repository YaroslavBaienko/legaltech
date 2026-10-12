/**
 * i18n.js — QES Tools Internationalization & Localization (UK / EN)
 * Модуль багатомовності для комплексу юридичних інструментів КЕП.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function getQESLang() {
  if (process.env.QES_LANG) {
    const ql = process.env.QES_LANG.toLowerCase();
    if (ql === 'en') return 'en';
    if (ql === 'uk' || ql === 'ua') return 'uk';
  }

  try {
    const cfgPath = path.join(process.env.HOME || '', '.config', 'qes', 'config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (cfg && cfg.lang === 'en') return 'en';
      if (cfg && (cfg.lang === 'uk' || cfg.lang === 'ua')) return 'uk';
    }
  } catch {}

  const l = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || process.env.LANGUAGE || '';
  return l.toLowerCase().startsWith('uk') ? 'uk' : 'en';
}

const strings = {
  uk: {
    // Dialogs & Prompts
    dialogTitle: 'КЕП (ДСТУ 4145-2002)',
    encryptDialogTitle: 'Шифрування КЕП (ДСТУ 4145)',
    encryptHeader: '🛡️ Захист особистого сейфа (.enc)',
    encryptSub: 'Шифрування здійснюється за стандартом ДСТУ 4145 / ГОСТ 28147:89',
    decryptDialogTitle: 'Розшифрування КЕП (ДСТУ 4145)',
    decryptHeader: '🔓 Розшифрування особистим КЕП',
    decryptSub: 'Введіть пароль вашого особистого ключа для відкриття зашифрованого файлу (.enc):',
    exportCertDialogTitle: 'Експорт сертифіката КЕП',
    exportCertHeader: '📤 Експорт відкритого сертифіката (.cer)',
    exportCertSub: 'Введіть пароль для безпечного видобування відкритого сертифіката з контейнера КЕП:',
    enterPassword: (label) => `Введіть пароль до ключа \x1b[1m${label}\x1b[0m: `,
    sessionActive: (timeStr) => `\x1b[32m🔑 Сесія КЕП активна:\x1b[0m пароль отримано з пам'яті (залишилось ${timeStr})`,
    stalePassword: '⚠️ Збережений у сесії пароль не підійшов до ключа. Запитуємо знову...',
    initCrypto: '⏳ Ініціалізація крипторушія ДСТУ 4145...',
    cachedSession: (min) => `\x1b[90m🔒 Пароль закешовано в оперативній пам'яті (сесія на ${min} хв)\x1b[0m`,
    pwdCancelled: 'Введення пароля скасовано користувачем.',
    noKeyFound: 'Помилка: файл ключа не знайдено в ~/.secure_keys/. Вкажіть через --key <шлях>.',

    // Agent CLI
    agentHeader: 'СТАТУС СЕСІЇ КЕП (qes-agent)',
    socket: 'Сокет',
    memory: "Пам'ять: 100% RAM / tmpfs (права 0600)",
    activeKeys: 'Активних ключів',
    noActiveSessions: 'Немає активних сесій (кеш порожній). Пароль буде запитано при наступній дії.',
    remTime: 'Залишилось часу',
    ttl: 'TTL',
    agentInactive: 'Агент: Не активний (буде запущено автоматично при першому підписанні)',
    clearedKeys: (c) => `🔒 Сесію КЕП завершено: вилучено ${c} ключ(ів) з оперативної пам'яті.`,
    agentStopped: '✅ Агента qes-agent успішно зупинено.',
    agentAlreadyStopped: 'ℹ️ Агент уже не активний.',
    agentEmptyOrNotRunning: 'ℹ️ Агент не був запущений або кеш уже порожній.',

    // Verification & Certificates
    sigValid: 'ПІДПИС ДІЙСНИЙ',
    sigInvalid: 'ПІДПИС НЕДІЙСНИЙ',
    signer: 'Підписувач',
    drfo: 'РНОКПП (ДРФО)',
    edrpou: 'ЄДРПОУ',
    org: 'Організація',
    cert: 'Сертифікат',
    timeSigned: 'Час підпису',
    tsp: 'Позначка часу (TSP)',
  },
  en: {
    // Dialogs & Prompts
    dialogTitle: 'QES (DSTU 4145-2002)',
    encryptDialogTitle: 'QES Encryption (DSTU 4145)',
    encryptHeader: '🛡️ Protect Personal Vault (.enc)',
    encryptSub: 'Encryption is performed per DSTU 4145 / GOST 28147:89 standards.',
    decryptDialogTitle: 'QES Decryption (DSTU 4145)',
    decryptHeader: '🔓 Decrypt with Personal Key',
    decryptSub: 'Enter password for your personal private key to open encrypted file (.enc):',
    exportCertDialogTitle: 'Export QES Certificate',
    exportCertHeader: '📤 Export Public Certificate (.cer)',
    exportCertSub: 'Enter password to safely extract public certificate from QES container:',
    enterPassword: (label) => `Enter password for key \x1b[1m${label}\x1b[0m: `,
    sessionActive: (timeStr) => `\x1b[32m🔑 QES session active:\x1b[0m password retrieved from memory (${timeStr} remaining)`,
    stalePassword: '⚠️ Cached session password did not match the key. Prompting again...',
    initCrypto: '⏳ Initializing DSTU 4145 cryptographic engine...',
    cachedSession: (min) => `\x1b[90m🔒 Password cached in memory (session for ${min} min)\x1b[0m`,
    pwdCancelled: 'Password entry was cancelled by user.',
    noKeyFound: 'Error: key file not found in ~/.secure_keys/. Specify via --key <path>.',

    // Agent CLI
    agentHeader: 'QES SESSION STATUS (qes-agent)',
    socket: 'Socket',
    memory: 'Memory: 100% RAM / tmpfs (permissions 0600)',
    activeKeys: 'Active keys',
    noActiveSessions: 'No active sessions (cache is empty). Password will be requested on next action.',
    remTime: 'Remaining time',
    ttl: 'TTL',
    agentInactive: 'Agent: Not active (will start automatically on first signing)',
    clearedKeys: (c) => `🔒 QES session cleared: removed ${c} key(s) from memory.`,
    agentStopped: '✅ Agent qes-agent stopped successfully.',
    agentAlreadyStopped: 'ℹ️ Agent is not currently running.',
    agentEmptyOrNotRunning: 'ℹ️ Agent was not running or cache is already empty.',

    // Verification & Certificates
    sigValid: 'SIGNATURE VALID',
    sigInvalid: 'SIGNATURE INVALID',
    signer: 'Signer',
    drfo: 'Tax ID (RNOKPP)',
    edrpou: 'USREOU (Company ID)',
    org: 'Organization',
    cert: 'Certificate',
    timeSigned: 'Signing Time',
    tsp: 'Time Stamp (TSP)',
  }
};

function t(key, ...args) {
  const lang = getQESLang();
  const dict = strings[lang] || strings.uk;
  const val = dict[key] !== undefined ? dict[key] : (strings.uk[key] !== undefined ? strings.uk[key] : key);
  if (typeof val === 'function') {
    return val(...args);
  }
  return val;
}

module.exports = {
  getQESLang,
  t,
  strings,
};
