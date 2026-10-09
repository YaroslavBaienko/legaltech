#!/usr/bin/env bash
# ==============================================================================
# ⚖️ Оптимізувати PDF для Е-Суду / Optimize PDF for Court
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

PDF_FILES=()
for f in "${FILES[@]}"; do
    if [[ -f "$f" && "${f,,}" == *.pdf ]]; then
        PDF_FILES+=("$f")
    fi
done

if [[ ${#PDF_FILES[@]} -eq 0 ]]; then
    qes_warn_dialog \
        "Оптимізація для Е-Суду" \
        "Optimize PDF for Court" \
        "Оберіть хоча б один PDF-файл для оптимізації." \
        "Select at least one PDF file to optimize."
    exit 0
fi

qes-pdf-court --gui "${PDF_FILES[@]}"
