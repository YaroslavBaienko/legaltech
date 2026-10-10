#!/usr/bin/env bash
# ==============================================================================
# ✍️ Підписати (PAdES PDF без штампу та QR) / Sign (PAdES PDF without Stamp & QR)
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
        dlg_title="$(qes_text "Оберіть PDF-документи для підписання без штампа" "Select PDF documents to sign without stamp")"
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

# Run signing with GUI password dialog and --no-stamp
if qes-sign --pades --no-stamp --gui "${PDF_FILES[@]}"; then
    created_count=0
    for f in "${PDF_FILES[@]}"; do
        d="$(dirname "$f")"
        base="$(basename "$f" .pdf)"
        if [[ -f "${d}/${base}_signed.pdf" || -f "${d}/${base}_multisigned.pdf" || -f "${f}.p7s" ]]; then
            created_count=$((created_count + 1))
        fi
    done
    if [[ $created_count -gt 0 ]]; then
        qes_notify "document-edit" \
            "✅ Підписано КЕП (PAdES без штампа)" \
            "✅ Signed with QES (PAdES without stamp)" \
            "Успішно підписано ${created_count} PDF-документ(ів) (чистий вшитий цифровий підпис без візуального штампа)." \
            "Successfully signed ${created_count} PDF document(s) (clean embedded signature without visual stamp)."
    fi
else
    qes_notify "dialog-error" \
        "❌ Помилка підписання" \
        "❌ Signing Error" \
        "Підписання документа скасовано або виникла помилка." \
        "Document signing was cancelled or an error occurred."
fi
