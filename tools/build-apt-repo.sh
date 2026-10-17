#!/usr/bin/env bash
# ==============================================================================
# build-apt-repo.sh — Генератор та підписувач статичного APT-репозиторію
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET_DIR="${1:-${REPO_ROOT}/dist-apt}"

CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_GREEN="\033[32m"
CLR_CYAN="\033[36m"
CLR_YELLOW="\033[33m"

echo -e "${CLR_BOLD}${CLR_CYAN}==============================================================================${CLR_RESET}"
echo -e "${CLR_BOLD}${CLR_CYAN}         Генерація статичного APT-репозиторію LegalTech${CLR_RESET}"
echo -e "${CLR_BOLD}${CLR_CYAN}==============================================================================${CLR_RESET}"

# 1. Створення структури папок APT
mkdir -p "${TARGET_DIR}/pool/main"
mkdir -p "${TARGET_DIR}/dists/stable/main/binary-amd64"
mkdir -p "${TARGET_DIR}/dists/stable/main/binary-all"

# 2. Копіювання deb-пакетів у pool/main
echo -e "${CLR_YELLOW}1. Збирання deb-пакетів у pool/main...${CLR_RESET}"
find "${REPO_ROOT}/packages" -type f -name "*.deb" -exec cp -u {} "${TARGET_DIR}/pool/main/" \;

DEB_COUNT=$(find "${TARGET_DIR}/pool/main" -name "*.deb" | wc -l)
echo "   Знайдено пакетів: ${DEB_COUNT}"

# 3. Генерація індексів Packages та Packages.gz
echo -e "${CLR_YELLOW}2. Створення індексів Packages та Packages.gz...${CLR_RESET}"
cd "${TARGET_DIR}"
apt-ftparchive packages pool/main > dists/stable/main/binary-amd64/Packages
gzip -9c dists/stable/main/binary-amd64/Packages > dists/stable/main/binary-amd64/Packages.gz
cp dists/stable/main/binary-amd64/Packages dists/stable/main/binary-all/Packages
cp dists/stable/main/binary-amd64/Packages.gz dists/stable/main/binary-all/Packages.gz

# 4. Створення маніфесту Release
echo -e "${CLR_YELLOW}3. Створення маніфесту Release...${CLR_RESET}"
cd "${TARGET_DIR}/dists/stable"
apt-ftparchive \
  -o APT::FTPArchive::Release::Origin="LegalTech" \
  -o APT::FTPArchive::Release::Label="LegalTech APT Repository" \
  -o APT::FTPArchive::Release::Suite="stable" \
  -o APT::FTPArchive::Release::Codename="stable" \
  -o APT::FTPArchive::Release::Architectures="amd64 all" \
  -o APT::FTPArchive::Release::Components="main" \
  release . > Release

# 5. Підпис Release (якщо доступний GPG-ключ)
echo -e "${CLR_YELLOW}4. Підпис репозиторію GPG...${CLR_RESET}"
if [ -n "${GPG_PRIVATE_KEY:-}" ]; then
    echo "${GPG_PRIVATE_KEY}" | gpg --batch --import 2>/dev/null || true
fi

KEY_ID=$(gpg --with-colons --list-secret-keys 2>/dev/null | grep "^sec:" | cut -d: -f5 | head -n 1 || true)

if [ -n "${KEY_ID}" ]; then
    echo "   Використовується ключ: ${KEY_ID}"
    gpg --batch --yes --default-key "${KEY_ID}" -abs -o Release.gpg Release
    gpg --batch --yes --default-key "${KEY_ID}" --clearsign -o InRelease Release
    gpg --armor --export "${KEY_ID}" > "${TARGET_DIR}/public.gpg"
    cp "${TARGET_DIR}/public.gpg" "${TARGET_DIR}/KEY.gpg"
    echo -e "   ${CLR_GREEN}✅ Release.gpg та InRelease підписано успішно!${CLR_RESET}"
elif [ -f "${REPO_ROOT}/keys/public.gpg" ]; then
    echo "   Приватний ключ відсутній локально (безпечний режим). Копіюємо відкритий ключ..."
    cp "${REPO_ROOT}/keys/public.gpg" "${TARGET_DIR}/public.gpg"
    cp "${REPO_ROOT}/keys/public.gpg" "${TARGET_DIR}/KEY.gpg"
fi

# 6. Створення index.html та .nojekyll
echo -e "${CLR_YELLOW}5. Створення веб-сторінки репозиторію...${CLR_RESET}"
touch "${TARGET_DIR}/.nojekyll"

cat > "${TARGET_DIR}/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LegalTech — Official Debian & Ubuntu APT Repository</title>
  <style>
    :root {
      --bg: #0b1120;
      --card: #111827;
      --card-alt: #1e293b;
      --border: #334155;
      --accent: #38bdf8;
      --accent-gold: #f59e0b;
      --text: #f8fafc;
      --muted: #94a3b8;
      --code-bg: #070b14;
      --code-text: #a5f3fc;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
      background: radial-gradient(circle at top, #172554 0%, var(--bg) 55%);
      color: var(--text);
      margin: 0;
      padding: 2.5rem 1.25rem;
      display: flex;
      justify-content: center;
    }
    .container {
      background: var(--card);
      border-radius: 14px;
      padding: 2.5rem;
      max-width: 920px;
      width: 100%;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.6);
      border: 1px solid var(--border);
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .tag {
      display: inline-block;
      background: #0369a1;
      color: #fff;
      padding: 0.25rem 0.7rem;
      border-radius: 6px;
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .tag.gold {
      background: rgba(245, 158, 11, 0.16);
      color: #fcd34d;
      border: 1px solid rgba(245, 158, 11, 0.4);
    }
    h1 {
      color: var(--text);
      margin: 0 0 0.75rem 0;
      font-size: 2rem;
      letter-spacing: -0.02em;
    }
    h2 {
      color: var(--accent);
      font-size: 1.25rem;
      margin: 2rem 0 0.85rem 0;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.45rem;
    }
    p, li {
      line-height: 1.65;
      color: var(--muted);
      font-size: 0.97rem;
    }
    .pkg-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.25rem;
      margin-top: 1rem;
    }
    .pkg-card {
      background: var(--card-alt);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.4rem 1.5rem;
    }
    .pkg-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.6rem;
    }
    .pkg-title {
      font-size: 1.2rem;
      font-weight: 700;
      color: #fff;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .pkg-meta {
      font-size: 0.82rem;
      color: var(--accent);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .pkg-card ul {
      margin: 0.6rem 0 0.8rem 1.2rem;
      padding: 0;
    }
    .pkg-card li {
      margin-bottom: 0.35rem;
    }
    .pkg-links {
      font-size: 0.88rem;
      margin-top: 0.75rem;
      padding-top: 0.65rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    pre {
      background: var(--code-bg);
      padding: 1.15rem 1.25rem;
      border-radius: 8px;
      border: 1px solid #1e293b;
      overflow-x: auto;
      color: var(--code-text);
      font-size: 0.9rem;
      line-height: 1.55;
      margin: 0.75rem 0;
    }
    code.inline {
      background: rgba(15, 23, 42, 0.8);
      color: #e2e8f0;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-size: 0.86rem;
      border: 1px solid rgba(148, 163, 184, 0.2);
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer {
      margin-top: 2.25rem;
      border-top: 1px solid var(--border);
      padding-top: 1.1rem;
      font-size: 0.88rem;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badges">
      <span class="tag">Debian / Ubuntu Official APT Repository</span>
      <span class="tag gold">GPG Signed · SHA-512 · 100% Offline-First</span>
    </div>
    <h1>⚖️ LegalTech &amp; Sovereign Cryptography APT Repository</h1>
    <p>
      Official static Debian/Ubuntu APT repository for installing and automatically updating open-source
      <strong>LegalTech</strong>, <strong>Qualified Electronic Signature (QES / DSTU 4145-2002)</strong>, and
      <strong>Cryptographic Geometric Watermarking</strong> packages on Debian, Ubuntu, Linux Mint, and Pop!_OS.
      Designed with strict adherence to 100% offline-first execution, zero telemetry, and attorney-client privilege preservation.
    </p>

    <h2>📦 Available Packages &amp; Tool Descriptions</h2>
    <div class="pkg-grid">
      <div class="pkg-card">
        <div class="pkg-header">
          <span class="pkg-title">🔐 qes-tools</span>
          <span class="pkg-meta">v1.0.26 · Architecture: amd64 · Suite: stable/main</span>
        </div>
        <p style="margin: 0.3rem 0;">
          <strong>Ukrainian Qualified Electronic Signature (QES / КЕП) &amp; LegalTech Cryptographic Suite.</strong>
        </p>
        <ul>
          <li><strong>Cryptographic Standards:</strong> National Standard DSTU 4145-2002 (elliptic curves over GF(2<sup>m</sup>)), GOST 34.311-95, DSTU 7564:2014 (Kupyna), ETSI EN 319 142-1 (<strong>PAdES-B-LTA</strong> archival LTV for 25+ years with embedded ISO 32000-2 <code class="inline">/DSS</code> dictionary), ETSI EN 319 122-1 (<strong>CAdES-X-Long</strong>), ETSI EN 319 162-1 (<strong>ASiC-E</strong>), and IETF RFC 3161 TSP / OCSP via accredited Ukrainian QTSPs (CA Diia / KNEDP CZO).</li>
          <li><strong>Core Capabilities:</strong> Stamped &amp; unstamped PDF signing, official bilingual PDF Verification &amp; Certificate Trust Chain Protocol generator (<code class="inline">UA</code> / <code class="inline">EN</code> with QR verification), court-ready OCR &amp; PDF/A optimization (<code class="inline">ocrmypdf</code> + <code class="inline">qpdf</code>), GOST file encryption/decryption, hardware USB token support (<em>DepositSign</em>, <em>IIT Almaz-1K</em>, <em>Crystal-1K</em>, <em>Author SecureToken-337</em>), browser Native Messaging Host (<code class="inline">euscpnmh</code>), and local Web Sign Agent (<code class="inline">HTTP:8081</code> / <code class="inline">HTTPS:8083</code>).</li>
          <li><strong>CLI &amp; Desktop Integration:</strong> Provides <code class="inline">qes-tool</code>, <code class="inline">qes-sign</code>, <code class="inline">qes-verify</code>, <code class="inline">qes-cert</code>, <code class="inline">qes-ocr</code>, <code class="inline">qes-pdf-court</code>, <code class="inline">qes-encrypt</code>, <code class="inline">qes-decrypt</code>, <code class="inline">qes-agent</code>, <code class="inline">qes-config</code>, plus 18 GNOME Files (Nautilus) right-click actions across 5 HIG categories.</li>
        </ul>
        <div class="pkg-links">
          📖 <a href="https://github.com/YaroslavBaienko/legaltech/blob/main/packages/qes-tools/README.md">qes-tools Documentation</a> ·
          💻 <a href="https://github.com/YaroslavBaienko/legaltech/tree/main/packages/qes-tools">Source Code</a>
        </div>
      </div>

      <div class="pkg-card">
        <div class="pkg-header">
          <span class="pkg-title">🔱 marma-crypto-watermark</span>
          <span class="pkg-meta">v1.2.1-1 · Architecture: all · Suite: stable/main</span>
        </div>
        <p style="margin: 0.3rem 0;">
          <strong>Sri Yantra Cryptographic Geometric Watermarking &amp; Sovereign Document Sealing Suite.</strong>
        </p>
        <ul>
          <li><strong>Mathematical &amp; Cryptographic Specification:</strong> Implements the <em>Marma-Crypto Protocol</em> (<a href="https://doi.org/10.5281/zenodo.23436152">CERN Zenodo DOI: 10.5281/zenodo.23436152</a>), mapping a 512-bit cryptographic signature / payload digest into 24-bit block-quantized affine micro-coordinate perturbations (&delta;<sub>k</sub> &in; [&minus;10<sup>&minus;5</sup>, +10<sup>&minus;5</sup>]) across the 9 interlocked triangles and 54 triple intersections (<em>marma-sth&#257;na</em>) of the canonical Sri Yantra (&Delta;E &approx; 6.13 &times; 10<sup>&minus;11</sup> rad &lt; &varepsilon;<sub>float64</sub>).</li>
          <li><strong>Core Capabilities:</strong> Dual-layer visual &amp; structural watermarking for <strong>PDF</strong>, <strong>DOCX</strong>, and <strong>SVG</strong> documents (<code class="inline">--mode both | watermark | seal</code>), Golden Bindu cryptographic seal, zero-tolerance tamper detection across all 36 triangle coordinates, official Vector PDF Verification Protocol generator, deterministic DSTU 4145-2002 (RFC 6979 over GF(2<sup>257</sup>)) bridge, GTK4 / Libadwaita key-selection dialog (<code class="inline">~/.secure_keys/</code> &amp; USB tokens), and 15-minute RAM session cache.</li>
          <li><strong>CLI &amp; Desktop Integration:</strong> Provides <code class="inline">marma-watermark</code> (<code class="inline">sign</code>, <code class="inline">verify</code>, <code class="inline">protocol</code>, <code class="inline">keygen</code>, <code class="inline">selftest</code>), <code class="inline">marma-dialog</code>, <code class="inline">marma-config</code>, and GNOME Files (Nautilus) right-click scripts (<em>"🔱 Sri Yantra &middot; Marma-Crypto"</em> in EN/UA).</li>
        </ul>
        <div class="pkg-links">
          🛡️ <a href="https://yaroslavbaienko.github.io/marma-crypto-protocol/">Live Interactive Browser Verifier</a> ·
          📄 <a href="https://doi.org/10.5281/zenodo.23436152">CERN Zenodo Whitepaper (v1.2.1)</a> ·
          💻 <a href="https://github.com/YaroslavBaienko/marma-crypto-protocol">Upstream Repository</a>
        </div>
      </div>
    </div>

    <h2>🚀 Quick 1-Step Repository Setup &amp; Installation</h2>
    <p>Run the following commands in your terminal to add the GPG key, register the APT repository, and install both suites:</p>
    <pre><code># 1. Download and install the repository's public GPG key
curl -fsSL https://yaroslavbaienko.github.io/legaltech/public.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/legaltech.gpg

# 2. Add the LegalTech APT repository to system sources
echo "deb [signed-by=/etc/apt/keyrings/legaltech.gpg] https://yaroslavbaienko.github.io/legaltech stable main" | sudo tee /etc/apt/sources.list.d/legaltech.list

# 3. Update package indices and install both tools (or either package individually)
sudo apt update
sudo apt install qes-tools marma-crypto-watermark</code></pre>

    <h2>🔄 Automated System Upgrades</h2>
    <p>Once the repository is configured, all future releases are verified via GPG and installed automatically through standard Debian/Ubuntu system updates:</p>
    <pre><code>sudo apt update &amp;&amp; sudo apt upgrade</code></pre>

    <div class="footer">
      <span>
        Maintainer: <strong>Yaroslav Baienko</strong> ·
        <a href="https://github.com/YaroslavBaienko/legaltech">GitHub: YaroslavBaienko/legaltech</a>
      </span>
      <span>
        APT Endpoints:
        <a href="public.gpg">public.gpg</a> ·
        <a href="dists/stable/InRelease">InRelease</a> ·
        <a href="dists/stable/main/binary-amd64/Packages">Packages</a>
      </span>
    </div>
  </div>
</body>
</html>
EOF

echo -e "\n${CLR_BOLD}${CLR_GREEN}==============================================================================${CLR_RESET}"
echo -e "${CLR_BOLD}${CLR_GREEN} ✅ APT-репозиторій успішно сформовано в: ${TARGET_DIR}${CLR_RESET}"
echo -e "${CLR_BOLD}${CLR_GREEN}==============================================================================${CLR_RESET}\n"
