# 🔐 QES Tools — Ukrainian Qualified Electronic Signature (QES / AES) & LegalTech Suite

**QES Tools** is an autonomous (100% offline-first), confidential toolkit for working with Ukrainian Qualified and Advanced Electronic Signatures (DSTU 4145-2002, PKCS#7 / CAdES, PAdES, ASiC-E), document encryption (GOST 28147:89 / `.enc` crypto vaults), OCR processing, and PDF optimization for the Ukrainian "Electronic Court" e-filing system.

Engineered to preserve **attorney-client privilege**, complying with the Law of Ukraine "On Electronic Identification and Electronic Trust Services" and the European eIDAS regulation.

---

## 🌟 Key Features

- **✍️ Document Signing (CAdES / PAdES / ASiC-E)**:
  - Generate detached `.p7s` signatures.
  - Embedded PDF signing (PAdES) with official visual stamp and verification QR code.
  - Multi-file container bundles (ETSI TS 102 918 `.asice`) for legal cases and contracts.
  - Multi-signature support (counter-signing existing PDF, ASiC-E, and `.p7s` files without breaking cryptographic integrity).
- **🔍 Signature & Certificate Verification (`qes-verify`, `qes-cert`)**:
  - Instant local validation of mathematical integrity without transmitting documents to third-party cloud services.
  - Detailed QTSP / CA certificate inspector: Full Name, Tax ID (RNOKPP/DRFO), Company ID (EDRPOU), organization role, validity period, and public key parameters.
- **🛡️ Asymmetric Encryption & Crypto Vaults (`qes-encrypt`, `qes-decrypt`)**:
  - Personal encrypted vault (`.enc`) using DSTU 4145 Diffie-Hellman key agreement and GOST 28147:89 symmetric cipher.
  - Public-key encryption for clients/counterparties using their X.509 certificate (`.cer`).
- **👁️ Optical Character Recognition OCR (`qes-ocr`)**:
  - Dual-language mode (Ukrainian + English: `ukr+eng`).
  - Dedicated English mode (`--eng` / `-e`) for international contracts and invoices.
  - Automatic scan deskewing and linearization for court admissibility.
- **⚖️ PDF Optimization for "Electronic Court" (`qes-pdf-court`)**:
  - Automated Fast Web View linearization for rapid opening in judicial portals.
  - Object stream compression and validation against the 50 MB platform upload limit.
- **🖱️ Full GNOME Files (Nautilus) Integration**:
  - 16 ready-to-use actions in the desktop context menu: **Scripts ➔ 🔐 КЕП та Безпека**.
  - Interactive GUI prompts with Zenity (`--gui`).
- **🔒 Secure In-Memory Password Caching (`qes-agent`)**:
  - Private key passwords requested once per session and stored exclusively in RAM (TTL 15–30 min).
  - Instant memory wipe on demand via GUI button or CLI: `qes-agent clear`.

---

## 📦 Package Installation

### Quick Installation on Debian / Ubuntu:

```bash
sudo apt install ./dist/qes-tools_1.0.3_amd64.deb
```

The `apt` package manager automatically resolves and installs all required dependencies (`nodejs`, `python3-cryptography`, `openssl`, `zenity`, `qpdf`, `ocrmypdf`, `tesseract-ocr-ukr`, `tesseract-ocr-eng`, `libnotify-bin`).

After installation:
- All 9 CLI commands become available on the system `$PATH`.
- The Nautilus context menu scripts are registered for the desktop environment.

---

## 🛠️ Command-Line Interface (CLI) Usage

```bash
# 1. Sign PDF with visual stamp and QR code
qes-sign --pades lawsuit.pdf

# 2. Add an additional signature (multi-signature / counter-sign)
qes-sign --append contract_signed.pdf

# 3. Create an ASiC-E archive container
qes-sign --asice contract.pdf annex1.pdf -o case.asice

# 4. Verify signatures (terminal output or interactive GUI dialog)
qes-verify document.pdf.p7s
qes-verify --gui contract_signed.pdf

# 5. Inspect QTSP certificate
qes-cert my_certificate.cer
qes-cert -j my_certificate.cer    # JSON output for scripting

# 6. Optimize scanned document for E-Court with English OCR
qes-pdf-court --eng contract_scan.pdf

# 7. Encrypt and decrypt files
qes-encrypt confidential_file.pdf
qes-decrypt confidential_file.pdf.enc

# 8. Clear cached passwords from memory
qes-agent clear
```

---

## 🧪 Running Tests

```bash
# Unit tests for the signing engine (17 tests)
npm test

# Comprehensive end-to-end test suite (47 verification checks)
./tests/e2e_all_scenarios.sh
```

---

## ⚖️ License

Apache License 2.0. Free for use by law firms, government agencies, corporate legal departments, and open-source projects.
