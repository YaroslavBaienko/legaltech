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

# 4. Створення маніфесту Release
echo -e "${CLR_YELLOW}3. Створення маніфесту Release...${CLR_RESET}"
cd "${TARGET_DIR}/dists/stable"
apt-ftparchive \
  -o APT::FTPArchive::Release::Origin="LegalTech" \
  -o APT::FTPArchive::Release::Label="LegalTech APT Repository" \
  -o APT::FTPArchive::Release::Suite="stable" \
  -o APT::FTPArchive::Release::Codename="stable" \
  -o APT::FTPArchive::Release::Architectures="amd64" \
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
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LegalTech Debian/Ubuntu APT Repository</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; display: flex; justify-content: center; }
    .card { background: #1e293b; border-radius: 12px; padding: 2.5rem; max-width: 760px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
    h1 { color: #38bdf8; margin-top: 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.8rem; }
    p { line-height: 1.6; color: #94a3b8; }
    pre { background: #090d16; padding: 1.2rem; border-radius: 8px; border: 1px solid #1e293b; overflow-x: auto; color: #a5f3fc; font-size: 0.95rem; line-height: 1.5; }
    .tag { display: inline-block; background: #0369a1; color: white; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-bottom: 1rem; }
    a { color: #38bdf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <span class="tag">DEBIAN / UBUNTU OFFICIAL APT REPOSITORY</span>
    <h1>⚖️ LegalTech APT Repository</h1>
    <p>Офіційний статичний APT-репозиторій для встановлення та автоматичного оновлення пакетів юридичних інструментів (LegalTech Suite, QES Tools) в операційних системах Debian, Ubuntu та Linux Mint.</p>

    <h3>🚀 Швидке встановлення в 1 крок:</h3>
    <pre><code># 1. Завантажити публічний GPG-ключ репозиторію
curl -fsSL https://yaroslavbaienko.github.io/legaltech/public.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/legaltech.gpg

# 2. Додати репозиторій у системні джерела APT
echo "deb [signed-by=/etc/apt/keyrings/legaltech.gpg] https://yaroslavbaienko.github.io/legaltech stable main" | sudo tee /etc/apt/sources.list.d/legaltech.list

# 3. Оновити індекси та встановити qes-tools
sudo apt update
sudo apt install qes-tools</code></pre>

    <h3>🔄 Автоматичні оновлення:</h3>
    <p>Після підключення репозиторію всі нові версії будуть встановлюватися стандартною командою системи:</p>
    <pre><code>sudo apt update && sudo apt upgrade</code></pre>

    <p style="margin-top: 2rem; border-top: 1px solid #334155; padding-top: 1rem; font-size: 0.9rem;">
      Вихідний код та документація: <a href="https://github.com/YaroslavBaienko/legaltech">GitHub: YaroslavBaienko/legaltech</a>
    </p>
  </div>
</body>
</html>
EOF

echo -e "\n${CLR_BOLD}${CLR_GREEN}==============================================================================${CLR_RESET}"
echo -e "${CLR_BOLD}${CLR_GREEN} ✅ APT-репозиторій успішно сформовано в: ${TARGET_DIR}${CLR_RESET}"
echo -e "${CLR_BOLD}${CLR_GREEN}==============================================================================${CLR_RESET}\n"
