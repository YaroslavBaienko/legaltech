#!/usr/bin/env bash
# ==============================================================================
# 🔒 Скинути кеш пароля (Заблокувати) / Lock Session (Clear Password Cache)
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

if qes-agent clear >/dev/null 2>&1; then
    qes_notify "security-high" \
        "🔒 Сесію КЕП завершено" \
        "🔒 QES Session Locked" \
        "Усі паролі успішно вилучено з оперативної пам'яті. Ключі заблоковано." \
        "All passwords successfully wiped from memory. Keys locked."
else
    qes_notify "dialog-information" \
        "ℹ️ Сесія не була активною" \
        "ℹ️ Session Not Active" \
        "Кеш паролів уже порожній або агент не запущено." \
        "Password cache is already empty or agent is not running."
fi
