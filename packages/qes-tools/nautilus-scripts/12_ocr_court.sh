#!/usr/bin/env bash
# ==============================================================================
# 👁️ Розпізнати текст OCR (Е-Суд) / OCR Text Recognition (Court PDF)
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
    qes_warn_dialog \
        "OCR Розпізнавання (Е-Суд)" \
        "OCR Text Recognition (Court PDF)" \
        "Будь ласка, виберіть хоча б один PDF-документ або скан-зображення (PNG/JPG/TIFF) для оптичного розпізнавання тексту." \
        "Please select at least one PDF document or scanned image (PNG/JPG/TIFF) for OCR text recognition."
    exit 0
fi

# Run qes-ocr with interactive GUI wizard
qes-ocr --gui "${TARGET_FILES[@]}"
