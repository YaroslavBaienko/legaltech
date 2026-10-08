#!/usr/bin/env bash
# ==============================================================================
# 🔍 Перевірити підпис КЕП
# ==============================================================================
set -euo pipefail

FILES=()
if [[ -n "${NAUTILUS_SCRIPT_SELECTED_FILE_PATHS:-}" ]]; then
    while IFS= read -r line; do
        [[ -n "$line" ]] && FILES+=("$line")
    done <<< "$NAUTILUS_SCRIPT_SELECTED_FILE_PATHS"
else
    FILES=("$@")
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
    zenity --warning --title="Перевірка КЕП" --text="Оберіть документ (.pdf), контейнер (.asice) або файл підпису (.p7s) для перевірки."
    exit 0
fi

qes-verify --gui "${FILES[@]}"
