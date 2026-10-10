# 🇺🇦 LegalTech — Open Source Debian Packaging Ecosystem

An open-source **LegalTech** tooling ecosystem and professional `.deb` packaging workspace for Debian and Ubuntu.

Designed for lawyers, attorneys, insolvency officers, legal IT specialists, and researchers. All ecosystem tools adhere to a fundamental principle: **100% Offline-First, zero telemetry, personal data protection, and strict preservation of attorney-client privilege**.

---

## 🏛️ Packages in the Ecosystem

| Package | Description | Status | Documentation |
| :--- | :--- | :---: | :---: |
| **`qes-tools`** | Standalone QES/AES suite (DSTU 4145-2002, CAdES, stamped & unstamped PAdES, QR, ASiC-E, GOST encryption, court-ready OCR, 16 Nautilus scripts with Papirus UI & 01..16 ordering, contextual key/token selector modal, hardware tokens: DepositSign / Almaz-1K / Crystal-1K / SecureToken-337, official EUSW drivers & browser extension daemon, Web Sign Agent HTTP:8081 / HTTPS:8083). | **v1.0.10** (Stable) | [Package README](packages/qes-tools/README.md) |
| **`deb-package-starter`** | Universal starter template for rapid development of new Debian packages. | **Template** | [Template README](templates/deb-package-starter/README.md) |

---

## ⚡ Quick Installation & Automated Updates

### 🌟 Official APT Repository (Recommended for `sudo apt upgrade`):

Configure the repository once in your terminal:

```bash
# 1. Add the repository's public GPG key
curl -fsSL https://yaroslavbaienko.github.io/legaltech/public.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/legaltech.gpg

# 2. Add the LegalTech repository to APT sources
echo "deb [signed-by=/etc/apt/keyrings/legaltech.gpg] https://yaroslavbaienko.github.io/legaltech stable main" | sudo tee /etc/apt/sources.list.d/legaltech.list

# 3. Update indices and install qes-tools
sudo apt update
sudo apt install qes-tools
```

Once installed, future updates will be applied automatically via standard system upgrades:
```bash
sudo apt update && sudo apt upgrade
```

---

### Or Local Installation of a Pre-built `.deb` Package:

Download the latest release `.deb` package from [Releases](https://github.com/YaroslavBaienko/legaltech/releases) and install it:

```bash
sudo apt install ./packages/qes-tools/dist/qes-tools_1.0.10_amd64.deb
```

The `apt` package manager will automatically resolve and install all system dependencies. After installation, all features are ready:
- **In GNOME Files (Nautilus)**: Right-click any file ➔ **Scripts** ➔ **`🔐 КЕП та Безпека`** (16 strictly numbered `01..16` actions, beautiful Papirus styling, Pango headers, and full Ukrainian/English localization).
- **Interactive Context Selection Modal**: Whenever signing without an explicit key flag, a clean modal prompts whether to use the pre-configured file key (`~/.secure_keys/`), a connected hardware USB token (ЗНОК), or browse for an alternative `.pfx`/`.p12` container.
- **In the Terminal**: `qes-tool`, `qes-sign`, `qes-verify`, `qes-cert`, `qes-ocr`, `qes-pdf-court`, `qes-encrypt`, `qes-decrypt`, `qes-export-cert`, `qes-agent`, `qes-config`.
- **Hardware USB Tokens (ЗНОК)**: Out-of-the-box drivers and udev rules for DepositSign / IIT («Алмаз-1К», «Кристал-1К»), Author («SecureToken-337»), and SafeNet. Run `qes-tool token` to inspect connected tokens.
- **Web Browser E-Filing & Sign Portals**: Automated Native Messaging Host (`euscpnmh`) integration for Chrome, Chromium, Brave, Microsoft Edge, and Mozilla Firefox (Дія, Електронний суд, ДПС, ProZorro, DepositSign). Local Web Sign Agent runs on ports 8081 / 8083 via `qes-agent start-web`.

---

## 🛠️ Development Workspace & Creating New Packages

This repository is designed as a **Debian packaging workspace** (factory for `.deb` packages).

### How to Create a New Package in 10 Seconds:

1. Run the built-in CLI generator:
   ```bash
   ./tools/new-deb-package.sh my-legal-tool "Fast tool for court proceedings"
   ```
2. The generator will create the `packages/my-legal-tool` directory following Debian Policy standards (`control`, `copyright`, `changelog`, `build.sh`, `Makefile`, `tests/`).
3. Add your source code to `packages/my-legal-tool/src/`.
4. Run tests and build:
   ```bash
   cd packages/my-legal-tool
   make test
   make build
   ```
5. Your new `.deb` package is ready in the `dist/` directory!

---

## 📚 Documentation

- [📦 Installation & Upgrade Guide](docs/INSTALLATION_GUIDE.md) — How to configure the APT repository, install, and update packages via `sudo apt upgrade`.
- [📖 Practical Debian Packaging Guide](docs/DEB_PACKAGING_GUIDE.md) — Anatomy of `.deb`, FHS standards, `control` syntax, and linting with `lintian`.
- [🌐 APT Repository Administration Guide](docs/APT_REPOSITORY_GUIDE.md) — GitHub Pages repository architecture, build automation, and release workflows.
- [🔐 QES Tools Documentation](packages/qes-tools/README.md) — Complete manual covering all CLI commands and workflows.

---

## 🧪 CI/CD & Automation

All packages are covered by end-to-end test suites and automated GitHub Actions workflows:
- **`ci.yml`**: Automatically runs unit tests and E2E scenarios on a clean Ubuntu environment for every commit and pull request.
- **`build-deb.yml`**: Isolated build of `.deb` packages and artifact archiving.
- **`apt-repo.yml`**: Automated build, indexing, GPG signing, and publication of the APT repository to GitHub Pages.
- **`release.yml`**: Automated release and binary publication upon pushing a git tag (`git tag v1.0.3 && git push origin v1.0.3`).

---

## ⚖️ License

Source code is released under the [Apache 2.0 License](LICENSE). Free for use, modification, and distribution.
