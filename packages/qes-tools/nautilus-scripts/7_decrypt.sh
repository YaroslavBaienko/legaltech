#!/usr/bin/env bash
# ==============================================================================
# 🔓 Розшифрувати особистим КЕП / Decrypt with Personal Key
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
        "Розшифрування КЕП" \
        "QES Decryption" \
        "Оберіть зашифрований файл (.enc / .p7e) для розшифрування." \
        "Select encrypted file (.enc / .p7e) to decrypt."
    exit 0
fi

if qes-decrypt --gui "${FILES[@]}"; then
    qes_notify "changes-allow" \
        "🔓 Розшифровано КЕП" \
        "🔓 Decrypted with QES" \
        "Документи успішно розшифровано та відновлено в оригінальному вигляді." \
        "Documents successfully decrypted and restored to original form."
else
    qes_notify "dialog-error" \
        "❌ Помилка розшифрування" \
        "❌ Decryption Error" \
        "Не вдалося розшифрувати файл. Перевірте правильність пароля або відповідність ключа." \
        "Failed to decrypt file. Check your password or verify the key matches."
fi
