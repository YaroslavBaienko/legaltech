#!/usr/bin/env bash
# ==============================================================================
# ✍️ Підписати (Відокремлений підпис .p7s) / Sign (Detached Signature .p7s)
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
        "КЕП Підписання (.p7s)" \
        "QES Signing (.p7s)" \
        "Оберіть хоча б один файл для створення відокремленого підпису." \
        "Select at least one file to create a detached signature."
    exit 0
fi

if qes-sign --gui "${VALID_FILES[@]}"; then
    qes_notify "document-edit" \
        "✅ Підписано КЕП (.p7s)" \
        "✅ Signed with QES (.p7s)" \
        "Створено відокремлені файли підпису для ${#VALID_FILES[@]} файл(ів)." \
        "Created detached signature files for ${#VALID_FILES[@]} file(s)."
else
    qes_notify "dialog-error" \
        "❌ Помилка підписання" \
        "❌ Signing Error" \
        "Операцію підписання перервано або скасовано." \
        "Signing operation was interrupted or cancelled."
fi
