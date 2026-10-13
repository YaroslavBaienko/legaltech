/**
 * adapter.js — HTTP/HTTPS transport adapter and algorithm configuration for jkurwa.
 */

'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const gost89 = require('gost89');
const dstu7564 = require('dstu7564');
const jk = require('jkurwa');

// Safely guard jkurwa Certificate.prototype.ocspLink against null authorityInfoAccess
if (jk.models && jk.models.Certificate && jk.models.Certificate.prototype) {
  Object.defineProperty(jk.models.Certificate.prototype, 'ocspLink', {
    configurable: true,
    get() {
      const aia = this.extension && this.extension.authorityInfoAccess;
      if (!aia) return null;
      return aia.id === 'ocsp' ? aia.link : null;
    },
  });
}

/**
 * Standard HTTP/HTTPS query function expected by jkurwa for CMP, TSP, and OCSP requests.
 */
function queryAdapter(method, urlStr, headers, body, cb, retriesLeft = 1) {
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
      timeout: 5000,
    };

    let settled = false;
    const done = (buf, code) => {
      if (settled) return;
      settled = true;
      cb(buf, code);
    };

    const req = client.request(parsed, options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const fullBuf = Buffer.concat(chunks);
        if (res.statusCode >= 500 && retriesLeft > 0) {
          settled = true;
          return queryAdapter(method, urlStr, headers, body, cb, retriesLeft - 1);
        }
        done(fullBuf, res.statusCode);
      });
    });

    req.on('timeout', () => {
      req.destroy();
      if (!settled && retriesLeft > 0) {
        settled = true;
        return queryAdapter(method, urlStr, headers, body, cb, retriesLeft - 1);
      }
      done(null, 408);
    });

    req.on('error', () => {
      if (!settled && retriesLeft > 0) {
        settled = true;
        return queryAdapter(method, urlStr, headers, body, cb, retriesLeft - 1);
      }
      done(null, 500);
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
  let tspUrl = signOpts.tspUrl || keyInfo?.cert?.extension?.subjectInfoAccess?.link;
  if (!tspUrl && keyInfo?.cert) {
    try {
      const { detectProvider } = require('./providers');
      const prov = detectProvider(keyInfo.cert);
      if (prov && prov.tsp && prov.tsp.length > 0) {
        tspUrl = prov.tsp[0];
      }
    } catch (_) {}
  }
  if (tspUrl && keyInfo?.cert) {
    if (!keyInfo.cert.extension) keyInfo.cert.extension = {};
    if (!keyInfo.cert.extension.subjectInfoAccess) {
      keyInfo.cert.extension.subjectInfoAccess = { id: 'tsp', link: tspUrl };
    }
  }

  const hasTspUrl = Boolean(tspUrl || keyInfo?.cert?.extension?.subjectInfoAccess?.link);
  const wantsTsp = signOpts.tsp === 'all' || (signOpts.tsp !== false && signOpts.tsp !== undefined);
  const shouldTsp = wantsTsp && hasTspUrl;

  // LTV (OCSP + CA Chain) auto-resolution
  const wantsLtv = signOpts.ltv !== false && shouldTsp;
  let hasOcspUrl = false;
  if (wantsLtv && keyInfo?.cert) {
    let ocspUrl = signOpts.ocspUrl || keyInfo.cert.ocspLink;
    if (!ocspUrl) {
      try {
        const { detectProvider } = require('./providers');
        const prov = detectProvider(keyInfo.cert);
        if (prov && prov.ocsp && prov.ocsp.length > 0) {
          ocspUrl = prov.ocsp[0];
        }
      } catch (_) {}
    }
    if (ocspUrl) {
      if (!keyInfo.cert.extension) keyInfo.cert.extension = {};
      if (!keyInfo.cert.extension.authorityInfoAccess) {
        keyInfo.cert.extension.authorityInfoAccess = { id: 'ocsp', link: ocspUrl };
      }
      hasOcspUrl = true;
    }
  }

  // Check if complete CA chain is resolvable in box before enabling includeChain/ocsp
  let canResolveChain = false;
  let resolvedChain = [];
  if (keyInfo?.cert && typeof box.lookupCA === 'function') {
    try {
      resolvedChain = keyInfo.cert.getCompleteChain(box.lookupCA.bind(box));
      if (Array.isArray(resolvedChain) && resolvedChain.length > 0 && resolvedChain.every(Boolean)) {
        canResolveChain = true;
      }
    } catch (_) {
      canResolveChain = false;
      resolvedChain = [];
    }
  }

  const effectiveOpts = {
    ...signOpts,
    includeChain: signOpts.includeChain !== false && canResolveChain,
    ocsp: wantsLtv && hasOcspUrl && canResolveChain,
    tsp: shouldTsp ? 'all' : false,
  };

  const enrichSignedDataCerts = async (msg) => {
    if (msg && msg.info && Array.isArray(msg.info.certificate) && resolvedChain.length > 0 && effectiveOpts.includeChain) {
      const seenSerials = new Set(
        msg.info.certificate.map((c) => {
          try { return c.tbsCertificate.serialNumber.toString(16).toLowerCase(); } catch (_) { return ''; }
        })
      );
      for (const ca of resolvedChain) {
        try {
          const s = ca.ob.tbsCertificate.serialNumber.toString(16).toLowerCase();
          if (!seenSerials.has(s)) {
            msg.info.certificate.push(ca.ob);
            seenSerials.add(s);
          }
        } catch (_) {}
      }
    }
    // If LTV was requested and signer cert was self-signed (so native ocsp/chain was skipped),
    // enrich with the embedded TSP token's QTSP CA chain & LTV attributes.
    if (wantsLtv && !effectiveOpts.ocsp && msg) {
      try {
        const { attachLtvToCms } = require('./ltv');
        const up = await attachLtvToCms(Buffer.from(msg.as_asn1()), {
          box,
          ocspUrl: signOpts.ocspUrl,
          ltv: true,
        });
        if (up && Buffer.isBuffer(up.buffer)) {
          return new jk.models.Message(up.buffer);
        }
      } catch (_) {}
    }
    return msg;
  };

  try {
    const resMsg = await box.sign(dataBuffer, role, unusedCert, effectiveOpts);
    return await enrichSignedDataCerts(resMsg);
  } catch (err) {
    // 1. If OCSP failed, retry with chain + TSP (without OCSP)
    if (effectiveOpts.ocsp) {
      try {
        const noOcspMsg = await box.sign(dataBuffer, role, unusedCert, { ...effectiveOpts, ocsp: false });
        return await enrichSignedDataCerts(noOcspMsg);
      } catch (_) {}
    }
    // 2. If chain failed, retry without chain/OCSP
    if (effectiveOpts.includeChain) {
      const noChainOpts = { ...effectiveOpts, includeChain: false, ocsp: false };
      try {
        return await box.sign(dataBuffer, role, unusedCert, noChainOpts);
      } catch (innerErr) {
        if (shouldTsp) {
          return await box.sign(dataBuffer, role, unusedCert, { ...noChainOpts, tsp: false });
        }
        throw innerErr;
      }
    }
    if (shouldTsp) {
      const fallbackOpts = { ...effectiveOpts, ocsp: false, tsp: false };
      return await box.sign(dataBuffer, role, unusedCert, fallbackOpts);
    }
    throw err;
  }
}

function createBox(options = {}) {
  const fs = require('fs');
  const path = require('path');
  let casBuffer = options.casBuffer;
  if (!casBuffer) {
    const p1 = path.join(__dirname, '..', 'certs', 'ua-all-cas.p7b');
    const p2 = path.join(__dirname, '..', 'certs', 'mono.p7b');
    if (fs.existsSync(p1)) casBuffer = fs.readFileSync(p1);
    else if (fs.existsSync(p2)) casBuffer = fs.readFileSync(p2);
  }
  return new jk.Box({
    algo: getAlgos(),
    query: options.query || queryAdapter,
    casBuffer,
  });
}

module.exports = {
  queryAdapter,
  getAlgos,
  safeBoxSign,
  createBox,
};
