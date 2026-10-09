#!/usr/bin/env bash
# ==============================================================================
# build.sh — Автоматизована збірка .deb пакета qes-tools для Debian / Ubuntu
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_ROOT="${SCRIPT_DIR}"

PKG_NAME="qes-tools"
PKG_VERSION="1.0.4"
PKG_ARCH="amd64"
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
    echo -e "${CLR_RED}Помилка: dpkg-deb не знайдено в системі.${CLR_RESET}" >&2
    exit 1
fi

# 2. Очищення та створення дерева каталогів
echo -e "\n${CLR_YELLOW}[1/6] Підготовка дерева каталогів пакету...${CLR_RESET}"
rm -rf "${BUILD_ROOT}"
mkdir -p "${BUILD_ROOT}/DEBIAN"
mkdir -p "${BUILD_ROOT}/usr/bin"
mkdir -p "${BUILD_ROOT}/usr/lib/qes-tools/bin"
mkdir -p "${BUILD_ROOT}/usr/lib/qes-tools/src"
mkdir -p "${BUILD_ROOT}/usr/lib/qes-tools/certs"
mkdir -p "${BUILD_ROOT}/usr/share/doc/qes-tools"
mkdir -p "${BUILD_ROOT}/usr/share/nautilus-scripts/🔐 КЕП та Безпека"
mkdir -p "${DIST_DIR}"

# 3. Копіювання керуючих файлів DEBIAN
echo -e "${CLR_YELLOW}[2/6] Копіювання керуючих файлів DEBIAN (control, postinst, prerm)...${CLR_RESET}"
cp "${PKG_ROOT}/debian/control" "${BUILD_ROOT}/DEBIAN/control"
cp "${PKG_ROOT}/debian/postinst" "${BUILD_ROOT}/DEBIAN/postinst"
cp "${PKG_ROOT}/debian/prerm" "${BUILD_ROOT}/DEBIAN/prerm"
if [ -f "${PKG_ROOT}/debian/postrm" ]; then
    cp "${PKG_ROOT}/debian/postrm" "${BUILD_ROOT}/DEBIAN/postrm"
    chmod 0755 "${BUILD_ROOT}/DEBIAN/postrm"
fi
chmod 0755 "${BUILD_ROOT}/DEBIAN/postinst"
chmod 0755 "${BUILD_ROOT}/DEBIAN/prerm"

# 4. Копіювання вихідного коду та залежностей
echo -e "${CLR_YELLOW}[3/6] Копіювання вихідного коду, модулів та сертифікатів...${CLR_RESET}"
cp -r "${PKG_ROOT}/src/"* "${BUILD_ROOT}/usr/lib/qes-tools/src/"
cp -r "${PKG_ROOT}/certs/"* "${BUILD_ROOT}/usr/lib/qes-tools/certs/"
cp "${PKG_ROOT}/package.json" "${BUILD_ROOT}/usr/lib/qes-tools/"
if [ -f "${PKG_ROOT}/package-lock.json" ]; then
    cp "${PKG_ROOT}/package-lock.json" "${BUILD_ROOT}/usr/lib/qes-tools/"
fi

# Встановлення production-залежностей node_modules для ізольованого запуску
if [ -d "${PKG_ROOT}/node_modules" ]; then
    cp -r "${PKG_ROOT}/node_modules" "${BUILD_ROOT}/usr/lib/qes-tools/"
else
    echo -e "  • Встановлення чистих npm залежностей..."
    (cd "${BUILD_ROOT}/usr/lib/qes-tools" && npm install --omit=dev --no-audit --no-fund)
fi

# Копіювання бінарників (виключаючи __pycache__)
find "${PKG_ROOT}/bin" -maxdepth 1 -type f -exec cp {} "${BUILD_ROOT}/usr/lib/qes-tools/bin/" \;

# Включення бінарника typst для гарантованого відтворення векторного штампа
TYPST_BIN="$(command -v typst || true)"
if [ -z "$TYPST_BIN" ] && [ -f "$HOME/.local/bin/typst" ]; then
    TYPST_BIN="$HOME/.local/bin/typst"
fi

if [ -n "$TYPST_BIN" ] && [ -f "$TYPST_BIN" ]; then
    echo -e "  • Додавання вбудованого Typst бінарника для гарантії векторного штампа ($TYPST_BIN)..."
    cp "$TYPST_BIN" "${BUILD_ROOT}/usr/lib/qes-tools/bin/typst"
    chmod 0755 "${BUILD_ROOT}/usr/lib/qes-tools/bin/typst"
elif command -v curl >/dev/null 2>&1 && command -v tar >/dev/null 2>&1; then
    echo -e "  • Завантаження статичного бінарника Typst..."
    TMP_TYPST_DIR=$(mktemp -d)
    if curl -sSL "https://github.com/typst/typst/releases/download/v0.12.0/typst-x86_64-unknown-linux-musl.tar.xz" | tar -xJ -C "$TMP_TYPST_DIR" 2>/dev/null; then
        cp "$TMP_TYPST_DIR"/typst-*/typst "${BUILD_ROOT}/usr/lib/qes-tools/bin/typst"
        chmod 0755 "${BUILD_ROOT}/usr/lib/qes-tools/bin/typst"
        echo -e "    ✅ Typst завантажено та упаковано успішно."
    fi
    rm -rf "$TMP_TYPST_DIR"
fi

# 5. Створення глобальних системних обгорток у /usr/bin
echo -e "${CLR_YELLOW}[4/6] Створення системних обгорток у /usr/bin...${CLR_RESET}"
cat << 'EOF' > "${BUILD_ROOT}/usr/bin/qes-sign"
#!/bin/sh
exec /usr/bin/node /usr/lib/qes-tools/bin/qes-sign.js "$@"
EOF

cat << 'EOF' > "${BUILD_ROOT}/usr/bin/qes-verify"
#!/bin/sh
exec /usr/bin/python3 /usr/lib/qes-tools/bin/qes-verify "$@"
EOF

cat << 'EOF' > "${BUILD_ROOT}/usr/bin/qes-cert"
#!/bin/sh
exec /usr/bin/python3 /usr/lib/qes-tools/bin/qes-cert "$@"
EOF

cat << 'EOF' > "${BUILD_ROOT}/usr/bin/qes-encrypt"
#!/bin/sh
exec /usr/bin/node /usr/lib/qes-tools/bin/qes-encrypt.js "$@"
EOF

cat << 'EOF' > "${BUILD_ROOT}/usr/bin/qes-decrypt"
#!/bin/sh
exec /usr/bin/node /usr/lib/qes-tools/bin/qes-decrypt.js "$@"
EOF

cat << 'EOF' > "${BUILD_ROOT}/usr/bin/qes-export-cert"
#!/bin/sh
exec /usr/bin/node /usr/lib/qes-tools/bin/qes-export-cert.js "$@"
EOF

cat << 'EOF' > "${BUILD_ROOT}/usr/bin/qes-agent"
#!/bin/sh
exec /usr/bin/node /usr/lib/qes-tools/bin/qes-agent.js "$@"
EOF

cat << 'EOF' > "${BUILD_ROOT}/usr/bin/qes-pdf-court"
#!/bin/sh
exec /usr/lib/qes-tools/bin/qes-pdf-court "$@"
EOF

cat << 'EOF' > "${BUILD_ROOT}/usr/bin/qes-ocr"
#!/bin/sh
exec /usr/lib/qes-tools/bin/qes-ocr "$@"
EOF

cat << 'EOF' > "${BUILD_ROOT}/usr/bin/qes-config"
#!/bin/sh
exec /usr/lib/qes-tools/bin/qes-config "$@"
EOF

cat << 'EOF' > "${BUILD_ROOT}/usr/bin/qes-tool"
#!/bin/sh
exec /usr/lib/qes-tools/bin/qes-tool "$@"
EOF

cat << 'EOF' > "${BUILD_ROOT}/usr/bin/qes-tools"
#!/bin/sh
exec /usr/lib/qes-tools/bin/qes-tool "$@"
EOF


chmod 0755 "${BUILD_ROOT}/usr/bin/"*
chmod 0755 "${BUILD_ROOT}/usr/lib/qes-tools/bin/"*

# 6. Копіювання скриптів Nautilus
echo -e "${CLR_YELLOW}[5/6] Копіювання скриптів меню Nautilus...${CLR_RESET}"
CANONICAL_SCRIPTS="${BUILD_ROOT}/usr/share/qes-tools/nautilus-scripts"
mkdir -p "$CANONICAL_SCRIPTS"
cp "${PKG_ROOT}/nautilus-scripts/"* "$CANONICAL_SCRIPTS/"
chmod 0755 "$CANONICAL_SCRIPTS/"*

NAUTILUS_TARGET="${BUILD_ROOT}/usr/share/nautilus-scripts/🔐 КЕП та Безпека"
mkdir -p "$NAUTILUS_TARGET"
cp "${PKG_ROOT}/nautilus-scripts/0_help.sh" "$NAUTILUS_TARGET/📖 Довідка та Інструкції КЕП"
cp "${PKG_ROOT}/nautilus-scripts/1_sign_pades.sh" "$NAUTILUS_TARGET/✍️ Підписати (PAdES PDF зі штампом та QR)"
cp "${PKG_ROOT}/nautilus-scripts/1b_sign_pades_no_stamp.sh" "$NAUTILUS_TARGET/✍️ Підписати (PAdES PDF без штампу та QR)"
cp "${PKG_ROOT}/nautilus-scripts/2_sign_p7s.sh" "$NAUTILUS_TARGET/✍️ Підписати (Відокремлений підпис .p7s)"
cp "${PKG_ROOT}/nautilus-scripts/3_sign_asice.sh" "$NAUTILUS_TARGET/📦 Підписати (Пакетний контейнер ASiC-E)"
cp "${PKG_ROOT}/nautilus-scripts/4_verify.sh" "$NAUTILUS_TARGET/🔍 Перевірити підпис КЕП"
cp "${PKG_ROOT}/nautilus-scripts/5_encrypt_self.sh" "$NAUTILUS_TARGET/🛡️ Зашифрувати в особистий сейф (.enc)"
cp "${PKG_ROOT}/nautilus-scripts/6_encrypt_recipient.sh" "$NAUTILUS_TARGET/📨 Зашифрувати для адресата (.enc)"
cp "${PKG_ROOT}/nautilus-scripts/7_decrypt.sh" "$NAUTILUS_TARGET/🔓 Розшифрувати особистим КЕП"
cp "${PKG_ROOT}/nautilus-scripts/8_export_cert.sh" "$NAUTILUS_TARGET/📤 Експортувати мій відкритий сертифікат (.cer)"
cp "${PKG_ROOT}/nautilus-scripts/9_pdf_court.sh" "$NAUTILUS_TARGET/⚖️ Оптимізувати PDF для Е-Суду"
cp "${PKG_ROOT}/nautilus-scripts/10_append_signature.sh" "$NAUTILUS_TARGET/✍️ Додати другий підпис (Мультипідпис)"
cp "${PKG_ROOT}/nautilus-scripts/11_lock_session.sh" "$NAUTILUS_TARGET/🔒 Скинути кеш пароля (Заблокувати)"
cp "${PKG_ROOT}/nautilus-scripts/12_ocr_court.sh" "$NAUTILUS_TARGET/👁️ Розпізнати текст OCR (Е-Суд)"
cp "${PKG_ROOT}/nautilus-scripts/13_view_cert.sh" "$NAUTILUS_TARGET/📜 Переглянути сертифікат КНЕДП"
cp "${PKG_ROOT}/nautilus-scripts/14_ocr_english.sh" "$NAUTILUS_TARGET/👁️ Розпізнати текст OCR (🇬🇧 Чиста Англійська)"
cp "${PKG_ROOT}/nautilus-scripts/_i18n.sh" "$NAUTILUS_TARGET/.i18n.sh"
chmod 0755 "$NAUTILUS_TARGET/"*
chmod 0755 "$NAUTILUS_TARGET/.i18n.sh"

# Авторські права / документація
cat << 'EOF' > "${BUILD_ROOT}/usr/share/doc/qes-tools/copyright"
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: qes-tools
Source: https://github.com/YaroslavBaienko/legaltech

Files: *
Copyright: 2026 Yaroslav Baienko <zerhug@gmail.com>
License: Apache-2.0
EOF

# Нормалізація прав доступу
find "${BUILD_ROOT}" -type d -exec chmod 0755 {} +
find "${BUILD_ROOT}/usr/lib/qes-tools" -type f ! -path "*/bin/*" -exec chmod 0644 {} +

# 7. Збірка dpkg-deb
echo -e "${CLR_YELLOW}[6/6] Компресія та збірка deb-пакета через dpkg-deb...${CLR_RESET}"
dpkg-deb --build --root-owner-group -Zxz "${BUILD_ROOT}" "${DIST_DIR}/${DEB_FILENAME}"

echo -e "\n${CLR_BOLD}${CLR_GREEN}==============================================================================${CLR_RESET}"
echo -e "${CLR_BOLD}${CLR_GREEN} ✅ ПАКЕТ УСПІШНО ЗІБРАНО!${CLR_RESET}"
echo -e "${CLR_BOLD}${CLR_GREEN}==============================================================================${CLR_RESET}"
ls -lh "${DIST_DIR}/${DEB_FILENAME}"

if command -v lintian >/dev/null 2>&1; then
    echo -e "\n${CLR_YELLOW}Перевірка лінтером Lintian...${CLR_RESET}"
    lintian --no-tag-display-limit "${DIST_DIR}/${DEB_FILENAME}" || true
fi

echo -e "\nКоманда встановлення:"
echo -e "  ${CLR_BOLD}sudo apt install ./${DIST_DIR}/${DEB_FILENAME}${CLR_RESET}\n"
