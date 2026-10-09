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
- **🔑 Hardware Security Tokens (ЗНОК) & EUSW Integration**:
  - Full native driver integration for **DepositSign / IIT «Алмаз-1К»** (`03eb:9324`), **«Кристал-1К»** (`03eb:9325`), **Author «SecureToken-337»** (`0483:5740`), and **SafeNet eToken 5110**.
  - Bundles all 30 native crypto modules from IIT End-User CA-1 (`eusw` v1.3.1.109) in `/opt/iit/eu/sw/`.
  - Non-root user USB device access via `/etc/udev/rules.d/60-iit-e-keys.rules`.
  - Native Messaging Host daemon (`euscpnmh`) automatically configured for Chrome, Chromium, Brave, Edge, and Firefox for web e-filing (Дія, Е-Суд, ДПС, ProZorro).
  - Diagnostic tools: `qes-tool token` and `qes-cert --tokens`.
- **🏛️ National QTSP Registry & Universal CA Bundle**:
  - Registry of all 21 accredited Ukrainian trust service providers (`providers.js`) with auto-discovery and live CMP/TSP/OCSP endpoints.
  - Universal national certificate bundle `ua-all-cas.p7b` (175 certificates from CZO Trusted List).
- **🖱️ Full GNOME Files (Nautilus) Integration**:
  - 16 ready-to-use actions in the desktop context menu: **Scripts ➔ 🔐 КЕП та Безпека / QES & Security**.
  - Interactive GUI prompts with Zenity (`--gui`).
  - Dynamic language switching: `qes-config --lang uk|en|auto`.
- **🔒 Secure In-Memory Password Caching (`qes-agent`)**:
  - Private key passwords requested once per session and stored exclusively in RAM (TTL 15–30 min).
  - Instant memory wipe on demand via GUI button or CLI: `qes-agent clear`.

---

## 📦 Package Installation

### Quick Installation on Debian / Ubuntu:

```bash
sudo apt install ./dist/qes-tools_1.0.6_amd64.deb
```

The `apt` package manager automatically resolves and installs all required dependencies (`nodejs`, `python3-cryptography`, `openssl`, `zenity`, `qpdf`, `ocrmypdf`, `tesseract-ocr-ukr`, `tesseract-ocr-eng`, `libnotify-bin`, `libpcsclite1`).

After installation:
- All master and subcommand CLI utilities become available on `$PATH`: `qes-tool`, `qes-sign`, `qes-verify`, `qes-cert`, `qes-ocr`, `qes-pdf-court`, `qes-encrypt`, `qes-decrypt`, `qes-export-cert`, `qes-agent`, `qes-config`.
- Hardware token drivers and browser extension daemon are pre-configured.
- The Nautilus context menu scripts are registered for the desktop environment.

---

## 🛠️ Command-Line Interface (CLI) Usage

```bash
# 1. Master CLI umbrella and diagnostics
qes-tool --help
qes-tool token                    # Diagnose connected hardware tokens (DepositSign, Almaz-1K, etc.)
qes-tool providers                # Display accredited national QTSP registry

# 2. Sign PDF with visual stamp and QR code
qes-sign --pades lawsuit.pdf

# 3. Add an additional signature (multi-signature / counter-sign)
qes-sign --append contract_signed.pdf

# 4. Create an ASiC-E archive container
qes-sign --asice contract.pdf annex1.pdf -o case.asice

# 5. Verify signatures (terminal output or interactive GUI dialog)
qes-verify document.pdf.p7s
qes-verify --gui contract_signed.pdf

# 6. Inspect QTSP certificate or connected tokens
qes-cert my_certificate.cer
qes-cert --tokens                 # Inspect connected hardware USB tokens
qes-cert -j my_certificate.cer    # JSON output for scripting

# 7. Optimize scanned document for E-Court with English OCR
qes-pdf-court --eng contract_scan.pdf

# 8. Encrypt and decrypt files
qes-encrypt confidential_file.pdf
qes-decrypt confidential_file.pdf.enc

# 9. Clear cached passwords from memory
qes-agent clear
```

---

## 🧪 Running Tests

```bash
# Unit tests for the signing engine & token drivers (25 tests)
npm test

# Comprehensive end-to-end test suite (65 verification checks)
./tests/e2e_all_scenarios.sh
```

---

## ⚖️ License

Apache License 2.0. Free for use by law firms, government agencies, corporate legal departments, and open-source projects.
