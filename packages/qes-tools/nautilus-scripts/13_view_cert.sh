#!/usr/bin/env bash
# ==============================================================================
# 📜 Переглянути сертифікат КНЕДП
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
    zenity --warning --title="Сертифікат КНЕДП" --text="Оберіть файл відкритого сертифіката (.cer, .crt, .der, .pem) або пакет (.p7b)."
    exit 0
fi

# Знайти qes-cert у системних шляхах або локальній папці
QES_CERT="qes-cert"
if ! command -v qes-cert >/dev/null 2>&1; then
    if [[ -x "$HOME/.local/bin/qes-cert" ]]; then
        QES_CERT="$HOME/.local/bin/qes-cert"
    elif [[ -x "/home/attor/ai-debian-admin/tools/qes-verifier/bin/qes-cert" ]]; then
        QES_CERT="/home/attor/ai-debian-admin/tools/qes-verifier/bin/qes-cert"
    fi
fi

"$QES_CERT" --gui "${FILES[@]}"
