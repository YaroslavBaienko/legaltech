#!/usr/bin/env bash
# ==============================================================================
# 🛡️ Зашифрувати в особистий сейф (.enc) / Encrypt to Personal Vault (.enc)
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
        "Особистий сейф (ДСТУ 4145 / ГОСТ 28147)" \
        "Personal Vault (DSTU 4145 / GOST 28147)" \
        "Оберіть файл(и) або папку для поміщення в особистий криптосейф." \
        "Select file(s) or folder to place into your personal crypto vault."
    exit 0
fi

if qes-encrypt --gui "${FILES[@]}"; then
    qes_notify "security-high" \
        "🔐 Зашифровано в особистий сейф" \
        "🔐 Encrypted to Personal Vault" \
        "Успішно зашифровано ${#FILES[@]} об'єкт(ів). Доступ дозволено лише за вашим ключем КЕП." \
        "Successfully encrypted ${#FILES[@]} item(s). Access is restricted to your personal QES key only."
else
    qes_notify "dialog-error" \
        "❌ Помилка шифрування" \
        "❌ Encryption Error" \
        "Операцію шифрування скасовано або сталася помилка." \
        "Encryption operation was cancelled or an error occurred."
fi
