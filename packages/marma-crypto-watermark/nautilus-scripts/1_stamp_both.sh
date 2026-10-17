#!/usr/bin/env bash
# ==============================================================================
# 🔱 Підписати (Водяний знак + Золота печатка) / Sign (Watermark + Golden Seal)
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
            *.pdf|*.docx|*.svg) VALID_FILES+=("$f") ;;
            *.p7s)
                base="${f%.p7s}"
                [[ -f "$base" ]] && VALID_FILES+=("$base")
                ;;
            *)
                companion="${f%.*}.pdf"
                [[ -f "$companion" ]] && VALID_FILES+=("$companion")
                ;;
        esac
    fi
done

if [[ ${#VALID_FILES[@]} -eq 0 ]]; then
    if command -v zenity >/dev/null 2>&1; then
        dlg_title="$(marma_text "Оберіть документи (.pdf, .docx, .svg) для накладання водяного знака та печатки" "Select documents (.pdf, .docx, .svg) to sign with watermark & seal")"
        CHOSEN=$(zenity --file-selection --multiple --separator="|" --title="$dlg_title" --file-filter="Документи (*.pdf, *.docx, *.svg) | *.pdf *.PDF *.docx *.DOCX *.svg *.SVG" 2>/dev/null || true)
        [[ -n "$CHOSEN" ]] && IFS="|" read -ra VALID_FILES <<< "$CHOSEN" || exit 0
    else
        exit 0
    fi
fi

if marma-watermark sign --gui --mode both "${VALID_FILES[@]}" >/dev/null 2>&1; then
    marma_notify "document-edit" \
        "✅ Накладено Marma-Crypto Водяний Знак та Печатку" \
        "✅ Applied Marma-Crypto Watermark & Seal" \
        "Успішно підписано ${#VALID_FILES[@]} документ(ів) 9-трикутниковим вектором Шрі Янтри (HMAC-SHA256)." \
        "Successfully signed ${#VALID_FILES[@]} document(s) with Sri Yantra 9-triangle HMAC-SHA256 vector."
else
    marma_notify "dialog-error" \
        "❌ Підписання скасовано або помилка" \
        "❌ Signing Cancelled or Error" \
        "Накладання водяного знака Marma-Crypto скасовано або виникла помилка." \
        "Marma-Crypto watermarking was cancelled or an error occurred."
fi
