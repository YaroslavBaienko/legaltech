/**
 * adapter.js — HTTP/HTTPS transport adapter and algorithm configuration for jkurwa.
 */

'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const gost89 = require('gost89');
const dstu7564 = require('dstu7564');

/**
 * Standard HTTP/HTTPS query function expected by jkurwa for CMP, TSP, and OCSP requests.
 */
function queryAdapter(method, urlStr, headers, body, cb) {
  try {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === 'https:' ? https : http;

    const reqHeaders = Object.assign({}, headers);
    if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
      if (urlStr.includes('/cmp')) {
        reqHeaders['Content-Type'] = 'application/pkixcmp';
      } else if (urlStr.includes('/tsp') || urlStr.includes('/timestamp')) {
        reqHeaders['Content-Type'] = 'application/timestamp-query';
      } else if (urlStr.includes('/ocsp')) {
        reqHeaders['Content-Type'] = 'application/ocsp-request';
      } else {
        reqHeaders['Content-Type'] = 'application/octet-stream';
      }
    }
    if (body && !reqHeaders['Content-Length'] && !reqHeaders['content-length']) {
      reqHeaders['Content-Length'] = body.length;
    }

    const options = {
      method: method || 'POST',
      headers: reqHeaders,
      timeout: 10000,
    };

    const req = client.request(parsed, options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const fullBuf = Buffer.concat(chunks);
        cb(fullBuf, res.statusCode);
      });
    });

    req.on('timeout', () => {
      req.destroy();
      cb(null, 408);
    });

    req.on('error', () => {
      cb(null, 500);
    });

    if (body) {
      req.write(body);
    }
    req.end();
  } catch (err) {
    cb(null, 500);
  }
}

function getAlgos() {
  const base = gost89.compat.algos();
  const hashes = {
    Gost34311: (data) => gost89.gosthash(data),
    Dstu4145le: (data) => gost89.gosthash(data),
    'Dstu7564-256': (data) => dstu7564.computeHash(32, data),
    'Dstu7564-384': (data) => dstu7564.computeHash(48, data),
    'Dstu7564-512': (data) => dstu7564.computeHash(64, data),
    Dstu4145leWithDstu7564: (data) => dstu7564.computeHash(32, data),
  };
  hashes['Dstu7564-256'].algo = 'Dstu7564-256';
  hashes['Dstu7564-384'].algo = 'Dstu7564-384';
  hashes['Dstu7564-512'].algo = 'Dstu7564-512';

  return Object.assign({}, base, {
    hashes,
    hash: gost89.gosthash,
    storeload: function (params, password) {
      // Handles standard PBES2 (used by monobank/Universal Bank) and IIT format
      if (params.format === 'IIT' || (params.format === 'PBES2' && !params.kdf)) {
        return gost89.compat.decode_data(params, password);
      }
      try {
        const { storeload: dstustoreload } = require('dstucrypt-algos');
        return dstustoreload(params, password);
      } catch (e) {
        return gost89.compat.decode_data(params, password);
      }
    },
  });
}

/**
 * Safe signing wrapper with offline-first fallback and validation of TSP support.
 */
async function safeBoxSign(box, dataBuffer, ...args) {
  let signOpts = {};
  if (args.length > 0) {
    const lastArg = args[args.length - 1];
    if (lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg) && !(lastArg instanceof Buffer)) {
      signOpts = args.pop();
    }
  }

  const role = args[0] || null;
  const unusedCert = args[1] || null;

  let keyInfo = box.keys && Array.isArray(box.keys) ? box.keys.find((k) => k.cert) : null;
  if (!keyInfo && box.keys && typeof box.keys === 'object') {
    const firstKey = Object.values(box.keys)[0];
    if (firstKey && firstKey.cert) keyInfo = firstKey;
  }
  const hasTspUrl = Boolean(keyInfo?.cert?.extension?.subjectInfoAccess?.link);
  const wantsTsp = signOpts.tsp === 'all' || (signOpts.tsp !== false && signOpts.tsp !== undefined);
  const shouldTsp = wantsTsp && hasTspUrl;

  const effectiveOpts = {
    ...signOpts,
    tsp: shouldTsp ? 'all' : false,
  };

  try {
    return await box.sign(dataBuffer, role, unusedCert, effectiveOpts);
  } catch (err) {
    if (shouldTsp) {
      const fallbackOpts = { ...effectiveOpts, tsp: false };
      return await box.sign(dataBuffer, role, unusedCert, fallbackOpts);
    }
    throw err;
  }
}

module.exports = {
  queryAdapter,
  getAlgos,
  safeBoxSign,
};
