#!/usr/bin/env bash
# ==============================================================================
# 🔍 Перевірити підпис КЕП / Verify QES Signature
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

if [[ ${#FILES[@]} -eq 0 ]]; then
    qes_warn_dialog \
        "Перевірка КЕП" \
        "QES Verification" \
        "Оберіть документ (.pdf), контейнер (.asice) або файл підпису (.p7s) для перевірки." \
        "Select a document (.pdf), container (.asice) or signature file (.p7s) to verify."
    exit 0
fi

qes-verify --gui "${FILES[@]}"
