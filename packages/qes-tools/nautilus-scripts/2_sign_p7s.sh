#!/usr/bin/env bash
# ==============================================================================
# ✍️ Підписати (Відокремлений підпис .p7s)
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

VALID_FILES=()
for f in "${FILES[@]}"; do
    if [[ -f "$f" ]]; then
        VALID_FILES+=("$f")
    fi
done

if [[ ${#VALID_FILES[@]} -eq 0 ]]; then
    zenity --warning --title="КЕП Підписання (.p7s)" --text="Оберіть хоча б один файл для створення відокремленого підпису."
    exit 0
fi

if qes-sign --gui "${VALID_FILES[@]}"; then
    notify-send -a "QES Tools" -i document-edit \
        "✅ Підписано КЕП (.p7s)" \
        "Створено відокремлені файли підпису для ${#VALID_FILES[@]} файл(ів)."
else
    notify-send -a "QES Tools" -i dialog-error \
        "❌ Помилка підписання" \
        "Операцію підписання перервано або скасовано."
fi
