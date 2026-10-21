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
    "🔱 Довідка: Marma-Crypto Watermark v2.1.0 (Шрі Янтра · Тризуб · CAD · Optical)" \
    "🔱 Help: Marma-Crypto Watermark v2.1.0 (Sri Yantra · Tryzub · CAD · Optical)" \
    "<b>Математичний принцип (266-бітний Keyed Dithered QIM, v2.1.0):</b>\n• Документ (.pdf, .docx, .svg) гешується паралельним комбайнером <b>SHA-256(GOST 34.311-95 ∥ Kupyna-256 ∥ SHA-256)</b> та зв'язується з підписом <b>ДСТУ 4145-2002</b> (<tt>GF(2^257)</tt>).\n• 256-бітний вектор + 10-бітна канарейка отримувача (<tt>recipient_id 0..1023</tt>) кодуються з кроком <b>18 нм</b> (<tt>PSNR_geom = 155.03 dB</tt>) у 27 симетричних координат векторної печатки:\n  — <b>Шрі Янтра</b> (<tt>sri-yantra</tt>, 9 трикутників, 54 марми),\n  — <b>Малий Державний Герб України — Тризуб</b> (<tt>tryzub</tt>),\n  — <b>Корпоративний щит або CAD-креслення</b> (<tt>corporate-shield</tt>, <tt>cad-polygon</tt>).\n• <b>Marma-Optical ([32, 16, d_min=8] ECC):</b> Дозволяє витягти ID зрадника навіть із фотографії екрана смартфона або скріншота (<tt>.png/.jpg</tt>).\n\n<b>Як користуватися у Nautilus:</b>\n1. Клікніть правою кнопкою миші на <tt>.pdf</tt>, <tt>.svg</tt> або фото екрана <tt>.png/.jpg</tt>.\n2. Оберіть <b>Скрипти ➔ 🔱 Шрі Янтра · Marma-Crypto</b>.\n3. <b>✍️ Підписання та Водяний знак</b> — Шрі Янтра, Тризуб, CAD-SVG або Deal-Room пакетне маркування.\n4. <b>🔍 Перевірка та Протоколи</b> — Верифікація цілісності, трасування витоку PDF/SVG або <b>Marma-Optical</b> (пошук по фото екрана)." \
    "<b>Mathematical Principle (266-bit Keyed Dithered QIM, v2.1.0):</b>\n• The document (.pdf, .docx, .svg) is hashed via the parallel combiner <b>SHA-256(GOST 34.311-95 ∥ Kupyna-256 ∥ SHA-256)</b> and bound to <b>DSTU 4145-2002</b> (<tt>GF(2^257)</tt>).\n• A 256-bit digest + 10-bit recipient canary (<tt>recipient_id 0..1023</tt>) is modulated at <b>18 nm</b> step (<tt>PSNR_geom = 155.03 dB</tt>) into 27 symmetric coordinates of any vector emblem (<b>Sri Yantra</b>, <b>Ukrainian State Trident / Tryzub</b>, <b>Corporate Shield</b>, or <b>CAD-SVG Polygon</b>) plus a 32-sector <b>[32, 16, d_min=8] Optical ECC</b> ring surviving smartphone screen photos."

