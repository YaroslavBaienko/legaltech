#!/usr/bin/env bash
# ==============================================================================
# ✍️ Підписати (PAdES PDF без штампу та QR)
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
    if command -v zenity >/dev/null 2>&1; then
        CHOSEN=$(zenity --file-selection --multiple --separator="|" --title="Оберіть PDF-документи для підписання без штампа" --file-filter="PDF документи (*.pdf) | *.pdf *.PDF" 2>/dev/null || true)
        if [[ -n "$CHOSEN" ]]; then
            IFS="|" read -ra PDF_FILES <<< "$CHOSEN"
        else
            exit 0
        fi
    else
        exit 0
    fi
fi

# Run signing with GUI password dialog and --no-stamp
if qes-sign --pades --no-stamp --gui "${PDF_FILES[@]}"; then
    if command -v notify-send >/dev/null 2>&1; then
        notify-send -a "QES Tools" -i document-edit \
            "✅ Підписано КЕП (PAdES без штампа)" \
            "Успішно підписано ${#PDF_FILES[@]} PDF-документ(ів) (чистий вшитий цифровий підпис без візуального штампа)."
    fi
else
    if command -v notify-send >/dev/null 2>&1; then
        notify-send -a "QES Tools" -i dialog-error \
            "❌ Помилка підписання" \
            "Підписання документа скасовано або виникла помилка."
    fi
fi
