#!/usr/bin/env bash
# ==============================================================================
# ✍️ Підписати (PAdES PDF зі штампом та QR)
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

PDF_FILES=()
for f in "${FILES[@]}"; do
    if [[ -f "$f" && "${f,,}" == *.pdf ]]; then
        PDF_FILES+=("$f")
    fi
done

if [[ ${#PDF_FILES[@]} -eq 0 ]]; then
    zenity --warning --title="КЕП Підписання (PAdES)" --text="Будь ласка, виберіть хоча б один PDF-файл для підписання зі штампом."
    exit 0
fi

# Run signing with GUI password dialog
if qes-sign --pades --gui "${PDF_FILES[@]}"; then
    notify-send -a "QES Tools" -i document-edit \
        "✅ Підписано КЕП (PAdES)" \
        "Успішно підписано ${#PDF_FILES[@]} PDF-документ(ів) з офіційним штампом та QR-кодом."
else
    notify-send -a "QES Tools" -i dialog-error \
        "❌ Помилка підписання" \
        "Підписання документа скасовано або виникла помилка."
fi
