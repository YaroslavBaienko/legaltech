#!/usr/bin/env bash
# ==============================================================================
# 👁️ Розпізнати текст OCR (Е-Суд / PDF)
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

TARGET_FILES=()
for f in "${FILES[@]}"; do
    if [[ -f "$f" ]]; then
        ext="${f##*.}"
        ext_lower="${ext,,}"
        case "$ext_lower" in
            pdf|png|jpg|jpeg|tif|tiff|bmp|webp)
                TARGET_FILES+=("$f")
                ;;
        esac
    fi
done

if [[ ${#TARGET_FILES[@]} -eq 0 ]]; then
    zenity --warning --title="OCR Розпізнавання (Е-Суд)" \
        --text="Будь ласка, виберіть хоча б один PDF-документ або скан-зображення (PNG/JPG/TIFF) для оптичного розпізнавання тексту."
    exit 0
fi

# Run qes-ocr with interactive GUI wizard
qes-ocr --gui "${TARGET_FILES[@]}"
