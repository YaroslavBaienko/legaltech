#!/usr/bin/env node
/**
 * qes-agent — Демон сесій паролів (RAM TTL), Web Sign Agent (HTTP 8081 / HTTPS 8083)
 * та менеджер інтеграції з браузерами (Chrome, Chromium, Brave, Firefox) для токенів КЕП.
 * 100% RAM / tmpfs | Автономний захист адвокатської таємниці | Сумісність з EUSW.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');
const {
  getSocketPath,
  getPidPath,
  sendAgentMessage,
  runAgentServer,
} = require('../src/session');
const {
  startWebAgentServer,
  setupBrowserManifests,
  checkBrowserManifests,
  detectTokens,
  getNmhBinaryPath,
} = require('../src/web-agent');
const { t, getQESLang } = require('../src/i18n');

const CLR_RESET = '\x1b[0m';
const CLR_BOLD = '\x1b[1m';
const CLR_GREEN = '\x1b[32m';
const CLR_RED = '\x1b[31m';
const CLR_YELLOW = '\x1b[33m';
const CLR_CYAN = '\x1b[36m';
const CLR_GRAY = '\x1b[90m';

const WEB_AGENT_PID_FILE = path.join(os.homedir(), '.config', 'qes', 'web-agent.pid');

function isWebAgentRunning() {
  if (!fs.existsSync(WEB_AGENT_PID_FILE)) return false;
  try {
    const pid = parseInt(fs.readFileSync(WEB_AGENT_PID_FILE, 'utf8').trim(), 10);
    if (!pid || isNaN(pid)) return false;
    if (pid === process.pid) return false;
    process.kill(pid, 0); // test if process exists
    return pid;
  } catch (e) {
    return false;
  }
}

function showHelp() {
  const lang = getQESLang();
  console.log(`
${CLR_BOLD}${CLR_CYAN}================================================================================${CLR_RESET}
${CLR_BOLD}${CLR_CYAN}  qes-agent — Керування сесіями паролів, Web Sign Agent та браузерами для КЕП${CLR_RESET}
${CLR_BOLD}${CLR_CYAN}  100% Offline-First | Апаратні токени (Алмаз-1К, Кристал-1К) | EUSW Bridge${CLR_RESET}
${CLR_BOLD}${CLR_CYAN}================================================================================${CLR_RESET}

${CLR_BOLD}КОМАНДИ:${CLR_RESET}
  ${CLR_GREEN}qes-agent status${CLR_RESET}              Комплексний стан токенів, браузерів та фонових служб
  ${CLR_GREEN}qes-agent setup-browsers${CLR_RESET}      Встановити маніфести для Chrome, Chromium, Brave, Firefox
  ${CLR_GREEN}qes-agent start-web [--daemon]${CLR_RESET} Запустити Web Sign Agent (HTTP 8081 / HTTPS 8083) для сайтів
  ${CLR_GREEN}qes-agent stop-web${CLR_RESET}            Зупинити Web Sign Agent
  ${CLR_GREEN}qes-agent enable-service${CLR_RESET}      Увімкнути автозапуск служби qes-agent через systemd --user
  ${CLR_GREEN}qes-agent disable-service${CLR_RESET}     Вимкнути автозапуск служби qes-agent
  ${CLR_GREEN}qes-agent clear / lock${CLR_RESET}        Очистити кеш паролів з оперативної пам'яті (RAM)
  ${CLR_GREEN}qes-agent stop${CLR_RESET}                Зупинити фоновий менеджер паролів
  ${CLR_GREEN}qes-agent daemon${CLR_RESET}              Запустити менеджер сесій паролів вручну
  ${CLR_GREEN}qes-agent -h, --help${CLR_RESET}          Показати цю довідку

${CLR_BOLD}РОБОТА З БРАУЗЕРАМИ (Дія, Е-Суд, Кабінет платника податків, DepositSign):${CLR_RESET}
  1. Запустіть ${CLR_CYAN}qes-agent setup-browsers${CLR_RESET} для реєстрації Native Messaging Host.
  2. Переконайтесь, що в браузері встановлено офіційне розширення ІІТ:
     ${CLR_YELLOW}https://chromewebstore.google.com/detail/jffafkigfgmjafhpkoibhfefeaebmccg${CLR_RESET}
  3. Для порталів, що очікують локальний веб-агент без розширення, запустіть:
     ${CLR_CYAN}qes-agent start-web --daemon${CLR_RESET} (порти 8081 та 8083).
================================================================================
`);
}

async function handleStatus() {
  const lang = getQESLang();
  console.log(`\n${CLR_BOLD}${CLR_CYAN}╔═══════════════════════════════════════════════════════════════════════════════════════╗${CLR_RESET}`);
  console.log(`${CLR_BOLD}${CLR_CYAN}║ СТАТУС СЕСІЇ ТА ДІАГНОСТИКА АГЕНТА QES TOOLS / QES SESSION STATUS & TOKENS${CLR_RESET}`);
  console.log(`${CLR_CYAN}╟───────────────────────────────────────────────────────────────────────────────────────╢${CLR_RESET}`);

  // 1. Hardware USB Tokens
  const tokens = detectTokens();
  console.log(`${CLR_CYAN}║ ${CLR_BOLD}🔑 ПІДКЛЮЧЕНІ АПАРАТНІ ТОКЕНИ / HARDWARE TOKENS:${CLR_RESET}`);
  if (tokens.length === 0) {
    console.log(`${CLR_CYAN}║   ${CLR_GRAY}• Апаратних USB-токенів не виявлено (вставте токен у роз'єм USB)${CLR_RESET}`);
  } else {
    for (const tok of tokens) {
      console.log(`${CLR_CYAN}║   • ${CLR_BOLD}${CLR_GREEN}${tok.name}${CLR_RESET} (${tok.vendorId}:${tok.productId})`);
      console.log(`${CLR_CYAN}║     Драйвер: ${CLR_YELLOW}/opt/iit/eu/sw/${tok.driver}${CLR_RESET} | ${tok.type}`);
    }
  }

  // 2. Smartcard daemon (pcscd)
  let pcscdStatus = 'inactive';
  try {
    const pOut = execSync('systemctl is-active pcscd 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (pOut === 'active') pcscdStatus = 'active';
  } catch (e) {}
  console.log(`${CLR_CYAN}║ • Служба смарт-карт (pcscd): ${pcscdStatus === 'active' ? CLR_GREEN + 'активна (active) ✅' : CLR_YELLOW + 'зупинена (запускається автоматично по сокету) ℹ️'}${CLR_RESET}`);

  // 3. EUSW Native Messaging Host binary
  const nmhPath = getNmhBinaryPath();
  const nmhExists = fs.existsSync(nmhPath);
  console.log(`${CLR_CYAN}║ • Модуль EUSW NMH (/opt/iit/eu/sw/euscpnmh): ${nmhExists ? CLR_GREEN + 'наявний ✅' : CLR_RED + 'відсутній ❌'}${CLR_RESET}`);

  // 4. Browser Native Messaging Manifests
  console.log(`${CLR_CYAN}╟───────────────────────────────────────────────────────────────────────────────────────╢${CLR_RESET}`);
  console.log(`${CLR_CYAN}║ ${CLR_BOLD}🌐 СТАН ІНТЕГРАЦІЇ З БРАУЗЕРАМИ (NATIVE MESSAGING HOST):${CLR_RESET}`);
  const manifests = checkBrowserManifests();
  for (const m of manifests) {
    const icon = m.exists && m.valid ? `${CLR_GREEN}✅${CLR_RESET}` : (m.exists ? `${CLR_YELLOW}⚠️ (недійсний бінарник)${CLR_RESET}` : `${CLR_GRAY}❌ не налаштовано${CLR_RESET}`);
    console.log(`${CLR_CYAN}║   • ${m.name.padEnd(26)}: ${icon}`);
  }

  // 5. Web Sign Agent (HTTP 8081 / HTTPS 8083)
  console.log(`${CLR_CYAN}╟───────────────────────────────────────────────────────────────────────────────────────╢${CLR_RESET}`);
  console.log(`${CLR_CYAN}║ ${CLR_BOLD}📡 СЛУЖБА WEB SIGN AGENT (HTTP 8081 / HTTPS 8083):${CLR_RESET}`);
  const webPid = isWebAgentRunning();
  if (webPid) {
    console.log(`${CLR_CYAN}║   • Статус: ${CLR_BOLD}${CLR_GREEN}Працює (PID: ${webPid}) ✅${CLR_RESET}`);
    console.log(`${CLR_CYAN}║   • Порти:  ${CLR_YELLOW}http://127.0.0.1:8081${CLR_RESET} та ${CLR_YELLOW}https://127.0.0.1:8083${CLR_RESET}`);
  } else {
    console.log(`${CLR_CYAN}║   • Статус: ${CLR_GRAY}Зупинено (для запуску: qes-agent start-web --daemon)${CLR_RESET}`);
  }

  // 6. Password RAM cache status
  console.log(`${CLR_CYAN}╟───────────────────────────────────────────────────────────────────────────────────────╢${CLR_RESET}`);
  console.log(`${CLR_CYAN}║ ${CLR_BOLD}🔒 КЕШУВАННЯ ПАРОЛІВ У ПАМ'ЯТІ (SESSION TTL):${CLR_RESET}`);
  try {
    const res = await sendAgentMessage({ action: 'status' }, { timeoutMs: 800 });
    if (res && res.status === 'ok') {
      if (res.count === 0) {
        console.log(`${CLR_CYAN}║   • Активних ключів: 0 (${lang === 'en' ? 'Active keys: 0' : 'немає активних сесій'})${CLR_RESET}`);
      } else {
        console.log(`${CLR_CYAN}║   • Активних ключів: ${res.count} (${lang === 'en' ? 'Active keys: ' + res.count : 'у RAM'})${CLR_RESET}`);
        for (const k of res.active || []) {
          const mins = Math.floor(k.remainingSec / 60);
          const secs = k.remainingSec % 60;
          console.log(`${CLR_CYAN}║     - ${k.label}: залишилось ${mins} хв ${secs} с`);
        }
      }
    } else {
      console.log(`${CLR_CYAN}║   • Активних ключів: 0 (${lang === 'en' ? 'Active keys: 0' : 'немає активних сесій'})${CLR_RESET}`);
    }
  } catch (e) {
    console.log(`${CLR_CYAN}║   • Активних ключів: 0 (${lang === 'en' ? 'Active keys: 0' : 'менеджер сесій не активний'})${CLR_RESET}`);
  }

  console.log(`${CLR_BOLD}${CLR_CYAN}╚═══════════════════════════════════════════════════════════════════════════════════════╝${CLR_RESET}\n`);
}

function handleSetupBrowsers() {
  console.log(`${CLR_YELLOW}Встановлення маніфестів Native Messaging Host для браузерів...${CLR_RESET}`);
  const results = setupBrowserManifests();
  let installed = 0;
  for (const r of results) {
    if (r.success) {
      installed++;
      console.log(`  ${CLR_GREEN}✔${CLR_RESET} ${r.name}: ${CLR_CYAN}${r.path}${CLR_RESET}`);
    } else {
      console.log(`  ${CLR_GRAY}ℹ${CLR_RESET} ${r.name}: пропущено (${r.error})`);
    }
  }

  console.log(`\n${CLR_BOLD}${CLR_GREEN}✅ Налаштування завершено успішно (зареєстровано в ${installed} місцях).${CLR_RESET}`);
  console.log(`
${CLR_BOLD}Зверніть увагу:${CLR_RESET}
Для роботи у браузері Google Chrome, Chromium або Brave переконайтесь, що встановлено розширення:
${CLR_CYAN}https://chromewebstore.google.com/detail/jffafkigfgmjafhpkoibhfefeaebmccg${CLR_RESET}
`);
}

function handleStartWeb(daemonMode) {
  const runningPid = isWebAgentRunning();
  if (runningPid) {
    console.log(`${CLR_YELLOW}Web Sign Agent вже працює (PID: ${runningPid}).${CLR_RESET}`);
    return;
  }

  if (daemonMode) {
    fs.mkdirSync(path.dirname(WEB_AGENT_PID_FILE), { recursive: true });
    const logFile = path.join(path.dirname(WEB_AGENT_PID_FILE), 'web-agent.log');
    const out = fs.openSync(logFile, 'a');
    const err = fs.openSync(logFile, 'a');
    const child = spawn(process.execPath, [__filename, 'start-web'], {
      detached: true,
      stdio: ['ignore', out, err],
    });
    child.unref();
    console.log(`${CLR_GREEN}✅ Web Sign Agent успішно запущено у фоні (PID: ${child.pid}).${CLR_RESET}`);
    console.log(`  • Порт HTTP:  ${CLR_YELLOW}http://127.0.0.1:8081${CLR_RESET}`);
    console.log(`  • Порт HTTPS: ${CLR_YELLOW}https://127.0.0.1:8083${CLR_RESET}`);
    console.log(`  • Лог-файл:   ${CLR_GRAY}${logFile}${CLR_RESET}`);
    return;
  }

  // Foreground mode
  fs.mkdirSync(path.dirname(WEB_AGENT_PID_FILE), { recursive: true });
  fs.writeFileSync(WEB_AGENT_PID_FILE, String(process.pid), 'utf8');

  console.log(`${CLR_BOLD}${CLR_CYAN}Запуск Web Sign Agent на портах 8081 (HTTP) та 8083 (HTTPS)...${CLR_RESET}`);
  const server = startWebAgentServer();

  function cleanup() {
    try { fs.unlinkSync(WEB_AGENT_PID_FILE); } catch (e) {}
    server.close();
    process.exit(0);
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', () => {
    try { fs.unlinkSync(WEB_AGENT_PID_FILE); } catch (e) {}
  });

  console.log(`${CLR_GREEN}✅ Web Sign Agent активний та очікує запитів від веб-сайтів.${CLR_RESET}`);
  console.log(`${CLR_GRAY}Натисніть Ctrl+C для зупинки.${CLR_RESET}`);
}

function handleStopWeb() {
  const pid = isWebAgentRunning();
  if (!pid) {
    console.log(`${CLR_GRAY}Web Sign Agent не запущено.${CLR_RESET}`);
    try { fs.unlinkSync(WEB_AGENT_PID_FILE); } catch (e) {}
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
    try { fs.unlinkSync(WEB_AGENT_PID_FILE); } catch (e) {}
    console.log(`${CLR_GREEN}✅ Web Sign Agent (PID: ${pid}) успішно зупинено.${CLR_RESET}`);
  } catch (e) {
    console.log(`${CLR_RED}Помилка зупинки Web Sign Agent: ${e.message}${CLR_RESET}`);
  }
}

function handleEnableService() {
  try {
    const userSystemdDir = path.join(os.homedir(), '.config', 'systemd', 'user');
    fs.mkdirSync(userSystemdDir, { recursive: true });
    const serviceContent = `[Unit]
Description=QES Tools Web Signing Agent (IIT EUSW Bridge)
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/qes-agent start-web
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
`;
    fs.writeFileSync(path.join(userSystemdDir, 'qes-agent.service'), serviceContent, 'utf8');
    execSync('systemctl --user daemon-reload && systemctl --user enable --now qes-agent.service', { stdio: 'inherit' });
    console.log(`${CLR_GREEN}✅ Службу qes-agent увімкнено та запущено в системі.${CLR_RESET}`);
  } catch (e) {
    console.error(`${CLR_RED}Помилка налаштування systemd: ${e.message}${CLR_RESET}`);
  }
}

function handleDisableService() {
  try {
    execSync('systemctl --user disable --now qes-agent.service 2>/dev/null || true', { stdio: 'inherit' });
    console.log(`${CLR_GREEN}✅ Службу qes-agent вимкнено.${CLR_RESET}`);
  } catch (e) {
    console.error(`${CLR_RED}Помилка вимкнення служби: ${e.message}${CLR_RESET}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'status';

  if (cmd === '-h' || cmd === '--help' || cmd === 'help') {
    showHelp();
    process.exit(0);
  }

  if (cmd === 'setup-browsers' || cmd === '--setup-browsers' || cmd === 'install-browsers') {
    handleSetupBrowsers();
    process.exit(0);
  }

  if (cmd === 'start-web' || cmd === 'web' || cmd === '--web') {
    const isDaemon = args.includes('--daemon') || args.includes('-d');
    handleStartWeb(isDaemon);
    return;
  }

  if (cmd === 'stop-web') {
    handleStopWeb();
    process.exit(0);
  }

  if (cmd === 'enable-service') {
    handleEnableService();
    process.exit(0);
  }

  if (cmd === 'disable-service') {
    handleDisableService();
    process.exit(0);
  }

  if (cmd === 'status' || cmd === '-s' || cmd === '--status') {
    await handleStatus();
    process.exit(0);
  }

  if (cmd === 'daemon') {
    runAgentServer();
    return;
  }

  if (cmd === 'clear' || cmd === 'lock') {
    try {
      const res = await sendAgentMessage({ action: 'clear' }, { timeoutMs: 1000 });
      if (res && res.status === 'ok') {
        console.log(`${CLR_GREEN}${t('clearedKeys', res.cleared)}${CLR_RESET}`);
        process.exit(0);
      }
    } catch (e) {
      console.log(`${CLR_GRAY}${t('agentEmptyOrNotRunning')}${CLR_RESET}`);
      process.exit(0);
    }
  }

  if (cmd === 'stop') {
    try {
      await sendAgentMessage({ action: 'stop' }, { timeoutMs: 1000 });
      console.log(`${CLR_GREEN}${t('agentStopped')}${CLR_RESET}`);
    } catch (e) {
      console.log(`${CLR_GRAY}${t('agentAlreadyStopped')}${CLR_RESET}`);
    }
    process.exit(0);
  }

  console.error(`${CLR_RED}Невідома команда: ${cmd}. Використовуйте qes-agent --help.${CLR_RESET}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(`${CLR_RED}Помилка: ${err.message}${CLR_RESET}`);
  process.exit(1);
});
