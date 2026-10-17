#!/usr/bin/env bash
# ==============================================================================
# 🪙 Підписати (Лише кутова Золота печатка Бінду) / Sign (Corner Golden Seal Only)
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
    if [[ -f "$f" ]]; then
        case "${f,,}" in
            *.pdf|*.docx) VALID_FILES+=("$f") ;;
            *)
                companion="${f%.*}.pdf"
                [[ -f "$companion" ]] && VALID_FILES+=("$companion")
                ;;
        esac
    fi
done

if [[ ${#VALID_FILES[@]} -eq 0 ]]; then
    if command -v zenity >/dev/null 2>&1; then
        CHOSEN=$(zenity --file-selection --multiple --separator="|" --title="Оберіть документи (.pdf, .docx) для кутової Золотої печатки" --file-filter="PDF / DOCX | *.pdf *.PDF *.docx *.DOCX" 2>/dev/null || true)
        [[ -n "$CHOSEN" ]] && IFS="|" read -ra VALID_FILES <<< "$CHOSEN" || exit 0
    else
        exit 0
    fi
fi

if marma-watermark sign --gui --mode seal "${VALID_FILES[@]}" >/dev/null 2>&1; then
    marma_notify "document-edit" \
        "🪙 Накладено Золоту печатку Бінду" \
        "🪙 Applied Golden Bindu Authorship Seal" \
        "Успішно підписано ${#VALID_FILES[@]} документ(ів) кутовою золотою печаткою Marma-Crypto." \
        "Successfully signed ${#VALID_FILES[@]} document(s) with corner Golden Bindu seal."
fi
