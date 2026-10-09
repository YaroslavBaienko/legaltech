#!/usr/bin/env bash
# ==============================================================================
# 📤 Експортувати мій відкритий сертифікат (.cer) / Export Public Certificate (.cer)
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

TARGET_DIR="$HOME/Desktop"
if [[ -n "${NAUTILUS_SCRIPT_CURRENT_URI:-}" ]]; then
    TARGET_DIR="${NAUTILUS_SCRIPT_CURRENT_URI#file://}"
fi

cd "$TARGET_DIR"

if qes-export-cert --gui; then
    qes_notify "application-certificate" \
        "📤 Сертифікат експортовано" \
        "📤 Certificate Exported" \
        "Відкритий сертифікат збережено у поточній папці. Ви можете безпечно передавати його клієнтам." \
        "Public certificate saved in the current directory. You can safely share it with clients."
else
    qes_notify "dialog-error" \
        "❌ Помилка експорту" \
        "❌ Export Error" \
        "Не вдалося експортувати сертифікат або операцію скасовано." \
        "Failed to export certificate or operation was cancelled."
fi
