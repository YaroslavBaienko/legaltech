#!/usr/bin/env bash
# ==============================================================================
# ✍️ Додати другий підпис (Мультипідпис) / Add Secondary Signature (Multi-Sign)
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

VALID_FILES=()
for f in "${FILES[@]}"; do
    if [[ -f "$f" ]]; then
        VALID_FILES+=("$f")
    fi
done

if [[ ${#VALID_FILES[@]} -eq 0 ]]; then
    qes_warn_dialog \
        "Мультипідписання КЕП" \
        "Multi-Sign QES" \
        "Будь ласка, виберіть хоча б один файл (.pdf, .asice або .p7s) для додавання другого підпису." \
        "Please select at least one file (.pdf, .asice or .p7s) to append a secondary signature."
    exit 0
fi

# Run signing with GUI password dialog and --append flag
if qes-sign --append --gui "${VALID_FILES[@]}"; then
    qes_notify "document-edit" \
        "✅ Мультипідпис накладено" \
        "✅ Multi-Signature Applied" \
        "Успішно додано новий підпис до ${#VALID_FILES[@]} документа(-ів) зі збереженням чинності попередніх підписів." \
        "Successfully added signature to ${#VALID_FILES[@]} document(s) preserving validity of prior signatures."
else
    qes_notify "dialog-error" \
        "❌ Помилка мультипідписання" \
        "❌ Multi-Sign Error" \
        "Підписання документа скасовано або виникла помилка." \
        "Document signing was cancelled or an error occurred."
fi
