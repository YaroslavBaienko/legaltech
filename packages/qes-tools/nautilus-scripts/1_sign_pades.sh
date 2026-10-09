#!/usr/bin/env bash
# ==============================================================================
# ✍️ Підписати (PAdES PDF зі штампом та QR) / Sign (PAdES PDF with Stamp & QR)
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

PDF_FILES=()
for f in "${FILES[@]}"; do
    if [[ -f "$f" && "${f,,}" == *.pdf ]]; then
        PDF_FILES+=("$f")
    fi
done

if [[ ${#PDF_FILES[@]} -eq 0 ]]; then
    if command -v zenity >/dev/null 2>&1; then
        dlg_title="$(qes_text "Оберіть PDF-документи для підписання зі штампом та QR" "Select PDF documents to sign with stamp & QR")"
        dlg_filter="$(qes_text "PDF документи (*.pdf) | *.pdf *.PDF" "PDF documents (*.pdf) | *.pdf *.PDF")"
        CHOSEN=$(zenity --file-selection --multiple --separator="|" --title="$dlg_title" --file-filter="$dlg_filter" 2>/dev/null || true)
        if [[ -n "$CHOSEN" ]]; then
            IFS="|" read -ra PDF_FILES <<< "$CHOSEN"
        else
            exit 0
        fi
    else
        exit 0
    fi
fi

# Run signing with GUI password dialog
if qes-sign --pades --gui "${PDF_FILES[@]}"; then
    qes_notify "document-edit" \
        "✅ Підписано КЕП (PAdES)" \
        "✅ Signed with QES (PAdES)" \
        "Успішно підписано ${#PDF_FILES[@]} PDF-документ(ів) з офіційним штампом та QR-кодом." \
        "Successfully signed ${#PDF_FILES[@]} PDF document(s) with official stamp & QR code."
else
    qes_notify "dialog-error" \
        "❌ Помилка підписання" \
        "❌ Signing Error" \
        "Підписання документа скасовано або виникла помилка." \
        "Document signing was cancelled or an error occurred."
fi
