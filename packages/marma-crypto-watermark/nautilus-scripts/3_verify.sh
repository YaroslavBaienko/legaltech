#!/usr/bin/env bash
# ==============================================================================
# 🔍 Перевірити підпис та геометрію Шрі Янтри / Verify Marma-Crypto Signature
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

if [[ ${#FILES[@]} -eq 0 ]]; then
    if command -v zenity >/dev/null 2>&1; then
        CHOSEN=$(zenity --file-selection --multiple --separator="|" --title="Оберіть підписаний документ (.pdf, .docx, .svg) для перевірки" --file-filter="Документи (*.pdf, *.docx, *.svg) | *.pdf *.PDF *.docx *.DOCX *.svg *.SVG" 2>/dev/null || true)
        [[ -n "$CHOSEN" ]] && IFS="|" read -ra FILES <<< "$CHOSEN" || exit 0
    else
        exit 0
    fi
fi

marma-watermark verify --gui --lang "${MARMA_LANG:-uk}" "${FILES[@]}" || true
