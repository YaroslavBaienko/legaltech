#!/usr/bin/env bash
# ==============================================================================
# 🛡️ Зашифрувати в особистий сейф (.enc)
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
    zenity --warning --title="Особистий сейф (ДСТУ 4145 / ГОСТ 28147)" --text="Оберіть файл(и) або папку для поміщення в особистий криптосейф."
    exit 0
fi

if qes-encrypt --gui "${FILES[@]}"; then
    notify-send -a "QES Tools" -i security-high \
        "🔐 Зашифровано в особистий сейф" \
        "Успішно зашифровано ${#FILES[@]} об'єкт(ів). Доступ дозволено лише за вашим ключем КЕП."
else
    notify-send -a "QES Tools" -i dialog-error \
        "❌ Помилка шифрування" \
        "Операцію шифрування скасовано або сталася помилка."
fi
