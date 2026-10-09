#!/usr/bin/env bash
# ==============================================================================
# 📖 Довідка та Інструкція користувача (QES Tools) / User Guide
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

get_version() {
    local v=""
    if command -v qes-tool >/dev/null 2>&1; then
        v=$(qes-tool --version 2>/dev/null | awk '{print $2}' || true)
    fi
    if [[ -z "$v" && -f "/usr/lib/qes-tools/package.json" ]]; then
        v=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' /usr/lib/qes-tools/package.json 2>/dev/null | head -n1 | cut -d'"' -f4 || true)
    fi
    if [[ -z "$v" && -f "${SCRIPT_DIR}/../package.json" ]]; then
        v=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "${SCRIPT_DIR}/../package.json" 2>/dev/null | head -n1 | cut -d'"' -f4 || true)
    fi
    echo "${v:-1.0.4}"
}
VERSION="$(get_version)"
[[ "$VERSION" != v* ]] && VERSION="v${VERSION}"

if [[ "$QES_LANG" == "en" ]]; then
HELP_TEXT="<span size='x-large' weight='bold' color='#1a5fb4'>📖 QES Tools User Guide & Documentation</span>
<span size='large' weight='bold' color='#007acc'>Suite Version: <b>${VERSION}</b></span>
<span size='small' color='#555555'>100% Offline-First Qualified Electronic Signatures (DSTU 4145-2002), Encryption (GOST 28147:89) & Court Automation</span>

<b>1. SIGNING DOCUMENTS (QES / AES)</b>
• <b>PAdES (PDF with visual stamp & QR):</b>
  Right-click on PDF ➔ <i>«✍️ Sign (PAdES PDF with Stamp & QR)»</i>
  Embeds cryptographic signature, vector official stamp and verification QR code.
  Creates <tt>document_signed.pdf</tt>.
  <i>CLI:</i> <tt>qes-sign --pades document.pdf</tt>

• <b>PAdES (PDF without stamp & QR):</b>
  Right-click on PDF ➔ <i>«✍️ Sign (PAdES PDF without Stamp & QR)»</i>
  Applies invisible cryptographic PAdES signature without page modification.
  <i>CLI:</i> <tt>qes-sign --pades --no-stamp document.pdf</tt>

• <b>Multi-signing (secondary signatures):</b>
  Right-click on signed PDF, ASiC-E or .p7s ➔ <i>«✍️ Add Secondary Signature (Multi-Sign)»</i>
  Appends secondary signatures without invalidating existing ones. Stamps stack neatly.
  <i>CLI:</i> <tt>qes-sign --append document_signed.pdf</tt>

• <b>Detached Signature (.p7s):</b>
  Right-click ➔ <i>«✍️ Sign (Detached Signature .p7s)»</i>
  Creates <tt>document.p7s</tt> alongside the original file. Suitable for tenders and courts.
  <i>CLI:</i> <tt>qes-sign document.docx</tt>

• <b>Package Container ASiC-E (.asice):</b>
  Select multiple files or folder ➔ <i>«📦 Sign (Package Container ASiC-E)»</i>
  Creates standard European ETSI TS 102 918 ZIP archive with manifest and signatures.
  <i>CLI:</i> <tt>qes-sign --asice file1 file2 -o bundle.asice</tt>

<b>2. VERIFYING SIGNATURES & INSPECTING CERTIFICATES</b>
• <b>Verify QES Signature:</b>
  Right-click on .pdf, .asice, .p7s ➔ <i>«🔍 Verify QES Signature»</i>
  Validates mathematical integrity, signer identities, tax IDs, and TSP time stamps.
  Click <i>«Extract Documents»</i> to extract bundled files from ASiC-E containers.
  <i>CLI:</i> <tt>qes-verify document_signed.pdf</tt>

• <b>View CA Certificate Details:</b>
  Right-click on .cer, .crt, .p7b ➔ <i>«📜 View CA Certificate Details»</i>
  Displays certificate data with one-click clipboard copy buttons (Tax ID, USREOU, Details).
  <i>CLI:</i> <tt>qes-cert cert.cer</tt> or <tt>qes-cert --gui cert.cer</tt>

<b>3. OPTICAL CHARACTER RECOGNITION (OCR)</b>
• <b>Pure English OCR (1-click):</b>
  Right-click on scan/PDF ➔ <i>«👁️ OCR Text Recognition (🇬🇧 English)»</i>
  Instantly processes English contracts and invoices into searchable PDFs.
  <i>CLI:</i> <tt>qes-ocr --eng contract.pdf</tt> (or <tt>-e</tt>)

• <b>Court OCR Wizard (Language Selector):</b>
  Right-click ➔ <i>«👁️ OCR Text Recognition (Court PDF)»</i>
  Allows selecting English, Ukrainian, or Bilingual (ukr+eng). Deskews and linearizes (<50MB).
  <i>CLI:</i> <tt>qes-ocr --sidecar file.pdf</tt>

<b>4. CRYPTO VAULT ENCRYPTION (DSTU 4145 / GOST 28147:89)</b>
• <b>Personal Vault:</b>
  Right-click ➔ <i>«🛡️ Encrypt to Personal Vault (.enc)»</i>
  Encrypts files specifically for your own key. Only you can decrypt it.
  <i>CLI:</i> <tt>qes-encrypt private.pdf</tt>

• <b>Encrypt for Recipient:</b>
  Right-click ➔ <i>«📨 Encrypt for Recipient (.enc)»</i>
  Select recipient's public certificate (.cer/.crt).
  <i>CLI:</i> <tt>qes-encrypt -r client.cer lawsuit.pdf</tt>

• <b>Decryption:</b>
  Right-click on .enc ➔ <i>«🔓 Decrypt with Personal Key»</i>
  <i>CLI:</i> <tt>qes-decrypt file.enc</tt>

<b>5. RAM PASSWORD CACHE & LANGUAGE SWITCHING</b>
• Password is cached exclusively in memory (tmpfs 0600) for 15 minutes (Session TTL).
• Right-click ➔ <i>«🔒 Lock Session (Clear Password Cache)»</i> or <tt>qes-agent clear</tt>.
• Switch language anytime: <tt>qes-config --lang en</tt> or <tt>qes-config --lang uk</tt>.
• Master CLI tool: <tt>qes-tool --help</tt> or <tt>qes-tool --version</tt>.
"
TITLE="QES Tools — User Guide & Documentation (${VERSION})"
BTN_LABEL="Close"
EXTRA_BTN="Terminal Guide: qes-tool --help"
else
HELP_TEXT="<span size='x-large' weight='bold' color='#1a5fb4'>📖 Повний посібник користувача QES Tools</span>
<span size='large' weight='bold' color='#007acc'>Версія комплексу: <b>${VERSION}</b></span>
<span size='small' color='#555555'>100% Offline-First комплекс електронного підпису (ДСТУ 4145-2002), шифрування (ГОСТ 28147:89) та судового документообігу</span>

<b>1. ПІДПИСАННЯ ДОКУМЕНТІВ (КЕП / УЕП)</b>
• <b>PAdES (PDF зі штампом та QR):</b>
  Правий клік на PDF ➔ <i>«✍️ Підписати (PAdES PDF зі штампом та QR)»</i>
  Накладає офіційний векторизований штамп та QR-код перевірки на останню сторінку.
  Створює файл <tt>документ_signed.pdf</tt>.
  <i>Термінал:</i> <tt>qes-sign --pades document.pdf</tt>

• <b>PAdES (PDF без штампу та QR):</b>
  Правий клік на PDF ➔ <i>«✍️ Підписати (PAdES PDF без штампу та QR)»</i>
  Накладає чистий цифровий підпис без візуальних позначок на сторінках (невидимий підпис PAdES).
  <i>Термінал:</i> <tt>qes-sign --pades --no-stamp document.pdf</tt>

• <b>Мультипідписання (другий і наступні підписи):</b>
  Правий клік на підписаному PDF, ASiC-E або .p7s ➔ <i>«✍️ Додати другий підпис (Мультипідпис)»</i>
  Додає підпис наступного підписанта без пошкодження попередніх підписів.
  Штампи в PDF автоматично розміщуються вертикально один над іншим.
  <i>Термінал:</i> <tt>qes-sign --append document_signed.pdf</tt>

• <b>Відокремлений підпис (.p7s):</b>
  Правий клік ➔ <i>«✍️ Підписати (Відокремлений підпис .p7s)»</i>
  Створює файл <tt>документ.p7s</tt> поруч. Для тендерів Prozorro, судів, M.E.Doc, Вчасно.
  <i>Термінал:</i> <tt>qes-sign document.docx</tt>

• <b>Пакетний контейнер ASiC-E (.asice):</b>
  Виділіть кілька файлів або папку ➔ <i>«📦 Підписати (Пакетний контейнер ASiC-E)»</i>
  Створює стандартизований європейський архів ETSI TS 102 918 з підписами всіх файлів.
  <i>Термінал:</i> <tt>qes-sign --asice file1 file2 -o bundle.asice</tt>

<b>2. ПЕРЕВІРКА ПІДПИСІВ ТА СЕРТИФІКАТІВ</b>
• <b>Перевірка КЕП:</b>
  Правий клік на .pdf, .asice, .p7s ➔ <i>«🔍 Перевірити підпис КЕП»</i>
  Показує статус чинності, ПІБ, РНОКПП підписувачів, мітку часу TSP та цілісність.
  Кнопка <i>«Видобути документи»</i> дозволяє дістати файли з архіву ASiC-E в 1 клік.
  <i>Термінал:</i> <tt>qes-verify document_signed.pdf</tt>

• <b>Перегляд сертифіката КНЕДП:</b>
  Правий клік на .cer, .crt, .p7b ➔ <i>«📜 Переглянути сертифікат КНЕДП»</i>
  Показує всі реквізити та надає кнопки швидкого копіювання:
  • <i>«Скопіювати РНОКПП»</i>
  • <i>«Скопіювати ЄДРПОУ»</i>
  • <i>«Скопіювати повні реквізити»</i> (готові для позовних заяв та договорів)
  <i>Термінал:</i> <tt>qes-cert cert.cer</tt> або <tt>qes-cert --gui cert.cer</tt>

<b>3. ОПТИЧНЕ РОЗПІЗНАВАННЯ ТЕКСТУ (OCR) ДЛЯ «ЕЛЕКТРОННОГО СУДУ»</b>
• <b>Чиста Англійська мова (1-клік):</b>
  Правий клік на скан-документі ➔ <i>«👁️ Розпізнати текст OCR (🇬🇧 Чиста Англійська)»</i>
  Миттєве розпізнавання англомовних контрактів та інвойсів без зайвих діалогів.
  <i>Термінал:</i> <tt>qes-ocr --eng contract.pdf</tt> (або <tt>-e</tt>)

• <b>Майстер розпізнавання (вибір мови):</b>
  Правий клік ➔ <i>«👁️ Розпізнати текст OCR (Е-Суд)»</i>
  Дозволяє обрати мову: Чиста англійська, Чиста українська чи Двомовне (ukr+eng).
  Автоматично вирівнює перекошені сторінки, лінеаризує (Fast Web View) та перевіряє ліміт 50 МБ.
  <i>Термінал:</i> <tt>qes-ocr --sidecar file.pdf</tt> (зберігає розпізнаний текст у .txt)

<b>4. КРИПТОГРАФІЧНИЙ СЕЙФ (ШИФРУВАННЯ ДСТУ 4145 / ГОСТ 28147:89)</b>
• <b>Особистий сейф:</b>
  Правий клік ➔ <i>«🛡️ Зашифрувати в особистий сейф (.enc)»</i>
  Шифрує документ або папку виключно для вашого ключа. Відкрити зможете тільки ви.
  <i>Термінал:</i> <tt>qes-encrypt private.pdf</tt>

• <b>Шифрування для адресата:</b>
  Правий клік ➔ <i>«📨 Зашифрувати для адресата (.enc)»</i>
  Оберіть відкритий сертифікат (.cer) клієнта, колеги або суду.
  <i>Термінал:</i> <tt>qes-encrypt -r client.cer lawsuit.pdf</tt>

• <b>Розшифрування:</b>
  Правий клік на .enc ➔ <i>«🔓 Розшифрувати особистим КЕП»</i>
  <i>Термінал:</i> <tt>qes-decrypt file.enc</tt>

<b>5. БЕЗПЕКА ТА КЕШУВАННЯ ПАРОЛЯ В СЕСІЇ (Session TTL)</b>
• Пароль кешується виключно в оперативній пам'яті (RAM tmpfs /run/user/${UID:-1000}/qes-agent.sock) на 15–30 хвилин.
• Жоден символ пароля чи ключа ніколи не записується на диск.
• Щоб негайно скинути всі збережені паролі з пам'яті та заблокувати ключі:
  Правий клік ➔ <i>«🔒 Скинути кеш пароля (Заблокувати)»</i>
  <i>Термінал:</i> <tt>qes-agent clear</tt> (або <tt>qes-agent status</tt>)
• Перемикання мови інтерфейсу: <tt>qes-config --lang en</tt> або <tt>qes-config --lang uk</tt>.
• Загальна утиліта довідки: <tt>qes-tool --help</tt> або <tt>qes-tool --version</tt>.
"
TITLE="Довідка та Інструкції — QES Tools (${VERSION})"
BTN_LABEL="Закрити"
EXTRA_BTN="Термінал: qes-tool --help"
fi

RES=$(zenity --info \
    --title="$TITLE" \
    --text="$HELP_TEXT" \
    --ok-label="$BTN_LABEL" \
    --extra-button="$EXTRA_BTN" \
    --width=760 \
    --height=600 || true)

if [[ "$RES" == "$EXTRA_BTN" ]]; then
    if command -v gnome-terminal >/dev/null 2>&1; then
        gnome-terminal -- bash -c "qes-tool --help; echo -e '\nНатисніть Enter для виходу...'; read" &
    elif command -v x-terminal-emulator >/dev/null 2>&1; then
        x-terminal-emulator -e bash -c "qes-tool --help; read" &
    elif command -v xterm >/dev/null 2>&1; then
        xterm -hold -e "qes-tool --help" &
    fi
fi
