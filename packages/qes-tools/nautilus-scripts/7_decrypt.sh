#!/usr/bin/env bash
# ==============================================================================
# 🔓 Розшифрувати особистим КЕП
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
    zenity --warning --title="Розшифрування КЕП" --text="Оберіть зашифрований файл (.enc / .p7e) для розшифрування."
    exit 0
fi

if qes-decrypt --gui "${FILES[@]}"; then
    notify-send -a "QES Tools" -i changes-allow \
        "🔓 Розшифровано КЕП" \
        "Документи успішно розшифровано та відновлено в оригінальному вигляді."
else
    notify-send -a "QES Tools" -i dialog-error \
        "❌ Помилка розшифрування" \
        "Не вдалося розшифрувати файл. Перевірте правильність пароля або відповідність ключа."
fi
