#!/usr/bin/env bash
# ==============================================================================
# 📨 Зашифрувати для адресата (.enc) / Encrypt for Recipient (.enc)
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
        "Шифрування для адресата" \
        "Encrypt for Recipient" \
        "Оберіть файл(и) або папку для спрямованого шифрування." \
        "Select file(s) or folder for targeted encryption."
    exit 0
fi

dlg_title="$(qes_text "Оберіть відкритий сертифікат адресата (.cer / .crt)" "Select recipient's public certificate (.cer / .crt)")"
dlg_filter="$(qes_text "Сертифікати (*.cer *.crt) | *.cer *.crt" "Certificates (*.cer *.crt) | *.cer *.crt")"
CERT_FILE=$(zenity --file-selection \
    --title="$dlg_title" \
    --file-filter="$dlg_filter" 2>/dev/null || true)

if [[ -z "$CERT_FILE" || ! -f "$CERT_FILE" ]]; then
    exit 0
fi

if qes-encrypt --gui -r "$CERT_FILE" "${FILES[@]}"; then
    qes_notify "mail-send" \
        "🎯 Зашифровано для адресата" \
        "🎯 Encrypted for Recipient" \
        "Файли успішно зашифровано на відкритий ключ отримувача. Відкрити зможе лише власник цільового КЕП." \
        "Files successfully encrypted with recipient's public key. Only the intended recipient can decrypt."
else
    qes_notify "dialog-error" \
        "❌ Помилка шифрування" \
        "❌ Encryption Error" \
        "Операцію шифрування скасовано або сталася помилка." \
        "Encryption operation was cancelled or an error occurred."
fi
