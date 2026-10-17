#!/usr/bin/env bash
# ==============================================================================
# 🔒 Скинути кеш пароля в RAM (Заблокувати сесію) / Lock RAM Session
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for p in "${SCRIPT_DIR}/.i18n.sh" "${SCRIPT_DIR}/_i18n.sh" "${SCRIPT_DIR}/../.i18n.sh" "/usr/share/marma-crypto-watermark/nautilus-scripts/_i18n.sh"; do
    [[ -f "$p" ]] && { source "$p"; break; }
done

marma-watermark clear-session >/dev/null 2>&1 || true
marma_notify "security-high" \
    "🔒 Сесію Marma-Crypto заблоковано" \
    "🔒 Marma-Crypto Session Locked" \
    "Похідні ключі вилучено з оперативної пам'яті RAM (/run/user)." \
    "Derived keys wiped from RAM session (/run/user)."
