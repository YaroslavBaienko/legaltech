#!/usr/bin/env node
/**
 * qes-agent — Демон та утиліта керування сесією паролів КЕП (Session TTL).
 * 100% RAM / tmpfs | Автономний захист адвокатської таємниці.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  getSocketPath,
  getPidPath,
  sendAgentMessage,
  runAgentServer,
} = require('../src/session');

const CLR_RESET = '\x1b[0m';
const CLR_BOLD = '\x1b[1m';
const CLR_GREEN = '\x1b[32m';
const CLR_RED = '\x1b[31m';
const CLR_YELLOW = '\x1b[33m';
const CLR_CYAN = '\x1b[36m';
const CLR_GRAY = '\x1b[90m';

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'status';

  if (cmd === '-h' || cmd === '--help' || cmd === 'help') {
    console.log(`
${CLR_BOLD}${CLR_CYAN}================================================================================${CLR_RESET}
${CLR_BOLD}${CLR_CYAN}  qes-agent — менеджер тимчасових сесій паролів КЕП (Session TTL)${CLR_RESET}
${CLR_BOLD}${CLR_CYAN}  100% Offline-First | Тільки оперативна пам'ять (RAM / tmpfs)${CLR_RESET}
${CLR_BOLD}${CLR_CYAN}================================================================================${CLR_RESET}

${CLR_BOLD}ОПИС:${CLR_RESET}
  Кешує розблоковані паролі особистих ключів КЕП в оперативній пам'яті (RAM) на
  визначений час (за замовчуванням 15 хв, настроюється до 30 хв).
  Дозволяє підписувати та розшифровувати серію документів без постійного повторного
  введення пароля. Паролі НІКОЛИ не зберігаються на жорсткому диску або SSD.

${CLR_BOLD}КОМАНДИ:${CLR_RESET}
  ${CLR_GREEN}qes-agent status${CLR_RESET}         Показати статус сесії, список ключів у пам'яті та залишок часу
  ${CLR_GREEN}qes-agent clear${CLR_RESET}          Очистити кеш та негайно видалити всі паролі з пам'яті (заблокувати)
  ${CLR_GREEN}qes-agent lock${CLR_RESET}           Синонім команди clear
  ${CLR_GREEN}qes-agent stop${CLR_RESET}           Зупинити фонового агента та видалити сокет
  ${CLR_GREEN}qes-agent daemon${CLR_RESET}         Запустити сервер агента вручну у фоновому або термінальному режимі
  ${CLR_GREEN}qes-agent -h, --help${CLR_RESET}     Показати цю довідку

${CLR_BOLD}ГАРАНТІЇ БЕЗПЕКИ:${CLR_RESET}
  • Зберігання строго в пам'яті процесу в $XDG_RUNTIME_DIR (/run/user/$UID/qes-agent.sock).
  • Права доступу до сокету: 0600 (виключно поточний користувач ОС).
  • Автоматичне очищення пам'яті при закінченні таймера або за сигналом блокування.
================================================================================
`);
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
        console.log(`${CLR_GREEN}🔒 Сесію КЕП завершено: вилучено ${res.cleared} ключ(ів) з оперативної пам'яті.${CLR_RESET}`);
        process.exit(0);
      }
    } catch (e) {
      console.log(`${CLR_GRAY}ℹ️ Агент не був запущений або кеш уже порожній.${CLR_RESET}`);
      process.exit(0);
    }
  }

  if (cmd === 'stop') {
    try {
      await sendAgentMessage({ action: 'stop' }, { timeoutMs: 1000 });
      console.log(`${CLR_GREEN}✅ Агента qes-agent успішно зупинено.${CLR_RESET}`);
    } catch (e) {
      console.log(`${CLR_GRAY}ℹ️ Агент уже не активний.${CLR_RESET}`);
    }
    process.exit(0);
  }

  if (cmd === 'status') {
    try {
      const res = await sendAgentMessage({ action: 'status' }, { timeoutMs: 1000 });
      if (res && res.status === 'ok') {
        console.log(`\n${CLR_BOLD}${CLR_CYAN}╔═══════════════════════════════════════════════════════════════════════════════════════╗${CLR_RESET}`);
        console.log(`${CLR_BOLD}${CLR_CYAN}║ СТАТУС СЕСІЇ КЕП (qes-agent)${CLR_RESET}`);
        console.log(`${CLR_CYAN}║ Сокет:   ${res.socketPath || getSocketPath()}${CLR_RESET}`);
        console.log(`${CLR_CYAN}║ Пам'ять: 100% RAM / tmpfs (права 0600)${CLR_RESET}`);
        console.log(`${CLR_CYAN}║ Активних ключів: ${res.count}${CLR_RESET}`);
        console.log(`${CLR_CYAN}╟───────────────────────────────────────────────────────────────────────────────────────╢${CLR_RESET}`);

        if (res.count === 0) {
          console.log(`${CLR_CYAN}║ ${CLR_GRAY}Немає активних сесій (кеш порожній). Пароль буде запитано при наступній дії.${CLR_CYAN}   ║${CLR_RESET}`);
        } else {
          for (const k of res.active) {
            const mins = Math.floor(k.remainingSec / 60);
            const secs = k.remainingSec % 60;
            const timeStr = mins > 0 ? `${mins} хв ${secs} с` : `${secs} с`;
            console.log(`${CLR_CYAN}║ • ${CLR_BOLD}${CLR_GREEN}${k.label}${CLR_RESET}`);
            console.log(`${CLR_CYAN}║   Залишилось часу: ${CLR_YELLOW}${timeStr}${CLR_RESET} (TTL: ${Math.round(k.ttlSec / 60)} хв)`);
          }
        }
        console.log(`${CLR_BOLD}${CLR_CYAN}╚═══════════════════════════════════════════════════════════════════════════════════════╝${CLR_RESET}\n`);
        process.exit(0);
      }
    } catch (e) {
      console.log(`\n${CLR_CYAN}╔═══════════════════════════════════════════════════════════════════════════════════════╗${CLR_RESET}`);
      console.log(`${CLR_CYAN}║ СТАТУС СЕСІЇ КЕП (qes-agent)${CLR_RESET}`);
      console.log(`${CLR_CYAN}║ Агент:   ${CLR_GRAY}Не активний (буде запущено автоматично при першому підписанні)${CLR_RESET}`);
      console.log(`${CLR_CYAN}╚═══════════════════════════════════════════════════════════════════════════════════════╝${CLR_RESET}\n`);
      process.exit(0);
    }
  }

  console.error(`${CLR_RED}Невідома команда: ${cmd}. Використовуйте qes-agent --help.${CLR_RESET}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(`${CLR_RED}Помилка: ${err.message}${CLR_RESET}`);
  process.exit(1);
});
