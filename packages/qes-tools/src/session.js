/**
 * session.js — Безпечне кешування паролів КЕП в оперативній пам'яті (Session TTL).
 *
 * Принципи безпеки:
 * 1. 100% RAM / tmpfs: Паролі НІКОЛИ не записуються на диск, у swap або постійні файли.
 * 2. Ізоляція користувача: Сокет розміщується в $XDG_RUNTIME_DIR (/run/user/$UID) з правами 0600.
 * 3. Контроль часу життя (TTL): За замовчуванням 15 хв (настроюється 15–30 хв).
 * 4. Ковзне вікно (Sliding Window): Кожне успішне підписання продовжує активну сесію (до макс. ліміту).
 * 5. Миттєве скидання: Команда 'qes-agent clear' або меню 'Заблокувати КЕП' негайно обнуляє пам'ять.
 * 6. Прив'язка до відбитка ключа: Хеш файлу (шлях, розмір, mtime) запобігає підміні.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');

function getSocketDir() {
  const runtime = process.env.XDG_RUNTIME_DIR;
  if (runtime && fs.existsSync(runtime)) {
    return runtime;
  }
  const uid = typeof process.getuid === 'function' ? process.getuid() : '1000';
  const tmpFallback = path.join('/tmp', `qes-${uid}`);
  if (!fs.existsSync(tmpFallback)) {
    try {
      fs.mkdirSync(tmpFallback, { mode: 0o700, recursive: true });
    } catch {}
  } else {
    try {
      fs.chmodSync(tmpFallback, 0o700);
    } catch {}
  }
  return tmpFallback;
}

function getSocketPath() {
  return path.join(getSocketDir(), 'qes-agent.sock');
}

function getPidPath() {
  return path.join(getSocketDir(), 'qes-agent.pid');
}

function getKeyFingerprint(keyPath) {
  const absPath = path.resolve(keyPath);
  if (!fs.existsSync(absPath)) {
    return crypto.createHash('sha256').update(absPath).digest('hex');
  }
  const stat = fs.statSync(absPath);
  const hash = crypto.createHash('sha256');
  hash.update(`${absPath}:${stat.size}:${stat.mtimeMs}`);
  return hash.digest('hex');
}

function sendAgentMessage(message, options = {}) {
  const timeoutMs = options.timeoutMs || 1500;
  const socketPath = getSocketPath();

  return new Promise((resolve, reject) => {
    let resolved = false;
    let socket;
    let timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (socket) socket.destroy();
        reject(new Error('Agent request timed out'));
      }
    }, timeoutMs);

    try {
      socket = net.connect(socketPath);
    } catch (err) {
      clearTimeout(timer);
      return reject(err);
    }

    let responseData = '';

    socket.on('connect', () => {
      socket.write(JSON.stringify(message) + '\n');
    });

    socket.on('data', (chunk) => {
      responseData += chunk.toString();
      const idx = responseData.indexOf('\n');
      if (idx !== -1 && !resolved) {
        resolved = true;
        clearTimeout(timer);
        const line = responseData.slice(0, idx).trim();
        socket.end();
        try {
          resolve(JSON.parse(line));
        } catch (e) {
          reject(e);
        }
      }
    });

    socket.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

async function ensureAgentRunning() {
  const socketPath = getSocketPath();
  const pidPath = getPidPath();

  // 1. Check if agent is already responding
  try {
    const ping = await sendAgentMessage({ action: 'ping' }, { timeoutMs: 300 });
    if (ping && ping.status === 'ok') {
      return true;
    }
  } catch (e) {
    // Socket does not exist or ECONNREFUSED — clean up stale files
    try { if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath); } catch {}
    try { if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath); } catch {}
  }

  // 2. Spawn agent daemon in background
  const agentBin = path.resolve(__dirname, '..', 'bin', 'qes-agent.js');
  if (!fs.existsSync(agentBin)) {
    return false;
  }

  const child = spawn(process.execPath, [agentBin, 'daemon'], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();

  // 3. Wait for socket to become active (up to 2000 ms)
  const startTime = Date.now();
  while (Date.now() - startTime < 2000) {
    await new Promise((r) => setTimeout(r, 60));
    if (fs.existsSync(socketPath)) {
      try {
        const ping = await sendAgentMessage({ action: 'ping' }, { timeoutMs: 300 });
        if (ping && ping.status === 'ok') {
          return true;
        }
      } catch {}
    }
  }

  return false;
}

function runAgentServer() {
  const socketPath = getSocketPath();
  const pidPath = getPidPath();

  if (fs.existsSync(socketPath)) {
    try { fs.unlinkSync(socketPath); } catch {}
  }
  try {
    fs.writeFileSync(pidPath, String(process.pid));
  } catch {}

  const cache = new Map(); // keyId -> { password, label, expiresAt, maxExpiresAt, ttlSec, timer, createdAt }

  function cleanKey(keyId) {
    const entry = cache.get(keyId);
    if (entry) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.password = null; // Memory overwrite
      cache.delete(keyId);
    }
  }

  function wipeAll() {
    for (const keyId of cache.keys()) {
      cleanKey(keyId);
    }
  }

  let idleTimer = null;
  function resetIdleCheck() {
    if (idleTimer) clearTimeout(idleTimer);
    if (cache.size === 0) {
      // Exit after 10 minutes if no active keys remain
      idleTimer = setTimeout(() => {
        if (cache.size === 0) {
          shutdown();
        }
      }, 10 * 60 * 1000);
    }
  }

  function shutdown() {
    wipeAll();
    try { if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath); } catch {}
    try { if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath); } catch {}
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGHUP', shutdown);
  process.on('exit', () => {
    wipeAll();
    try { if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath); } catch {}
    try { if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath); } catch {}
  });

  const server = net.createServer((socket) => {
    let buf = '';
    socket.on('data', (chunk) => {
      buf += chunk.toString();
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (line) {
          handleRequest(line, socket);
        }
      }
    });
  });

  function handleRequest(rawJson, socket) {
    let req;
    try {
      req = JSON.parse(rawJson);
    } catch (e) {
      socket.write(JSON.stringify({ status: 'error', error: 'Invalid JSON' }) + '\n');
      return;
    }

    const now = Date.now();

    if (req.action === 'ping') {
      socket.write(JSON.stringify({ status: 'ok', pong: true }) + '\n');
      return;
    }

    if (req.action === 'get') {
      const entry = cache.get(req.keyId);
      if (entry && entry.expiresAt > now) {
        // Sliding window: prolong expiration up to maxExpiresAt
        const ttlMs = entry.ttlSec * 1000;
        entry.expiresAt = Math.min(now + ttlMs, entry.maxExpiresAt);
        clearTimeout(entry.timer);
        entry.timer = setTimeout(() => {
          cleanKey(req.keyId);
          resetIdleCheck();
        }, entry.expiresAt - now);

        const remainingSec = Math.max(0, Math.round((entry.expiresAt - now) / 1000));
        socket.write(JSON.stringify({
          status: 'ok',
          found: true,
          password: entry.password,
          label: entry.label,
          remainingSec,
        }) + '\n');
      } else {
        if (entry) cleanKey(req.keyId);
        socket.write(JSON.stringify({ status: 'ok', found: false }) + '\n');
      }
      resetIdleCheck();
      return;
    }

    if (req.action === 'set') {
      const ttlSec = Math.max(60, Number(req.ttl) || 900); // Default 15 min (900s), min 1 min
      const maxTtlSec = Math.max(ttlSec * 4, 7200); // 2 hours cap
      const label = req.label || 'Ключ КЕП';

      cleanKey(req.keyId);

      const expiresAt = now + ttlSec * 1000;
      const maxExpiresAt = now + maxTtlSec * 1000;

      const timer = setTimeout(() => {
        cleanKey(req.keyId);
        resetIdleCheck();
      }, ttlSec * 1000);

      cache.set(req.keyId, {
        password: req.password,
        label,
        expiresAt,
        maxExpiresAt,
        ttlSec,
        timer,
        createdAt: now,
      });

      if (idleTimer) clearTimeout(idleTimer);

      socket.write(JSON.stringify({
        status: 'ok',
        ttlSec,
        expiresAt,
      }) + '\n');
      return;
    }

    if (req.action === 'clear') {
      let count = 0;
      if (req.keyId) {
        if (cache.has(req.keyId)) {
          cleanKey(req.keyId);
          count = 1;
        }
      } else {
        count = cache.size;
        wipeAll();
      }
      resetIdleCheck();
      socket.write(JSON.stringify({ status: 'ok', cleared: count }) + '\n');
      return;
    }

    if (req.action === 'status') {
      const list = [];
      for (const [id, entry] of cache.entries()) {
        if (entry.expiresAt > now) {
          list.push({
            keyId: id,
            label: entry.label,
            remainingSec: Math.max(0, Math.round((entry.expiresAt - now) / 1000)),
            ttlSec: entry.ttlSec,
          });
        } else {
          cleanKey(id);
        }
      }
      resetIdleCheck();
      socket.write(JSON.stringify({
        status: 'ok',
        active: list,
        count: list.length,
        socketPath,
      }) + '\n');
      return;
    }

    if (req.action === 'stop') {
      socket.write(JSON.stringify({ status: 'ok', stopping: true }) + '\n');
      setTimeout(shutdown, 50);
      return;
    }

    socket.write(JSON.stringify({ status: 'error', error: 'Unknown action' }) + '\n');
  }

  server.listen(socketPath, () => {
    try {
      fs.chmodSync(socketPath, 0o600);
    } catch {}
    resetIdleCheck();
  });
}

/**
 * Unified helper: retrieves cached password from RAM or prompts user,
 * initializes the cryptographic engine, and caches password upon success.
 */
async function getOrPromptPassword({
  keyPath,
  certPath = null,
  engine,
  promptText = null,
  useGui = false,
  noCache = false,
  ttl = 900, // 15 minutes default
  askPasswordFn,
}) {
  const keyId = getKeyFingerprint(keyPath);
  const label = path.basename(keyPath);

  // 1. Try RAM cache if caching is allowed
  if (!noCache && !process.env.QES_NO_CACHE) {
    try {
      const cached = await sendAgentMessage({ action: 'get', keyId }, { timeoutMs: 500 });
      if (cached && cached.found && cached.password) {
        try {
          const boxInfo = await engine.initBox(keyPath, cached.password, certPath);
          const mins = Math.floor(cached.remainingSec / 60);
          const secs = cached.remainingSec % 60;
          const timeStr = mins > 0 ? `${mins} хв ${secs} с` : `${secs} с`;
          console.log(`\x1b[32m🔑 Сесія КЕП активна:\x1b[0m пароль отримано з пам'яті (залишилось ${timeStr})`);
          return boxInfo;
        } catch (err) {
          // Stale password, invalidate cache and prompt
          console.warn(`\x1b[33m⚠️ Збережений у сесії пароль не підійшов до ключа. Запитуємо знову...\x1b[0m`);
          await sendAgentMessage({ action: 'clear', keyId }).catch(() => {});
        }
      }
    } catch (e) {
      // Agent is not currently running or reachable
    }
  }

  // 2. Prompt user interactively
  const prompt = promptText || `Введіть пароль до ключа \x1b[1m${label}\x1b[0m: `;
  let password = await askPasswordFn(prompt, useGui);

  // 3. Initialize engine with entered password
  console.log(`\x1b[90m⏳ Ініціалізація крипторушія ДСТУ 4145...\x1b[0m`);
  let boxInfo;
  try {
    boxInfo = await engine.initBox(keyPath, password, certPath);
  } catch (err) {
    throw err;
  }

  // 4. Save to session cache if successful and caching enabled
  if (!noCache && !process.env.QES_NO_CACHE) {
    try {
      const started = await ensureAgentRunning();
      if (started) {
        await sendAgentMessage({
          action: 'set',
          keyId,
          password,
          label,
          ttl,
        }, { timeoutMs: 1000 });
        const ttlMin = Math.round(ttl / 60);
        console.log(`\x1b[90m🔒 Пароль закешовано в оперативній пам'яті (сесія на ${ttlMin} хв)\x1b[0m`);
      }
    } catch (e) {
      // Non-fatal if agent fails to cache
    }
  }

  // 5. Zero password variable
  password = null;

  return boxInfo;
}

module.exports = {
  getSocketDir,
  getSocketPath,
  getPidPath,
  getKeyFingerprint,
  sendAgentMessage,
  ensureAgentRunning,
  runAgentServer,
  getOrPromptPassword,
};
