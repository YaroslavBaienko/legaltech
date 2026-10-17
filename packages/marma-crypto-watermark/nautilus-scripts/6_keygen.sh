#!/usr/bin/env bash
# ==============================================================================
# 🗝️ Створити / Керувати ключем у сейфі (~/.secure_keys) / Manage Vault Key
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for p in "${SCRIPT_DIR}/.i18n.sh" "${SCRIPT_DIR}/_i18n.sh" "${SCRIPT_DIR}/../.i18n.sh" "/usr/share/marma-crypto-watermark/nautilus-scripts/_i18n.sh"; do
    [[ -f "$p" ]] && { source "$p"; break; }
done

OUT_JSON="$(marma-watermark keygen)"
KEY_PATH="$(echo "$OUT_JSON" | grep -o '"key_file"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)"
KEY_FP="$(echo "$OUT_JSON" | grep -o '"key_fingerprint"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)"

VAULT_COUNT=$(find "$HOME/.secure_keys" -maxdepth 2 -type f \( -name "*.pfx" -o -name "*.p12" -o -name "*.key" -o -name "*.cer" \) 2>/dev/null | wc -l)

marma_info_dialog \
    "🗝️ Сейф ключів Marma-Crypto (~/.secure_keys)" \
    "🗝️ Marma-Crypto Key Vault (~/.secure_keys)" \
    "Майстер-ключ активний та готовий до підписання:\n• Файл: <tt>${KEY_PATH}</tt>\n• Відбиток SHA-256: <tt>${KEY_FP:0:32}...</tt>\n• Усього ключів/сертифікатів у ~/.secure_keys: <b>${VAULT_COUNT}</b>\n\nПід час підписання ви можете обрати будь-який ключ КЕП (.pfx, .p12) або майстер-ключ Шрі Янтри." \
    "Master key is active and ready for signing:\n• File: <tt>${KEY_PATH}</tt>\n• SHA-256 Fingerprint: <tt>${KEY_FP:0:32}...</tt>\n• Total keys/certificates in ~/.secure_keys: <b>${VAULT_COUNT}</b>"
