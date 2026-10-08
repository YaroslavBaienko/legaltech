#!/usr/bin/env bash
# ==============================================================================
# 📨 Зашифрувати для адресата (.enc)
# ==============================================================================
set -euo pipefail

FILES=()
if [[ -n "${NAUTILUS_SCRIPT_SELECTED_FILE_PATHS:-}" ]]; then
    while IFS= read -r line; do
        [[ -n "$line" ]] && FILES+=("$line")
    done <<< "$NAUTILUS_SCRIPT_SELECTED_FILE_PATHS"
else
    FILES=("$@")
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
    zenity --warning --title="Шифрування для адресата" --text="Оберіть файл(и) або папку для спрямованого шифрування."
    exit 0
fi

# Select recipient certificate file
CERT_FILE=$(zenity --file-selection \
    --title="Оберіть відкритий сертифікат адресата (.cer / .crt)" \
    --file-filter="Сертифікати (*.cer *.crt) | *.cer *.crt" 2>/dev/null || true)

if [[ -z "$CERT_FILE" || ! -f "$CERT_FILE" ]]; then
    exit 0
fi

if qes-encrypt --gui -r "$CERT_FILE" "${FILES[@]}"; then
    notify-send -a "QES Tools" -i mail-send \
        "🎯 Зашифровано для адресата" \
        "Файли успішно зашифровано на відкритий ключ отримувача. Відкрити зможе лише власник цільового КЕП."
else
    notify-send -a "QES Tools" -i dialog-error \
        "❌ Помилка шифрування" \
        "Операцію шифрування скасовано або сталася помилка."
fi
