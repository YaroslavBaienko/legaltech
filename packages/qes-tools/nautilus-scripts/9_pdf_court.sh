#!/usr/bin/env bash
# ==============================================================================
# ⚖️ Оптимізувати PDF для Е-Суду
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

PDF_FILES=()
for f in "${FILES[@]}"; do
    if [[ -f "$f" && "${f,,}" == *.pdf ]]; then
        PDF_FILES+=("$f")
    fi
done

if [[ ${#PDF_FILES[@]} -eq 0 ]]; then
    zenity --warning --title="Оптимізація для Е-Суду" --text="Оберіть хоча б один PDF-файл для оптимізації."
    exit 0
fi

qes-pdf-court --gui "${PDF_FILES[@]}"
