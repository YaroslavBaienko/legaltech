#!/usr/bin/env bash
# ==============================================================================
# 👁️ Розпізнати текст OCR (🇬🇧 Чиста Англійська) / OCR Text Recognition (🇬🇧 English)
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
        "OCR Розпізнавання (🇬🇧 English)" \
        "OCR Recognition (🇬🇧 English)" \
        "Будь ласка, виберіть хоча б один PDF-документ або скан-зображення (PNG/JPG/TIFF) для розпізнавання тексту англійською мовою." \
        "Please select at least one PDF document or scanned image (PNG/JPG/TIFF) for English text recognition."
    exit 0
fi

# Знайти qes-ocr у системних шляхах або локальній папці
QES_OCR="qes-ocr"
if ! command -v qes-ocr >/dev/null 2>&1; then
    if [[ -x "$HOME/.local/bin/qes-ocr" ]]; then
        QES_OCR="$HOME/.local/bin/qes-ocr"
    elif [[ -x "/usr/bin/qes-ocr" ]]; then
        QES_OCR="/usr/bin/qes-ocr"
    fi
fi

# Прямий запуск оптичного розпізнавання чистої англійської мови з графічним прогрес-баром
"$QES_OCR" --eng --gui "${TARGET_FILES[@]}"
