#!/usr/bin/env bash
# ==============================================================================
# 📤 Експортувати мій відкритий сертифікат (.cer)
# ==============================================================================
set -euo pipefail

TARGET_DIR="$HOME/Desktop"
if [[ -n "${NAUTILUS_SCRIPT_CURRENT_URI:-}" ]]; then
    TARGET_DIR="${NAUTILUS_SCRIPT_CURRENT_URI#file://}"
fi

cd "$TARGET_DIR"

if qes-export-cert --gui; then
    notify-send -a "QES Tools" -i certificate \
        "📤 Сертифікат експортовано" \
        "Відкритий сертифікат збережено у поточній папці. Ви можете безпечно передавати його клієнтам."
else
    notify-send -a "QES Tools" -i dialog-error \
        "❌ Помилка експорту" \
        "Не вдалося експортувати сертифікат або операцію скасовано."
fi
