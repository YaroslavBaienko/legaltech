/**
 * web-agent.js — Web Signing Agent & Browser Native Messaging Bridge for QES Tools.
 * Reverses and integrates IIT End-User CA-1 web signing agent protocol (EUSW / euscpnmh).
 * Supports JSON-RPC 2.0 over HTTP (port 8081), HTTPS (port 8083), and Native Messaging Host (stdio).
 */

'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync, spawnSync } = require('child_process');

// Determine location of euscpnmh binary
function getNmhBinaryPath() {
  const candidatePaths = [
    '/opt/iit/eu/sw/euscpnmh',
    '/usr/bin/euscpnmh',
    path.resolve(__dirname, '..', 'opt', 'iit', 'eu', 'sw', 'euscpnmh'),
    path.resolve(__dirname, '..', '..', 'opt', 'iit', 'eu', 'sw', 'euscpnmh'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return '/opt/iit/eu/sw/euscpnmh';
}

/**
 * NmhBridge manages a child process running `euscpnmh` and communicates
 * using the Native Messaging protocol (32-bit LE length prefix + JSON string).
 * Handles multi-part responses ('"part' -> '"next"' -> '"last' + base64).
 */
class NmhBridge {
  constructor(binaryPath = null) {
    this.binaryPath = binaryPath || getNmhBinaryPath();
    this.proc = null;
    this.buffer = Buffer.alloc(0);
    this.queue = [];
    this.processing = false;
    this.currentCb = null;
    this.chunks = [];
    this.isAlive = false;
    this._initProcess();
  }

  _initProcess() {
    if (!fs.existsSync(this.binaryPath)) {
      this.isAlive = false;
      return;
    }

    const env = Object.assign({}, process.env, {
      LD_LIBRARY_PATH: path.dirname(this.binaryPath) + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : ''),
    });

    try {
      this.proc = spawn(this.binaryPath, [], { env, stdio: ['pipe', 'pipe', 'pipe'] });
      this.isAlive = true;

      this.proc.stdout.on('data', (data) => this._onStdout(data));
      this.proc.stderr.on('data', () => {}); // silence or debug
      this.proc.on('error', (err) => {
        this.isAlive = false;
        if (this.currentCb) {
          const cb = this.currentCb;
          this.currentCb = null;
          this.processing = false;
          cb(err);
        }
      });
      this.proc.on('close', () => {
        this.isAlive = false;
        if (this.currentCb) {
          const cb = this.currentCb;
          this.currentCb = null;
          this.processing = false;
          cb(new Error('NMH process terminated unexpectedly'));
        }
      });
    } catch (e) {
      this.isAlive = false;
    }
  }

  call(payload, cb) {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.queue.push({ payloadStr, cb });
    this._processQueue();
  }

  _processQueue() {
    if (this.processing || this.queue.length === 0) return;
    if (!this.isAlive || !this.proc || this.proc.killed) {
      this._initProcess();
      if (!this.isAlive) {
        const item = this.queue.shift();
        item.cb(new Error(`EUSW native messaging binary not available at ${this.binaryPath}`));
        return;
      }
    }

    this.processing = true;
    const { payloadStr, cb } = this.queue.shift();
    this.currentCb = cb;
    this.chunks = [];
    this._sendRaw(payloadStr);
  }

  _sendRaw(str) {
    const buf = Buffer.from(str, 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(buf.length, 0);
    this.proc.stdin.write(Buffer.concat([header, buf]));
  }

  _onStdout(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    while (this.buffer.length >= 4) {
      const msgLen = this.buffer.readUInt32LE(0);
      if (this.buffer.length < 4 + msgLen) break;
      const msgBuf = this.buffer.slice(4, 4 + msgLen);
      this.buffer = this.buffer.slice(4 + msgLen);
      this._handleMsg(msgBuf.toString('utf8'));
    }
  }

  _handleMsg(msgStr) {
    if (msgStr.startsWith('\"part')) {
      const b64 = msgStr.slice(5, -1);
      this.chunks.push(b64);
      // Ask for next piece
      this._sendRaw('\"next\"');
    } else if (msgStr.startsWith('\"last')) {
      const b64 = msgStr.slice(5, -1);
      this.chunks.push(b64);
      const fullB64 = this.chunks.join('');
      let decoded = '';
      try {
        decoded = Buffer.from(fullB64, 'base64').toString('utf8');
      } catch (err) {
        decoded = fullB64;
      }
      const cb = this.currentCb;
      this.currentCb = null;
      this.processing = false;
      if (cb) cb(null, decoded);
      this._processQueue();
    } else {
      const cb = this.currentCb;
      this.currentCb = null;
      this.processing = false;
      if (cb) cb(null, msgStr);
      this._processQueue();
    }
  }

  destroy() {
    if (this.proc) {
      this.isAlive = false;
      try { this.proc.kill(); } catch (e) {}
      this.proc = null;
    }
  }
}

/**
 * Generates or loads localhost SSL certificate for HTTPS on port 8083.
 */
function getOrCreateLocalhostCert(certDir = null) {
  const dir = certDir || path.join(os.homedir(), '.config', 'qes', 'certs');
  fs.mkdirSync(dir, { recursive: true });

  const keyPath = path.join(dir, 'localhost.key');
  const crtPath = path.join(dir, 'localhost.crt');

  if (fs.existsSync(keyPath) && fs.existsSync(crtPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(crtPath),
    };
  }

  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -nodes -keyout "${keyPath}" -out "${crtPath}" -days 3650 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null || openssl req -x509 -newkey rsa:2048 -nodes -keyout "${keyPath}" -out "${crtPath}" -days 3650 -subj "/CN=localhost" 2>/dev/null`,
      { stdio: 'ignore' }
    );
    if (fs.existsSync(keyPath) && fs.existsSync(crtPath)) {
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(crtPath),
      };
    }
  } catch (e) {}

  return null;
}

/**
 * Starts the HTTP and HTTPS Web Signing Agent daemon.
 */
function startWebAgentServer(options = {}) {
  const portHttp = options.portHttp || 8081;
  const portHttps = options.portHttps || 8083;
  const bridge = new NmhBridge(options.nmhBinaryPath);

  function handleRequest(req, res) {
    // CORS headers required by browsers and IIT SignWidget
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, *');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'qes-web-agent',
        version: '1.0.7',
        eusw: '1.3.109',
        nmhAlive: bridge.isAlive,
        ports: { http: portHttp, https: portHttps },
        description: 'QES Tools Web Signing Agent (IIT End User CA-1 EUSW Compatible Bridge)',
      }, null, 2));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        if (!body.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: null }));
          return;
        }

        bridge.call(body, (err, resultStr) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: err.message },
              id: null,
            }));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(resultStr);
        });
      });
      return;
    }

    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
  }

  const httpServer = http.createServer(handleRequest);
  httpServer.listen(portHttp, '127.0.0.1');

  let httpsServer = null;
  const certs = getOrCreateLocalhostCert(options.certDir);
  if (certs) {
    try {
      httpsServer = https.createServer(certs, handleRequest);
      httpsServer.listen(portHttps, '127.0.0.1');
    } catch (e) {}
  }

  return {
    httpServer,
    httpsServer,
    bridge,
    close: () => {
      httpServer.close();
      if (httpsServer) httpsServer.close();
      bridge.destroy();
    },
  };
}

/**
 * Manifest definitions for Chrome-like browsers vs Mozilla Firefox.
 */
function getChromeManifestContent(nmhPath = '/opt/iit/eu/sw/euscpnmh') {
  return JSON.stringify({
    name: 'ua.com.iit.eusign.nmh',
    description: 'IIT End User CA-1. Sign (web)',
    path: nmhPath,
    type: 'stdio',
    allowed_origins: [
      'chrome-extension://jffafkigfgmjafhpkoibhfefeaebmccg/',
    ],
  }, null, 2);
}

function getFirefoxManifestContent(nmhPath = '/opt/iit/eu/sw/euscpnmh') {
  return JSON.stringify({
    name: 'ua.com.iit.eusign.nmh',
    description: 'IIT End User CA-1. Sign (web)',
    path: nmhPath,
    type: 'stdio',
    allowed_extensions: [
      'eusw@iit.com.ua',
    ],
  }, null, 2);
}

/**
 * Installs Native Messaging Host manifests into all known browser paths.
 */
function setupBrowserManifests(userHome = null) {
  const home = userHome || os.homedir();
  const nmhPath = getNmhBinaryPath();
  const results = [];

  const targets = [
    // User profile paths
    { name: 'Google Chrome (User)', dir: path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts'), type: 'chrome' },
    { name: 'Chromium (User)', dir: path.join(home, '.config', 'chromium', 'NativeMessagingHosts'), type: 'chrome' },
    { name: 'Brave (User)', dir: path.join(home, '.config', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'), type: 'chrome' },
    { name: 'Microsoft Edge (User)', dir: path.join(home, '.config', 'microsoft-edge', 'NativeMessagingHosts'), type: 'chrome' },
    { name: 'Mozilla Firefox (User)', dir: path.join(home, '.mozilla', 'native-messaging-hosts'), type: 'firefox' },

    // System-wide paths
    { name: 'Google Chrome (System)', dir: '/etc/opt/chrome/native-messaging-hosts', type: 'chrome' },
    { name: 'Chromium (System)', dir: '/etc/chromium/native-messaging-hosts', type: 'chrome' },
    { name: 'Brave (System)', dir: '/etc/brave/native-messaging-hosts', type: 'chrome' },
    { name: 'Microsoft Edge (System)', dir: '/etc/opt/edge/native-messaging-hosts', type: 'chrome' },
    { name: 'Mozilla Firefox (System)', dir: '/usr/lib/mozilla/native-messaging-hosts', type: 'firefox' },
  ];

  for (const t of targets) {
    try {
      fs.mkdirSync(t.dir, { recursive: true });
      const manifestFile = path.join(t.dir, 'ua.com.iit.eusign.nmh.json');
      const content = t.type === 'firefox' ? getFirefoxManifestContent(nmhPath) : getChromeManifestContent(nmhPath);
      fs.writeFileSync(manifestFile, content + '\n', 'utf8');
      fs.chmodSync(manifestFile, 0o644);
      results.push({ name: t.name, path: manifestFile, success: true });
    } catch (e) {
      results.push({ name: t.name, path: path.join(t.dir, 'ua.com.iit.eusign.nmh.json'), success: false, error: e.message });
    }
  }

  return results;
}

/**
 * Checks presence of manifests across all browser directories.
 */
function checkBrowserManifests(userHome = null) {
  const home = userHome || os.homedir();
  const checks = [
    { name: 'Google Chrome (User)', file: path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts', 'ua.com.iit.eusign.nmh.json') },
    { name: 'Chromium (User)', file: path.join(home, '.config', 'chromium', 'NativeMessagingHosts', 'ua.com.iit.eusign.nmh.json') },
    { name: 'Brave (User)', file: path.join(home, '.config', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts', 'ua.com.iit.eusign.nmh.json') },
    { name: 'Microsoft Edge (User)', file: path.join(home, '.config', 'microsoft-edge', 'NativeMessagingHosts', 'ua.com.iit.eusign.nmh.json') },
    { name: 'Mozilla Firefox (User)', file: path.join(home, '.mozilla', 'native-messaging-hosts', 'ua.com.iit.eusign.nmh.json') },
    { name: 'Google Chrome (System)', file: '/etc/opt/chrome/native-messaging-hosts/ua.com.iit.eusign.nmh.json' },
    { name: 'Chromium (System)', file: '/etc/chromium/native-messaging-hosts/ua.com.iit.eusign.nmh.json' },
    { name: 'Mozilla Firefox (System)', file: '/usr/lib/mozilla/native-messaging-hosts/ua.com.iit.eusign.nmh.json' },
  ];

  return checks.map((c) => {
    const exists = fs.existsSync(c.file);
    let valid = false;
    let binaryTarget = null;
    if (exists) {
      try {
        const parsed = JSON.parse(fs.readFileSync(c.file, 'utf8'));
        binaryTarget = parsed.path;
        valid = fs.existsSync(binaryTarget);
      } catch (e) {}
    }
    return {
      name: c.name,
      file: c.file,
      exists,
      valid,
      binaryTarget,
    };
  });
}

/**
 * Detects connected USB hardware tokens.
 */
function detectTokens() {
  const detected = [];
  try {
    const lsusb = execSync('lsusb 2>/dev/null', { encoding: 'utf-8' });
    const lines = lsusb.split('\n');
    for (const line of lines) {
      if (/03eb:9324/i.test(line)) {
        detected.push({
          vendorId: '03eb',
          productId: '9324',
          name: 'DepositSign / ІІТ Алмаз-1К (E.Key Almaz-1C)',
          driver: 'pkcs11.eka1c.so',
          type: 'USB Smartcard Token',
          line: line.trim(),
        });
      } else if (/0403:6001/i.test(line) && /crystal|iit/i.test(line)) {
        detected.push({
          vendorId: '0403',
          productId: '6001',
          name: 'ІІТ Кристал-1К (Crystal-1C)',
          driver: 'pkcs11.ekc1.so',
          type: 'USB Token',
          line: line.trim(),
        });
      } else if (/1e9a:0337/i.test(line) || /1e9a:0338/i.test(line) || /автор|securetoken/i.test(line)) {
        detected.push({
          vendorId: '1e9a',
          productId: '0337',
          name: 'Автор SecureToken-337 / 338',
          driver: 'libav337p11d.so',
          type: 'USB Crypto Token',
          line: line.trim(),
        });
      }
    }
  } catch (e) {}

  return detected;
}

module.exports = {
  getNmhBinaryPath,
  NmhBridge,
  startWebAgentServer,
  setupBrowserManifests,
  checkBrowserManifests,
  detectTokens,
  getChromeManifestContent,
  getFirefoxManifestContent,
};
