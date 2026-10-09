#!/usr/bin/env bash
# ==============================================================================
# 📜 Переглянути сертифікат КНЕДП / View CA Certificate Details
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/.i18n.sh" ]]; then
    source "${SCRIPT_DIR}/.i18n.sh"
elif [[ -f "${SCRIPT_DIR}/_i18n.sh" ]]; then
    source "${SCRIPT_DIR}/_i18n.sh"
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

if [[ ${#FILES[@]} -eq 0 ]]; then
    qes_warn_dialog \
        "Сертифікат КНЕДП" \
        "CA Certificate" \
        "Оберіть файл відкритого сертифіката (.cer, .crt, .der, .pem) або пакет (.p7b)." \
        "Select a public certificate file (.cer, .crt, .der, .pem) or bundle (.p7b)."
    exit 0
fi

# Знайти qes-cert у системних шляхах або локальній папці
QES_CERT="qes-cert"
if ! command -v qes-cert >/dev/null 2>&1; then
    if [[ -x "$HOME/.local/bin/qes-cert" ]]; then
        QES_CERT="$HOME/.local/bin/qes-cert"
    elif [[ -x "/usr/bin/qes-cert" ]]; then
        QES_CERT="/usr/bin/qes-cert"
    fi
fi

"$QES_CERT" --gui "${FILES[@]}"
