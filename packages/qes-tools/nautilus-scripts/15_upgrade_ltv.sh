#!/usr/bin/env bash
# ==============================================================================
# 🔏 Додати архівну мітку LTV (PAdES-LTA / 25 років) / Upgrade to Archival LTV (25 Years)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/.i18n.sh" ]]; then
    source "${SCRIPT_DIR}/.i18n.sh"
elif [[ -f "${SCRIPT_DIR}/_i18n.sh" ]]; then
    source "${SCRIPT_DIR}/_i18n.sh"
elif [[ -f "${SCRIPT_DIR}/../.i18n.sh" ]]; then
    source "${SCRIPT_DIR}/../.i18n.sh"
elif [[ -f "${SCRIPT_DIR}/../_i18n.sh" ]]; then
    source "${SCRIPT_DIR}/../_i18n.sh"
elif [[ -f "/usr/share/qes-tools/nautilus-scripts/_i18n.sh" ]]; then
    source "/usr/share/qes-tools/nautilus-scripts/_i18n.sh"
fi
QES_LANG="${QES_LANG:-uk}"

FILES=()
if [[ -n "${NAUTILUS_SCRIPT_SELECTED_FILE_PATHS:-}" ]]; then
    while IFS= read -r line; do
        [[ -n "$line" ]] && FILES+=("$line")
    done <<< "$NAUTILUS_SCRIPT_SELECTED_FILE_PATHS"
else
    FILES=("$@")
fi

VALID_FILES=()
for f in "${FILES[@]}"; do
    if [[ -f "$f" ]]; then
        case "${f,,}" in
            *.pdf|*.p7s|*.asice|*.asics)
                VALID_FILES+=("$f")
                ;;
        esac
    fi
done

if [[ ${#VALID_FILES[@]} -eq 0 ]]; then
    qes_warn_dialog \
        "Архівна модернізація LTV (25 років)" \
        "Archival LTV Upgrade (25 Years)" \
        "Будь ласка, виберіть підписаний файл (.pdf, .p7s або .asice) для додавання архівної мітки LTV (PAdES-LTA / CAdES-LTA)." \
        "Please select a signed file (.pdf, .p7s or .asice) to upgrade to archival LTV (PAdES-LTA / CAdES-LTA)."
    exit 0
fi

# Run keyless LTV archival upgrade
if qes-sign --upgrade-ltv --gui "${VALID_FILES[@]}"; then
    qes_notify "security-high" \
        "🔏 Архівну мітку LTV додано" \
        "🔏 Archival LTV Added" \
        "Успішно вбудовано ланцюжок сертифікатів КНЕДП та OCSP/DSS для ${#VALID_FILES[@]} документа(-ів) (чинність 25+ років)." \
        "Successfully embedded CA certificate chain and OCSP/DSS for ${#VALID_FILES[@]} document(s) (25+ years validity)."
else
    qes_notify "dialog-error" \
        "❌ Помилка модернізації LTV" \
        "❌ LTV Upgrade Error" \
        "Не вдалося додати архівну мітку LTV (перевірте наявність підпису у файлі)." \
        "Could not upgrade signature to archival LTV (verify that the file is digitally signed)."
fi
