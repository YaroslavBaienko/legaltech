#!/usr/bin/env bash
# ==============================================================================
# new-deb-package.sh — Генератор нового deb-пакета на базі шаблону starter
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATE_DIR="${REPO_ROOT}/templates/deb-package-starter"

CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_GREEN="\033[32m"
CLR_CYAN="\033[36m"
CLR_YELLOW="\033[33m"
CLR_RED="\033[31m"

echo -e "${CLR_BOLD}${CLR_CYAN}==============================================================================${CLR_RESET}"
echo -e "${CLR_BOLD}${CLR_CYAN}         Генератор нового Debian-пакета (Debian Packaging Starter)           ${CLR_RESET}"
echo -e "${CLR_BOLD}${CLR_CYAN}==============================================================================${CLR_RESET}"

PKG_NAME="${1:-}"
PKG_DESC_SHORT="${2:-}"

if [ -z "$PKG_NAME" ]; then
    read -rp "Введіть назву пакета (наприклад: court-calc або my-tool): " PKG_NAME
fi

# Валідація назви пакета за стандартом Debian Policy
if ! [[ "$PKG_NAME" =~ ^[a-z0-9][a-z0-9+.-]+$ ]]; then
    echo -e "${CLR_RED}Помилка: назва пакета '$PKG_NAME' не відповідає правилам Debian!${CLR_RESET}" >&2
    echo "Дозволено лише малі літери, цифри, дефіс, крапку та плюс. Повинно починатися з літери або цифри." >&2
    exit 1
fi

TARGET_DIR="${REPO_ROOT}/packages/${PKG_NAME}"
if [ -d "$TARGET_DIR" ]; then
    echo -e "${CLR_RED}Помилка: каталог ${TARGET_DIR} вже існує!${CLR_RESET}" >&2
    exit 1
fi

if [ -z "$PKG_DESC_SHORT" ]; then
    read -rp "Короткий опис пакета (один рядок): " PKG_DESC_SHORT
fi
if [ -z "$PKG_DESC_SHORT" ]; then
    PKG_DESC_SHORT="Корисний інструмент ${PKG_NAME} для Debian"
fi

PKG_VERSION="${3:-1.0.0}"
PKG_ARCH="${4:-all}"
MAINTAINER_NAME="${MAINTAINER_NAME:-Yaroslav Baienko}"
MAINTAINER_EMAIL="${MAINTAINER_EMAIL:-zerhug@gmail.com}"
HOMEPAGE="${HOMEPAGE:-https://github.com/YaroslavBaienko/legaltech}"
PKG_DESC_LONG="${PKG_NAME} — надійний та автономний інструмент для автоматизації."

echo -e "\n${CLR_YELLOW}Створення структури пакета в: ${TARGET_DIR}...${CLR_RESET}"
cp -r "$TEMPLATE_DIR" "$TARGET_DIR"

# Перейменування лаунчера в bin/
if [ -f "$TARGET_DIR/bin/starter-tool" ]; then
    mv "$TARGET_DIR/bin/starter-tool" "$TARGET_DIR/bin/${PKG_NAME}"
fi

# Заміна змінних у файлах
echo -e "${CLR_YELLOW}Генерація конфігурацій (control, changelog, copyright, src)...${CLR_RESET}"
replace_vars() {
    local file="$1"
    if [ -f "$file" ]; then
        sed -i \
            -e "s|{{PACKAGE_NAME}}|${PKG_NAME}|g" \
            -e "s|{{VERSION}}|${PKG_VERSION}|g" \
            -e "s|{{ARCH}}|${PKG_ARCH}|g" \
            -e "s|{{MAINTAINER_NAME}}|${MAINTAINER_NAME}|g" \
            -e "s|{{MAINTAINER_EMAIL}}|${MAINTAINER_EMAIL}|g" \
            -e "s|{{HOMEPAGE}}|${HOMEPAGE}|g" \
            -e "s|{{DESCRIPTION_SHORT}}|${PKG_DESC_SHORT}|g" \
            -e "s|{{DESCRIPTION_LONG}}|${PKG_DESC_LONG}|g" \
            "$file"
    fi
}

replace_vars "$TARGET_DIR/debian/control"
replace_vars "$TARGET_DIR/debian/copyright"
replace_vars "$TARGET_DIR/debian/changelog"
replace_vars "$TARGET_DIR/debian/postinst"
replace_vars "$TARGET_DIR/debian/prerm"
replace_vars "$TARGET_DIR/src/main.sh"
replace_vars "$TARGET_DIR/bin/${PKG_NAME}"
replace_vars "$TARGET_DIR/README.md"

# Встановлення прав
chmod +x "$TARGET_DIR/build.sh" \
         "$TARGET_DIR/src/main.sh" \
         "$TARGET_DIR/bin/${PKG_NAME}" \
         "$TARGET_DIR/tests/test_basic.sh" \
         "$TARGET_DIR/debian/postinst" \
         "$TARGET_DIR/debian/prerm" \
         "$TARGET_DIR/debian/rules" 2>/dev/null || true

echo -e "\n${CLR_BOLD}${CLR_GREEN}==============================================================================${CLR_RESET}"
echo -e "${CLR_BOLD}${CLR_GREEN}  🎉 ПАКЕТ '${PKG_NAME}' УСПІШНО СТВОРЕНО!${CLR_RESET}"
echo -e "${CLR_BOLD}${CLR_GREEN}==============================================================================${CLR_RESET}"
echo -e "Розташування: ${TARGET_DIR}\n"
echo -e "Швидкі команди для початку роботи:"
echo -e "  1. Перейти в каталог:    ${CLR_BOLD}cd packages/${PKG_NAME}${CLR_RESET}"
echo -e "  2. Запустити тести:      ${CLR_BOLD}make test${CLR_RESET}"
echo -e "  3. Зібрати .deb пакет:   ${CLR_BOLD}make build${CLR_RESET}"
echo -e "  4. Перевірити збірку:    ${CLR_BOLD}dpkg-deb -c dist/${PKG_NAME}_${PKG_VERSION}_${PKG_ARCH}.deb${CLR_RESET}\n"
