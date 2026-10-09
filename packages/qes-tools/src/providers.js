/**
 * providers.js — Central Registry & Auto-Discovery for Ukrainian Qualified Trust Service Providers (QTSPs)
 * Covers all accredited providers from the official Ukrainian Trusted List (TSL, czo.gov.ua)
 * and hardware security tokens (ЗНОК - Алмаз-1К, Кристал-1К, SecureToken-337).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROVIDERS = {
  depositsign: {
    id: 'depositsign',
    name: 'КНЕДП ТОВ «ДЕПОЗИТ САЙН» (DepositSign)',
    shortName: 'DepositSign',
    edrpou: '43005049',
    domains: ['depositsign.com', 'ca.depositsign.com'],
    cmp: ['https://ca.depositsign.com/services/cmp/'],
    ocsp: ['https://ca.depositsign.com/services/ocsp/'],
    tsp: ['https://ca.depositsign.com/services/tsp/'],
    matchers: [/DEPOSIT\s*SIGN/i, /ДЕПОЗИТ\s*САЙН/i, /43005049/],
  },
  monobank: {
    id: 'monobank',
    name: 'КНЕДП АТ «УНІВЕРСАЛ БАНК» (monobank | Universal Bank)',
    shortName: 'monobank',
    edrpou: '21133352',
    domains: ['monobank.ua', 'ca.monobank.ua'],
    cmp: ['http://ca.monobank.ua/services/cmp/'],
    ocsp: ['http://ca.monobank.ua/services/ocsp/'],
    tsp: ['http://ca.monobank.ua/services/tsp/'],
    matchers: [/monobank/i, /UNIVERSAL\s*BANK/i, /УНІВЕРСАЛ\s*БАНК/i],
  },
  diia: {
    id: 'diia',
    name: 'КНЕДП «Дія» (ДП «Дія» / Мінцифри)',
    shortName: 'Дія',
    edrpou: '43395033',
    domains: ['diia.gov.ua', 'ca.diia.gov.ua'],
    cmp: ['https://ca.diia.gov.ua/services/cmp/'],
    ocsp: ['https://ca.diia.gov.ua/services/ocsp/'],
    tsp: ['https://ca.diia.gov.ua/services/tsp/'],
    matchers: [/ДІЯ/i, /DIIA/i, /43395033/],
  },
  dps: {
    id: 'dps',
    name: 'КНЕДП Державної податкової служби України (ІДД ДПС)',
    shortName: 'Податкова (ДПС)',
    edrpou: '43005393',
    domains: ['acskidd.gov.ua'],
    cmp: ['http://acskidd.gov.ua/services/cmp/'],
    ocsp: ['http://acskidd.gov.ua/services/ocsp/'],
    tsp: ['http://acskidd.gov.ua/services/tsp/'],
    matchers: [/ІДД\s*ДПС/i, /Податков/i, /acskidd/i, /43005393/],
  },
  privatbank: {
    id: 'privatbank',
    name: 'КНЕДП АТ КБ «ПРИВАТБАНК»',
    shortName: 'ПриватБанк',
    edrpou: '14360570',
    domains: ['privatbank.ua', 'acsk.privatbank.ua'],
    cmp: ['http://acsk.privatbank.ua/services/cmp/'],
    ocsp: ['http://acsk.privatbank.ua/services/ocsp/'],
    tsp: ['http://acsk.privatbank.ua/services/tsp/'],
    matchers: [/ПРИВАТБАНК/i, /PRIVATBANK/i, /14360570/],
  },
  vchasno: {
    id: 'vchasno',
    name: 'КНЕДП ТОВ «Вчасно Сервіс» (Вчасно.КЕП)',
    shortName: 'Вчасно',
    edrpou: '41231992',
    domains: ['vchasno.ua', 'ca.vchasno.ua'],
    cmp: ['https://ca.vchasno.ua/services/cmp/'],
    ocsp: ['https://ca.vchasno.ua/services/ocsp/'],
    tsp: ['https://ca.vchasno.ua/services/tsp/'],
    matchers: [/ВЧАСНО/i, /VCHASNO/i, /41231992/],
  },
  nais: {
    id: 'nais',
    name: 'КНЕДП ДП «НАІС» (Міністерство юстиції України)',
    shortName: 'НАІС (Мін\'юст)',
    edrpou: '39787008',
    domains: ['informjust.ua', 'ca.informjust.ua'],
    cmp: ['http://ca.informjust.ua/services/cmp/'],
    ocsp: ['http://ca.informjust.ua/services/ocsp/'],
    tsp: ['http://ca.informjust.ua/services/tsp/'],
    matchers: [/НАІС/i, /НАЦІОНАЛЬНІ\s*ІНФОРМАЦІЙНІ\s*СИСТЕМИ/i, /39787008/],
  },
  mvs: {
    id: 'mvs',
    name: 'КНЕДП МВС України (ДП «Інфотех»)',
    shortName: 'МВС України',
    edrpou: '00032684',
    domains: ['mvs.gov.ua', 'ca.mvs.gov.ua'],
    cmp: ['http://ca.mvs.gov.ua/services/cmp/'],
    ocsp: ['http://ca.mvs.gov.ua/services/ocsp/'],
    tsp: ['http://ca.mvs.gov.ua/services/tsp/'],
    matchers: [/МВС\s*України/i, /Internal\s*Affairs/i],
  },
  medoc: {
    id: 'medoc',
    name: 'КНЕДП ТОВ «ЦСК "Україна"» (M.E.Doc)',
    shortName: 'ЦСК Україна (M.E.Doc)',
    edrpou: '36865753',
    domains: ['u-key.com.ua', 'ukey.ua'],
    cmp: ['http://u-key.com.ua/services/cmp/'],
    ocsp: ['http://ocsp.u-key.com.ua/'],
    tsp: ['http://tsp.me-doc.com.ua/'],
    matchers: [/Центр\s*сертифікації\s*ключів\s*.*Україна/i, /u-key/i, /36865753/],
  },
  nbu: {
    id: 'nbu',
    name: 'КНЕДП Національного банку України (НБУ)',
    shortName: 'НБУ',
    edrpou: '00032106',
    domains: ['bank.gov.ua', 'zc.bank.gov.ua'],
    cmp: ['http://zc.bank.gov.ua/services/cmp/'],
    ocsp: ['http://zc.bank.gov.ua/services/ocsp/'],
    tsp: ['http://zc.bank.gov.ua/services/tsp/'],
    matchers: [/Національн.*банк.*Україн/i, /National\s*Bank\s*of\s*Ukraine/i],
  },
  oschadbank: {
    id: 'oschadbank',
    name: 'КНЕДП АТ «Ощадбанк»',
    shortName: 'Ощадбанк',
    edrpou: '00032129',
    domains: ['oschadbank.ua', 'ca.oschadbank.ua'],
    cmp: ['http://ca.oschadbank.ua/services/cmp/'],
    ocsp: ['http://ca.oschadbank.ua/services/ocsp/'],
    tsp: ['http://ca.oschadbank.ua/services/tsp/'],
    matchers: [/Ощадбанк/i, /OSCHADBANK/i],
  },
  czo: {
    id: 'czo',
    name: 'Центральний засвідчувальний орган (ЦЗО Мінцифри)',
    shortName: 'ЦЗО України',
    edrpou: '43220851',
    domains: ['czo.gov.ua'],
    cmp: ['http://czo.gov.ua/services/cmp/'],
    ocsp: ['http://czo.gov.ua/services/ocsp/'],
    tsp: ['http://czo.gov.ua/services/tsp/'],
    matchers: [/Центральний\s*засвідчувальний\s*орган/i, /ЦЗО/i, /Central\s*CA/i],
  },
};

/**
 * Returns prioritized list of all CMP lookup endpoints in Ukraine.
 */
function getCmpEndpoints() {
  const endpoints = [];
  const priorityOrder = [
    'depositsign',
    'diia',
    'dps',
    'privatbank',
    'monobank',
    'vchasno',
    'nais',
    'mvs',
    'medoc',
    'nbu',
    'oschadbank',
    'czo',
  ];
  for (const id of priorityOrder) {
    if (PROVIDERS[id] && PROVIDERS[id].cmp) {
      endpoints.push(...PROVIDERS[id].cmp);
    }
  }
  return [...new Set(endpoints)];
}

/**
 * Returns priority list of TSP (RFC 3161) servers in Ukraine.
 */
function getTspEndpoints() {
  const endpoints = [];
  for (const key of Object.keys(PROVIDERS)) {
    if (PROVIDERS[key].tsp) {
      endpoints.push(...PROVIDERS[key].tsp);
    }
  }
  return [...new Set(endpoints)];
}

/**
 * Returns priority list of OCSP servers in Ukraine.
 */
function getOcspEndpoints() {
  const endpoints = [];
  for (const key of Object.keys(PROVIDERS)) {
    if (PROVIDERS[key].ocsp) {
      endpoints.push(...PROVIDERS[key].ocsp);
    }
  }
  return [...new Set(endpoints)];
}

/**
 * Detects which Ukrainian QTSP issued a given certificate.
 */
function detectProvider(certOrIssuer) {
  if (!certOrIssuer) return null;
  const str = typeof certOrIssuer === 'string'
    ? certOrIssuer
    : JSON.stringify(certOrIssuer);

  for (const id of Object.keys(PROVIDERS)) {
    const prov = PROVIDERS[id];
    for (const rx of prov.matchers) {
      if (rx.test(str)) {
        return prov;
      }
    }
  }
  return null;
}

/**
 * Known hardware security tokens (ЗНОК) in Ukraine and their PKCS#11 drivers.
 */
const HARDWARE_TOKENS_CATALOG = [
  {
    vendorId: '03eb',
    productId: '9324',
    name: 'Е-ключ «Алмаз-1К» (USB CCID)',
    manufacturer: 'ПрАТ «ІІТ» (м. Харків)',
    provider: 'ТОВ «ДЕПОЗИТ САЙН» / ІІТ / ДПС',
    type: 'Hardware Secure Token (ЗНОК)',
    drivers: [
      '/opt/iit/eu/sw/pkcs11.eka1c.so',
      '/usr/lib/pkcs11/pkcs11-almaz1k.so',
    ],
  },
  {
    vendorId: '03eb',
    productId: '9325',
    name: 'Е-ключ «Кристал-1К» (USB CCID)',
    manufacturer: 'ПрАТ «ІІТ» (м. Харків)',
    provider: 'ІІТ / ДПС / Нотаріат',
    type: 'Hardware Secure Token (ЗНОК)',
    drivers: [
      '/opt/iit/eu/sw/pkcs11.ekc1.so',
      '/usr/lib/pkcs11/pkcs11-crystal1k.so',
    ],
  },
  {
    vendorId: '0483',
    productId: '5740',
    name: 'USB-токен «SecureToken-337» (CCID)',
    manufacturer: 'ТОВ «Автор» (м. Київ)',
    provider: 'Дія / МВС / Ощадбанк',
    type: 'Hardware Secure Token (ЗНОК)',
    drivers: [
      '/opt/iit/eu/sw/libav337p11d.so',
      '/usr/lib/pkcs11/pkcs11-securetoken337.so',
    ],
  },
  {
    vendorId: '0529',
    productId: '0620',
    name: 'SafeNet eToken 5110',
    manufacturer: 'Thales / SafeNet / Gemalto',
    provider: 'Міжнародні банки / Корпоративний КЕП',
    type: 'Hardware PKI Token',
    drivers: [
      '/usr/lib/x86_64-linux-gnu/opensc-pkcs11.so',
      '/usr/lib/libeToken.so',
    ],
  },
];

/**
 * Scans connected USB devices for hardware tokens.
 */
function detectHardwareTokens() {
  const detected = [];
  let lsusbOutput = '';
  try {
    lsusbOutput = execSync('lsusb 2>/dev/null', { encoding: 'utf-8' });
  } catch (_) {
    // If lsusb is unavailable, check /sys/bus/usb/devices
    try {
      const devPath = '/sys/bus/usb/devices';
      if (fs.existsSync(devPath)) {
        const dirs = fs.readdirSync(devPath);
        for (const d of dirs) {
          const vPath = path.join(devPath, d, 'idVendor');
          const pPath = path.join(devPath, d, 'idProduct');
          if (fs.existsSync(vPath) && fs.existsSync(pPath)) {
            const vid = fs.readFileSync(vPath, 'utf-8').trim().toLowerCase();
            const pid = fs.readFileSync(pPath, 'utf-8').trim().toLowerCase();
            lsusbOutput += `Bus 000 Device 000: ID ${vid}:${pid}\n`;
          }
        }
      }
    } catch (_) {}
  }

  for (const token of HARDWARE_TOKENS_CATALOG) {
    const pattern = new RegExp(`ID\\s+${token.vendorId}:${token.productId}`, 'i');
    if (pattern.test(lsusbOutput)) {
      const tokenCopy = { ...token };
      let foundDriver = null;
      for (const d of (token.drivers || [])) {
        if (fs.existsSync(d)) {
          foundDriver = d;
          break;
        }
        // Also check relative to package directory if not installed yet in root
        const rel = path.resolve(__dirname, '..', d.replace(/^\//, ''));
        if (fs.existsSync(rel)) {
          foundDriver = d;
          break;
        }
      }
      tokenCopy.driverInstalled = !!foundDriver;
      tokenCopy.driverPath = foundDriver || (token.drivers && token.drivers[0]) || null;
      detected.push(tokenCopy);
    }
  }

  // Check pcscd status
  let pcscdRunning = false;
  try {
    const ps = execSync('pgrep -x pcscd 2>/dev/null', { encoding: 'utf-8' });
    if (ps.trim()) pcscdRunning = true;
  } catch (_) {}

  return {
    detected: detected.length > 0,
    tokens: detected,
    pcscdRunning,
  };
}

module.exports = {
  PROVIDERS,
  getCmpEndpoints,
  getTspEndpoints,
  getOcspEndpoints,
  detectProvider,
  detectHardwareTokens,
  HARDWARE_TOKENS_CATALOG,
};
