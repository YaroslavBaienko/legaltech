#!/usr/bin/env bash
# ==============================================================================
# ✍️ Додати другий підпис до існуючого (Мультипідпис)
# ==============================================================================
set -euo pipefail

# Read files from Nautilus environment or arguments
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
    zenity --warning --title="Мультипідписання КЕП" --text="Будь ласка, виберіть хоча б один файл (.pdf, .asice або .p7s) для додавання другого підпису."
    exit 0
fi

# Run signing with GUI password dialog and --append flag
if qes-sign --append --gui "${VALID_FILES[@]}"; then
    notify-send -a "QES Tools" -i document-edit \
        "✅ Мультипідпис накладено" \
        "Успішно додано новий підпис до ${#VALID_FILES[@]} документа(-ів) зі збереженням чинності попередніх підписів."
else
    notify-send -a "QES Tools" -i dialog-error \
        "❌ Помилка мультипідписання" \
        "Підписання документа скасовано або виникла помилка."
fi
