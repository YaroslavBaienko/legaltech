/**
 * pades.js — PDF Advanced Electronic Signature (PAdES) & Visual Stamp Generator.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const QRCode = require('qrcode');
const {
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFArray,
  PDFDict,
  PDFInvalidObject,
  PDFString,
  PDFHexString,
} = require('pdf-lib');
const { pdflibAddPlaceholder } = require('@signpdf/placeholder-pdf-lib');
const { SignPdf } = require('@signpdf/signpdf');
const { Signer, SUBFILTER_ETSI_CADES_DETACHED, ANNOTATION_FLAGS, SIG_FLAGS } = require('@signpdf/utils');
const { safeBoxSign } = require('./adapter');

class EngineSigner extends Signer {
  constructor(box, options = {}) {
    super();
    this.box = box;
    this.options = options;
  }

  async sign(pdfBuffer) {
    const signOpts = {
      detached: true,
      tsp: this.options.tsp !== false ? 'all' : false,
      includeChain: true,
      time: this.options.time ? Math.floor(new Date(this.options.time).getTime() / 1000) : undefined,
    };
    const message = await safeBoxSign(this.box, pdfBuffer, null, signOpts);
    return message.as_asn1();
  }
}

/**
 * Extracts signer details from the active box / certificate.
 */
function extractCertInfo(box) {
  const keyInfo = box.keys.find((k) => k.cert);
  if (!keyInfo || !keyInfo.cert) {
    throw new Error('У крипторушії відсутній відкритий сертифікат для генерації штампа.');
  }
  const cert = keyInfo.cert;
  const subj = cert.subject || {};
  const issuer = cert.issuer || {};

  // Extract RNTR / DRFO / TIN
  let rnokpp = '';
  if (subj.serialNumber) {
    const m = subj.serialNumber.match(/\d{8,10}/);
    if (m) rnokpp = m[0];
  }

  // Serial hex
  const serialHex = cert.serial ? cert.serial.toString('hex').toUpperCase() : '';

  // Dates
  const validFrom = cert.valid && cert.valid.from ? new Date(cert.valid.from) : null;
  const validTo = cert.valid && cert.valid.to ? new Date(cert.valid.to) : null;

  return {
    commonName: subj.commonName || `${subj.surname || ''} ${subj.givenName || ''}`.trim() || 'Підписувач КЕП',
    rnokpp,
    issuerName: issuer.commonName || issuer.organizationName || 'КНЕДП',
    serialHex,
    validFrom,
    validTo,
    locality: subj.localityName || 'Україна',
  };
}

function getTypstBin() {
  const candidates = [
    process.env.TYPST_BIN,
    path.join(__dirname, '..', 'bin', 'typst'),
    '/usr/lib/qes-tools/bin/typst',
    path.join(os.homedir(), '.local', 'bin', 'typst'),
    'typst',
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return c;
      }
    } catch (_) {}
  }
  return 'typst';
}

/**
 * Generates an official visual stamp box PNG using Typst (transparent background).
 */
async function generateStampBoxPng(certInfo, options = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qes-box-'));
  const qrPngPath = path.join(tmpDir, 'qr.png');
  const typPath = path.join(tmpDir, 'stamp_box.typ');
  const outPngPath = path.join(tmpDir, 'stamp_box.png');

  try {
    const verifyUrl = options.verifyUrl || 'https://czo.gov.ua/verify';
    await QRCode.toFile(qrPngPath, verifyUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#0a3d62', light: '#ffffff' },
    });

    const now = options.time ? new Date(options.time) : new Date();
    const signTimeStr = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    const validToStr = certInfo.validTo ? certInfo.validTo.toISOString().substring(0, 10) : '—';

    const typstCode = `
#set page(width: 12.0cm, height: 3.5cm, margin: 0cm, fill: none)
#set text(font: "Liberation Sans", lang: "uk", size: 7.5pt)

#rect(
  width: 100%,
  height: 100%,
  stroke: 1.5pt + rgb("#0a3d62"),
  fill: rgb("#f8fafc"),
  radius: 4pt,
  inset: (x: 8pt, y: 6pt),
)[
  #grid(
    columns: (1fr, auto),
    gutter: 8pt,
    [
      #text(weight: "bold", size: 8.5pt, fill: rgb("#0a3d62"))[
        🇺🇦 КВАЛІФІКОВАНИЙ ЕЛЕКТРОННИЙ ПІДПИС
      ]
      #v(2pt)
      #line(length: 100%, stroke: 0.5pt + rgb("#cbd5e1"))
      #v(2pt)
      #grid(
        columns: (auto, 1fr),
        row-gutter: 2.5pt,
        column-gutter: 4pt,
        [*Підписувач:*], [${certInfo.commonName}],
        [*РНОКПП:*], [${certInfo.rnokpp || '—'}],
        [*КНЕДП:*], [${certInfo.issuerName}],
        [*Час підпису:*], [${signTimeStr} (позначка TSP)],
        [*Серійний №:*], [${certInfo.serialHex}],
        [*Дійсний до:*], [${validToStr}],
      )
    ],
    [
      #align(center)[
        #image("qr.png", width: 2.3cm)
        #v(-2pt)
        #text(size: 5.5pt, fill: rgb("#64748b"))[czo.gov.ua/verify]
      ]
    ]
  )
]
`;

    fs.writeFileSync(typPath, typstCode);
    const typstBin = getTypstBin();
    execSync(`"${typstBin}" compile "${typPath}" "${outPngPath}"`);

    return fs.readFileSync(outPngPath);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

/**
 * Generates an official visual stamp PDF using Typst and overlays it on the target PDF using qpdf.
 */
async function applyVisualStamp(inputPdfPath, certInfo, options = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qes-stamp-'));
  const qrPngPath = path.join(tmpDir, 'qr.png');
  const typPath = path.join(tmpDir, 'stamp.typ');
  const stampPdfPath = path.join(tmpDir, 'stamp.pdf');
  const outputPdfPath = path.join(tmpDir, 'stamped.pdf');

  try {
    // 1. Generate QR Code
    const verifyUrl = options.verifyUrl || 'https://czo.gov.ua/verify';
    await QRCode.toFile(qrPngPath, verifyUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#0a3d62', light: '#ffffff' },
    });

    // 2. Format dates
    const now = options.time ? new Date(options.time) : new Date();
    const signTimeStr = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    const validToStr = certInfo.validTo ? certInfo.validTo.toISOString().substring(0, 10) : '—';

    // 3. Typst markup for visual stamp
    const typstCode = `
#set page(paper: "a4", margin: 0cm, fill: none)
#set text(font: "Liberation Sans", lang: "uk", size: 7.5pt)

#place(bottom + right, dx: -1.2cm, dy: -1.2cm)[
  #rect(
    width: 12.0cm,
    stroke: 1.5pt + rgb("#0a3d62"),
    fill: rgb("#f8fafc"),
    radius: 4pt,
    inset: (x: 8pt, y: 6pt),
  )[
    #grid(
      columns: (1fr, auto),
      gutter: 8pt,
      [
        #text(weight: "bold", size: 8.5pt, fill: rgb("#0a3d62"))[
          🇺🇦 КВАЛІФІКОВАНИЙ ЕЛЕКТРОННИЙ ПІДПИС
        ]
        #v(2pt)
        #line(length: 100%, stroke: 0.5pt + rgb("#cbd5e1"))
        #v(2pt)
        #grid(
          columns: (auto, 1fr),
          row-gutter: 2.5pt,
          column-gutter: 4pt,
          [*Підписувач:*], [${certInfo.commonName}],
          [*РНОКПП:*], [${certInfo.rnokpp || '—'}],
          [*КНЕДП:*], [${certInfo.issuerName}],
          [*Час підпису:*], [${signTimeStr} (позначка TSP)],
          [*Серійний №:*], [${certInfo.serialHex}],
          [*Дійсний до:*], [${validToStr}],
        )
      ],
      [
        #align(center)[
          #image("qr.png", width: 2.3cm)
          #v(-2pt)
          #text(size: 5.5pt, fill: rgb("#64748b"))[czo.gov.ua/verify]
        ]
      ]
    )
  ]
]
`;

    fs.writeFileSync(typPath, typstCode);
    const typstBin = getTypstBin();
    execSync(`"${typstBin}" compile "${typPath}" "${stampPdfPath}"`);

    // 4. Overlay using qpdf onto destination page (default: last page 'z')
    const toPage = options.page || 'z';
    execSync(`qpdf "${inputPdfPath}" --overlay "${stampPdfPath}" --to=${toPage} -- "${outputPdfPath}"`);

    const resultBuffer = fs.readFileSync(outputPdfPath);
    return resultBuffer;
  } finally {
    // Cleanup temporary files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

/**
 * Checks if a PDF buffer already contains existing digital signatures.
 */
function hasExistingSignatures(pdfBuffer) {
  return pdfBuffer.indexOf('/ByteRange') !== -1;
}

/**
 * Signs an already-signed PDF file incrementally (PAdES Multi-Signature).
 * Preserves all previous revisions and signatures bit-for-bit without alteration.
 */
async function signPdfPAdESIncremental(box, inputPdfPath, options = {}) {
  const certInfo = extractCertInfo(box);
  const origBuffer = fs.readFileSync(inputPdfPath);

  const pdfDoc = await PDFDocument.load(origBuffer);
  const snapshot = pdfDoc.takeSnapshot();

  // 1. Determine existing signatures count
  const acroForm = pdfDoc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  let sigCount = 1;
  if (acroForm) {
    const fields = acroForm.lookupMaybe(PDFName.of('Fields'), PDFArray);
    if (fields) {
      sigCount = fields.size() + 1;
    }
  }
  const sigFieldName = `Signature${sigCount}`;

  // 2. Select page for placement (default: last page)
  const pages = pdfDoc.getPages();
  const page = pages[pages.length - 1];

  // 3. Visual Stamp for secondary signature (stacked above preceding stamps)
  const stampWidthPt = 12 * 28.3465; // 12cm = 340.16 pt
  const stampHeightPt = 3.5 * 28.3465; // 3.5cm = 99.21 pt
  const marginPt = 34.02; // 1.2cm

  let stampX = 0;
  let stampY = 0;

  if (options.stamp !== false) {
    // Stack above previous stamps or place in column
    stampX = page.getWidth() - marginPt - stampWidthPt;
    stampY = marginPt + (sigCount - 1) * (stampHeightPt + 10);
    if (stampY + stampHeightPt > page.getHeight() - marginPt) {
      // Shift left if stacked too high
      stampX = marginPt;
      stampY = marginPt + ((sigCount - 1) % 4) * (stampHeightPt + 10);
    }

    const pngBytes = await generateStampBoxPng(certInfo, options);
    const stampImage = await pdfDoc.embedPng(pngBytes);

    page.drawImage(stampImage, {
      x: stampX,
      y: stampY,
      width: stampWidthPt,
      height: stampHeightPt,
    });
    snapshot.markRefForSave(page.ref);
  }

  // 4. Create signature dictionary and placeholder
  const byteRange = PDFArray.withContext(pdfDoc.context);
  byteRange.push(PDFNumber.of(0));
  byteRange.push(PDFName.of('**********'));
  byteRange.push(PDFName.of('**********'));
  byteRange.push(PDFName.of('**********'));

  const placeholder = PDFHexString.of(String.fromCharCode(0).repeat(16384));
  const signatureDict = pdfDoc.context.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: SUBFILTER_ETSI_CADES_DETACHED,
    ByteRange: byteRange,
    Contents: placeholder,
    Reason: PDFString.of(options.reason || `Підписано КЕП (ДСТУ 4145-2002) — Підпис #${sigCount}`),
    ContactInfo: PDFString.of(certInfo.issuerName),
    Name: PDFString.of(certInfo.commonName),
    Location: PDFString.of(certInfo.locality || 'Україна'),
    M: PDFString.fromDate(options.time ? new Date(options.time) : new Date()),
  });

  const sigBuffer = new Uint8Array(signatureDict.sizeInBytes());
  signatureDict.copyBytesInto(sigBuffer, 0);
  const sigRef = pdfDoc.context.register(PDFInvalidObject.of(sigBuffer));

  const widgetRect = PDFArray.withContext(pdfDoc.context);
  [stampX, stampY, stampX + stampWidthPt, stampY + stampHeightPt].forEach((c) => widgetRect.push(PDFNumber.of(c)));

  const apStream = pdfDoc.context.formXObject([], { BBox: [0, 0, 0, 0], Resources: {} });
  const widgetDict = pdfDoc.context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: widgetRect,
    V: sigRef,
    T: PDFString.of(sigFieldName),
    F: ANNOTATION_FLAGS.PRINT,
    P: page.ref,
    AP: { N: pdfDoc.context.register(apStream) },
  });
  const widgetRef = pdfDoc.context.register(widgetDict);

  // Add widget to page annotations
  let annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (!annots) {
    annots = pdfDoc.context.obj([]);
    page.node.set(PDFName.of('Annots'), annots);
  }
  annots.push(widgetRef);
  snapshot.markRefForSave(page.ref);

  // Add widget to AcroForm
  let form = acroForm;
  if (!form) {
    form = pdfDoc.context.obj({ Fields: [] });
    const formRef = pdfDoc.context.register(form);
    pdfDoc.catalog.set(PDFName.of('AcroForm'), formRef);
    snapshot.markRefForSave(pdfDoc.catalog.ref || pdfDoc.context.trailerInfo.Root);
  }
  let fields = form.lookupMaybe(PDFName.of('Fields'), PDFArray);
  if (!fields) {
    fields = pdfDoc.context.obj([]);
    form.set(PDFName.of('Fields'), fields);
  }
  fields.push(widgetRef);

  const flags = form.lookupMaybe(PDFName.of('SigFlags'), PDFNumber);
  const curFlags = flags ? flags.asNumber() : 0;
  form.set(PDFName.of('SigFlags'), PDFNumber.of(curFlags | SIG_FLAGS.SIGNATURES_EXIST | SIG_FLAGS.APPEND_ONLY));

  const formRef = pdfDoc.catalog.get(PDFName.of('AcroForm'));
  if (formRef) snapshot.markRefForSave(formRef);
  snapshot.markRefForSave(pdfDoc.catalog.ref || pdfDoc.context.trailerInfo.Root);

  // 5. Serialize incremental update
  const incBytes = await pdfDoc.saveIncremental(snapshot);
  const pdfWithPlaceholder = Buffer.concat([origBuffer, incBytes]);

  // 6. Sign byte ranges with QESEngine
  const signer = new EngineSigner(box, options);
  const signPdf = new SignPdf();
  const signedPdfBuffer = await signPdf.sign(pdfWithPlaceholder, signer);

  // 7. Output path resolution
  let outPath = options.outputPath;
  if (!outPath) {
    const parsed = path.parse(inputPdfPath);
    if (parsed.name.endsWith('_signed')) {
      outPath = path.join(parsed.dir, `${parsed.name}_multisigned.pdf`);
    } else {
      outPath = path.join(parsed.dir, `${parsed.name}_signed.pdf`);
    }
  }

  fs.writeFileSync(outPath, signedPdfBuffer);

  return {
    outputPath: outPath,
    fileSize: signedPdfBuffer.length,
    stamped: options.stamp !== false,
    certInfo,
    isMultiSignature: true,
    sigCount,
  };
}

/**
 * Signs a PDF file with PAdES (embedded signature) and optional visual stamp.
 * Automatically chooses incremental update if the PDF is already digitally signed.
 */
async function signPdfPAdES(box, inputPdfPath, options = {}) {
  const origBuffer = fs.readFileSync(inputPdfPath);
  const isAlreadySigned = hasExistingSignatures(origBuffer);

  if (options.append || isAlreadySigned) {
    return signPdfPAdESIncremental(box, inputPdfPath, options);
  }

  const certInfo = extractCertInfo(box);

  // 1. Apply visual stamp if requested
  let pdfBuffer;
  if (options.stamp !== false) {
    pdfBuffer = await applyVisualStamp(inputPdfPath, certInfo, options);
  } else {
    pdfBuffer = origBuffer;
  }

  // 2. Add signature placeholder via pdf-lib
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  pdflibAddPlaceholder({
    pdfDoc,
    reason: options.reason || 'Підписано КЕП (ДСТУ 4145-2002)',
    contactInfo: certInfo.issuerName,
    name: certInfo.commonName,
    location: certInfo.locality || 'Україна',
    subFilter: SUBFILTER_ETSI_CADES_DETACHED,
    signatureLength: 16384, // plenty of space for full CAdES-T with certs and TSP
  });

  const pdfWithPlaceholder = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));

  // 3. Sign byte ranges with QESEngine
  const signer = new EngineSigner(box, options);
  const signPdf = new SignPdf();
  const signedPdfBuffer = await signPdf.sign(pdfWithPlaceholder, signer);

  // 4. Determine output path
  let outPath = options.outputPath;
  if (!outPath) {
    const parsed = path.parse(inputPdfPath);
    outPath = path.join(parsed.dir, `${parsed.name}_signed.pdf`);
  }

  fs.writeFileSync(outPath, signedPdfBuffer);

  return {
    outputPath: outPath,
    fileSize: signedPdfBuffer.length,
    stamped: options.stamp !== false,
    certInfo,
    isMultiSignature: false,
    sigCount: 1,
  };
}

module.exports = {
  signPdfPAdES,
  signPdfPAdESIncremental,
  applyVisualStamp,
  generateStampBoxPng,
  extractCertInfo,
  hasExistingSignatures,
};
