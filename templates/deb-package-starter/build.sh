#!/usr/bin/env bash
# ==============================================================================
# build.sh — Автоматизована збірка .deb пакета
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_ROOT="${SCRIPT_DIR}"

PKG_NAME="$(grep -E '^Package:' "${PKG_ROOT}/debian/control" | awk '{print $2}')"
PKG_VERSION="$(grep -E '^Version:' "${PKG_ROOT}/debian/control" | awk '{print $2}')"
if [ -z "$PKG_VERSION" ] && [ -f "${PKG_ROOT}/debian/changelog" ]; then
    PKG_VERSION="$(head -n1 "${PKG_ROOT}/debian/changelog" | grep -oP '\(\K[^\)]+' | cut -d'-' -f1)"
fi
PKG_ARCH="$(grep -E '^Architecture:' "${PKG_ROOT}/debian/control" | awk '{print $2}')"

if [ "$PKG_ARCH" = "all" ] || [ -z "$PKG_ARCH" ]; then
    PKG_ARCH="all"
elif [ "$PKG_ARCH" = "amd64" ] || [ "$PKG_ARCH" = "any" ]; then
    PKG_ARCH="amd64"
fi

DEB_FILENAME="${PKG_NAME}_${PKG_VERSION}_${PKG_ARCH}.deb"
BUILD_ROOT="${PKG_ROOT}/build/${PKG_NAME}_${PKG_VERSION}_${PKG_ARCH}"
DIST_DIR="${PKG_ROOT}/dist"

CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_GREEN="\033[32m"
CLR_CYAN="\033[36m"
CLR_YELLOW="\033[33m"
CLR_RED="\033[31m"

echo -e "${CLR_BOLD}${CLR_CYAN}==============================================================================${CLR_RESET}"
echo -e "${CLR_BOLD}${CLR_CYAN}       Збірка deb-пакета ${PKG_NAME} v${PKG_VERSION} (${PKG_ARCH})${CLR_RESET}"
echo -e "${CLR_BOLD}${CLR_CYAN}==============================================================================${CLR_RESET}"

# 1. Перевірка вимог
if ! command -v dpkg-deb >/dev/null 2>&1; then
    echo -e "${CLR_RED}Помилка: dpkg-deb не встановлено в системі.${CLR_RESET}" >&2
    exit 1
fi

# 2. Підготовка дерева каталогів
echo -e "\n${CLR_YELLOW}[1/5] Підготовка дерева каталогів...${CLR_RESET}"
rm -rf "${BUILD_ROOT}"
mkdir -p "${BUILD_ROOT}/DEBIAN"
mkdir -p "${BUILD_ROOT}/usr/bin"
mkdir -p "${BUILD_ROOT}/usr/lib/${PKG_NAME}"
mkdir -p "${BUILD_ROOT}/usr/share/doc/${PKG_NAME}"
mkdir -p "${DIST_DIR}"

# 3. Копіювання керуючих файлів
echo -e "${CLR_YELLOW}[2/5] Копіювання конфігурації debian/...${CLR_RESET}"
cp "${PKG_ROOT}/debian/control" "${BUILD_ROOT}/DEBIAN/control"
if [ -f "${PKG_ROOT}/debian/postinst" ]; then
    cp "${PKG_ROOT}/debian/postinst" "${BUILD_ROOT}/DEBIAN/postinst"
    chmod 0755 "${BUILD_ROOT}/DEBIAN/postinst"
fi
if [ -f "${PKG_ROOT}/debian/prerm" ]; then
    cp "${PKG_ROOT}/debian/prerm" "${BUILD_ROOT}/DEBIAN/prerm"
    chmod 0755 "${BUILD_ROOT}/DEBIAN/prerm"
fi

# 4. Копіювання коду та бінарників
echo -e "${CLR_YELLOW}[3/5] Копіювання файлів програми...${CLR_RESET}"
cp -r "${PKG_ROOT}/src/"* "${BUILD_ROOT}/usr/lib/${PKG_NAME}/"
chmod 0755 "${BUILD_ROOT}/usr/lib/${PKG_NAME}"/*.sh 2>/dev/null || true

# Створення/копіювання обгортки в /usr/bin
cat << EOF > "${BUILD_ROOT}/usr/bin/${PKG_NAME}"
#!/bin/sh
exec /usr/lib/${PKG_NAME}/main.sh "\$@"
EOF
chmod 0755 "${BUILD_ROOT}/usr/bin/${PKG_NAME}"

# Документація та копірайт
if [ -f "${PKG_ROOT}/debian/copyright" ]; then
    cp "${PKG_ROOT}/debian/copyright" "${BUILD_ROOT}/usr/share/doc/${PKG_NAME}/copyright"
fi
if [ -f "${PKG_ROOT}/debian/changelog" ]; then
    gzip -9n -c "${PKG_ROOT}/debian/changelog" > "${BUILD_ROOT}/usr/share/doc/${PKG_NAME}/changelog.Debian.gz"
fi

# 5. Нормалізація прав
echo -e "${CLR_YELLOW}[4/5] Нормалізація прав доступу...${CLR_RESET}"
find "${BUILD_ROOT}" -type d -exec chmod 0755 {} +

# 6. Збірка dpkg-deb
echo -e "${CLR_YELLOW}[5/5] Компресія та формування .deb пакета...${CLR_RESET}"
dpkg-deb --build --root-owner-group -Zxz "${BUILD_ROOT}" "${DIST_DIR}/${DEB_FILENAME}"

echo -e "\n${CLR_BOLD}${CLR_GREEN}==============================================================================${CLR_RESET}"
echo -e "${CLR_BOLD}${CLR_GREEN} ✅ ПАКЕТ УСПІШНО ЗІБРАНО!${CLR_RESET}"
echo -e "${CLR_BOLD}${CLR_GREEN}==============================================================================${CLR_RESET}"
ls -lh "${DIST_DIR}/${DEB_FILENAME}"

if command -v lintian >/dev/null 2>&1; then
    echo -e "\n${CLR_YELLOW}Перевірка лінтером Lintian...${CLR_RESET}"
    lintian --no-tag-display-limit "${DIST_DIR}/${DEB_FILENAME}" || true
fi

echo -e "\nВстановлення:"
echo -e "  sudo apt install ./${DIST_DIR}/${DEB_FILENAME}\n"
