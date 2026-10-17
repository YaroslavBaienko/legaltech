#!/usr/bin/env bash
# ==============================================================================
# 📖 Довідка та Математичний Стандарт Шрі Янтри / Help & Mathematical Standard
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for p in "${SCRIPT_DIR}/.i18n.sh" "${SCRIPT_DIR}/_i18n.sh" "${SCRIPT_DIR}/../.i18n.sh" "/usr/share/marma-crypto-watermark/nautilus-scripts/_i18n.sh"; do
    [[ -f "$p" ]] && { source "$p"; break; }
done

marma_info_dialog \
    "🔱 Довідка: Marma-Crypto Watermark (Шрі Янтра)" \
    "🔱 Help: Marma-Crypto Watermark (Sri Yantra)" \
    "<b>Математичний принцип (Zero-Tolerance Marma Hash):</b>\n• Документ (.pdf, .docx, .svg) гешується за алгоритмом <b>SHA-256</b>.\n• Ваш особистий ключ із <tt>~/.secure_keys/</tt> (.pfx, .p12, .key) або апаратний токен формує <b>HMAC-SHA256</b> підпис, який кодується у 9 мікро-зміщень координат 9 трикутників Шрі Янтри (δ ∈ [-10⁻⁵, +10⁻⁵]) зі строгим збереженням білатеральної симетрії (<tt>lx + rx = 300.000000000</tt>).\n\n<b>Як користуватися у Nautilus:</b>\n1. Клікніть правою кнопкою миші на <tt>.pdf</tt> або <tt>.docx</tt> документі.\n2. Оберіть <b>Скрипти ➔ 🔱 Шрі Янтра · Marma-Crypto</b>.\n3. Для підписання оберіть <b>✍️ Підписання та Водяний знак</b>.\n4. Для перевірки або генерації PDF-протоколу оберіть <b>🔍 Перевірка та Протоколи</b>." \
    "<b>Mathematical Principle (Zero-Tolerance Marma Hash):</b>\n• The document (.pdf, .docx, .svg) is hashed with <b>SHA-256</b>.\n• Your personal key in <tt>~/.secure_keys/</tt> (.pfx, .p12, .key) derives an <b>HMAC-SHA256</b> digest mapped into 9 micro-perturbations of the 9 Sri Yantra triangles while preserving exact bilateral symmetry (<tt>lx + rx = 300.000000000</tt>)."
