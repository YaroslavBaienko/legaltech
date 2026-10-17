#!/usr/bin/env bash
# ==============================================================================
# 🌊 Підписати PDF (Лише фоновий водяний знак) / Sign PDF (Background Watermark Only)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for p in "${SCRIPT_DIR}/.i18n.sh" "${SCRIPT_DIR}/_i18n.sh" "${SCRIPT_DIR}/../.i18n.sh" "/usr/share/marma-crypto-watermark/nautilus-scripts/_i18n.sh"; do
    [[ -f "$p" ]] && { source "$p"; break; }
done

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
    [[ -f "$f" && "${f,,}" == *.pdf ]] && VALID_FILES+=("$f")
done

if [[ ${#VALID_FILES[@]} -eq 0 ]]; then
    if command -v zenity >/dev/null 2>&1; then
        CHOSEN=$(zenity --file-selection --multiple --separator="|" --title="Оберіть PDF для фонового водяного знака Шрі Янтри" --file-filter="PDF (*.pdf) | *.pdf *.PDF" 2>/dev/null || true)
        [[ -n "$CHOSEN" ]] && IFS="|" read -ra VALID_FILES <<< "$CHOSEN" || exit 0
    else
        exit 0
    fi
fi

if marma-watermark sign --gui --mode watermark "${VALID_FILES[@]}" >/dev/null 2>&1; then
    marma_notify "document-edit" \
        "🌊 Накладено фоновий водяний знак Шрі Янтри" \
        "🌊 Applied Sri Yantra Background Watermark" \
        "Успішно захищено ${#VALID_FILES[@]} PDF-документ(ів) векторним фоновим водяним знаком." \
        "Successfully watermarked ${#VALID_FILES[@]} PDF document(s)."
fi
