#!/usr/bin/env bash
# ==============================================================================
# 👁️ Розпізнати текст OCR (🇬🇧 Чиста Англійська)
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
    zenity --warning --title="OCR Розпізнавання (🇬🇧 English)" \
        --text="Будь ласка, виберіть хоча б один PDF-документ або скан-зображення (PNG/JPG/TIFF) для розпізнавання тексту англійською мовою."
    exit 0
fi

# Знайти qes-ocr у системних шляхах або локальній папці
QES_OCR="qes-ocr"
if ! command -v qes-ocr >/dev/null 2>&1; then
    if [[ -x "$HOME/.local/bin/qes-ocr" ]]; then
        QES_OCR="$HOME/.local/bin/qes-ocr"
    elif [[ -x "/home/attor/ai-debian-admin/tools/qes-signer/bin/qes-ocr" ]]; then
        QES_OCR="/home/attor/ai-debian-admin/tools/qes-signer/bin/qes-ocr"
    fi
fi

# Прямий запуск оптичного розпізнавання чистої англійської мови з графічним прогрес-баром
"$QES_OCR" --eng --gui "${TARGET_FILES[@]}"
