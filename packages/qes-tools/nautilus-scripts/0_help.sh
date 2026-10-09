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
HELP_TEXT="================================================================================
📖 QES TOOLS USER GUIDE & DOCUMENTATION (${VERSION})
================================================================================
Suite Version: ${VERSION}
100% Offline-First | DSTU 4145-2002 | PAdES | CAdES | ASiC-E | GOST 28147:89
================================================================================

OVERVIEW:
QES Tools is a 100% offline-first cryptographic suite for Ukrainian Qualified
Electronic Signatures (QES / DSTU 4145-2002), encryption (GOST 28147:89),
and Ukrainian E-Court document workflows.

All cryptographic operations run entirely on your local machine without sending
files, keys, or passwords to any external server.

All operations are accessible either via CLI or via the Nautilus context menu:
Right-click on file(s) ➔ Scripts ➔ 🔐 QES & Security.

================================================================================
1. SIGNING DOCUMENTS (QES / AES)
================================================================================
• PAdES (PDF with Visual Stamp & QR Code):
  - Nautilus: «✍️ Sign (PAdES PDF with Stamp & QR)»
  - Description: Embeds a cryptographic signature, vector official stamp,
    and a verification QR code onto the last page of the PDF.
    Produces: document_signed.pdf
  - CLI: qes-sign --pades document.pdf

• PAdES (PDF without Stamp & QR Code):
  - Nautilus: «✍️ Sign (PAdES PDF without Stamp & QR)»
  - Description: Applies an invisible cryptographic PAdES signature without
    modifying page visual content.
  - CLI: qes-sign --pades --no-stamp document.pdf

• Multi-Signing (Secondary Signatures):
  - Nautilus: «✍️ Add Secondary Signature (Multi-Sign)»
  - Description: Appends an additional signature to an already signed PDF,
    ASiC-E, or .p7s without invalidating previous signatures. In PDFs, stamps
    automatically stack neatly.
  - CLI: qes-sign --append document_signed.pdf

• Detached Signature (.p7s / CAdES):
  - Nautilus: «✍️ Sign (Detached Signature .p7s)»
  - Description: Creates a detached signature file «document.p7s» alongside
    the original file. Fully compatible with Prozorro, courts, M.E.Doc, Vchasno.
  - CLI: qes-sign document.docx

• Package Container ASiC-E (.asice):
  - Nautilus: «📦 Sign (Package Container ASiC-E)»
  - Description: Bundles multiple selected files or folders into a standardized
    European ETSI TS 102 918 ZIP archive with signatures for all items.
  - CLI: qes-sign --asice file1.pdf file2.xlsx -o bundle.asice

================================================================================
2. VERIFYING SIGNATURES & INSPECTING CERTIFICATES
================================================================================
• Verify QES Signature:
  - Nautilus: «🔍 Verify QES Signature»
  - Description: Validates signature validity, mathematical integrity, signer
    identity (Name, Tax ID / USREOU), and TSP timestamp. For ASiC-E containers,
    provides a 1-click «Extract Documents» button.
  - CLI: qes-verify document_signed.pdf
         qes-verify bundle.asice

• View CA Certificate Details:
  - Nautilus: «📜 View CA Certificate Details»
  - Description: Inspects public certificates (.cer, .crt, .p7b) with 1-click
    buttons to copy Tax ID, USREOU, or full formatted legal requisites to clipboard.
  - CLI: qes-cert cert.cer  (or qes-cert --gui cert.cer)

• Export Public Certificate:
  - CLI: qes-export-cert -o my_cert.cer
  - Description: Safely extracts the public X.509 certificate from a private key (.pfx).

================================================================================
3. OPTICAL CHARACTER RECOGNITION (OCR)
================================================================================
• 1-Click English OCR:
  - Nautilus: «👁️ OCR Text Recognition (🇬🇧 English)»
  - Description: Instantly converts scanned English documents and invoices
    into searchable, selectable text PDFs.
  - CLI: qes-ocr --eng contract.pdf  (or qes-ocr -e contract.pdf)

• Court OCR Wizard (Language Selector):
  - Nautilus: «👁️ OCR Text Recognition (Court PDF)»
  - Description: Interactive dialog to choose English, Ukrainian, or Bilingual
    (ukr+eng), with automatic deskewing and linearization (<50MB).
  - CLI: qes-ocr --sidecar document.pdf  (saves text to .txt sidecar)

================================================================================
4. CRYPTO VAULT ENCRYPTION (DSTU 4145 / GOST 28147:89)
================================================================================
• Encrypt to Personal Vault:
  - Nautilus: «🛡️ Encrypt to Personal Vault (.enc)»
  - Description: Encrypts files specifically for your own key. Only you can decrypt.
  - CLI: qes-encrypt private.pdf

• Encrypt for Recipient:
  - Nautilus: «📨 Encrypt for Recipient (.enc)»
  - Description: Encrypts file using recipient's public certificate (.cer).
  - CLI: qes-encrypt -r recipient.cer contract.pdf

• Decrypt File:
  - Nautilus: «🔓 Decrypt with Personal Key»
  - Description: Restores original file using your private key and password.
  - CLI: qes-decrypt document.pdf.enc

================================================================================
5. E-COURT PDF OPTIMIZATION
================================================================================
• Nautilus: «⚖️ Optimize PDF for Court»
• Description: Shrinks and linearizes PDF files to comply with the 50MB
  subsystem limit and enables Fast Web View.
• CLI: qes-pdf-court lawsuit_evidence.pdf

================================================================================
6. RAM PASSWORD CACHING & SECURITY (SESSION TTL)
================================================================================
• In-Memory Password Caching:
  - Private key passwords are cached exclusively in volatile RAM (/run/user/... tmpfs)
    for 15-30 minutes. Passwords and private keys are NEVER written to disk.
• Lock Session:
  - Nautilus: «🔒 Lock Session (Clear Password Cache)»
  - CLI: qes-agent clear  (status: qes-agent status)

================================================================================
7. MASTER MANAGEMENT UTILITY: QES-TOOL
================================================================================
• Check Version:
  $ qes-tool --version       (or qes-tool -v)
• Full Help and Usage Guide:
  $ qes-tool --help          (or qes-tool -h)
• Switch Nautilus Language:
  $ qes-config --lang en     # Switch menu to English (🔐 QES & Security)
  $ qes-config --lang uk     # Switch menu to Ukrainian (🔐 КЕП та Безпека)
  $ qes-config --lang auto   # Auto-detect from system desktop locale
• Direct Subcommands:
  $ qes-tool sign [...]      # Runs qes-sign
  $ qes-tool verify [...]    # Runs qes-verify
  $ qes-tool encrypt [...]   # Runs qes-encrypt
  $ qes-tool decrypt [...]   # Runs qes-decrypt
================================================================================
"
TITLE="QES Tools — User Guide & Documentation (${VERSION})"
BTN_LABEL="Close"
EXTRA_BTN="Terminal Guide: qes-tool --help"
TERMINAL_PROMPT="Press Enter to exit..."
else
HELP_TEXT="================================================================================
📖 ДОВІДНИК ТА ПОСІБНИК КОРИСТУВАЧА QES TOOLS (${VERSION})
================================================================================
Версія комплексу: ${VERSION}
100% Offline-First | ДСТУ 4145-2002 | PAdES | CAdES | ASiC-E | ГОСТ 28147:89
================================================================================

ОПИС КОМПЛЕКСУ:
QES Tools — це автономний комплекс для роботи з кваліфікованим електронним
підписом (КЕП / ДСТУ 4145-2002), шифруванням файлів (ГОСТ 28147:89) та судовою
підсистемою «Електронний суд».

Усі криптографічні операції виконуються 100% автономно на вашому комп'ютері.
Жодні дані, файли чи паролі ніколи не передаються у хмару чи сторонні сервери.

Усі функції доступні як у терміналі (CLI), так і в контекстному меню файлового
менеджера Nautilus: клік правою кнопкою миші ➔ Скрипти ➔ 🔐 КЕП та Безпека.

================================================================================
1. ПІДПИСАННЯ ДОКУМЕНТІВ (КЕП / УЕП)
================================================================================
• PAdES (PDF зі штампом та QR-кодом):
  - Меню Nautilus: «✍️ Підписати (PAdES PDF зі штампом та QR)»
  - Опис: Накладає офіційний векторизований штамп та QR-код перевірки на
    останню сторінку. Створює файл «документ_signed.pdf».
  - Термінал: qes-sign --pades document.pdf

• PAdES (PDF без штампу та QR-коду):
  - Меню Nautilus: «✍️ Підписати (PAdES PDF без штампу та QR)»
  - Опис: Накладає чистий цифровий підпис без візуальних позначок на сторінках
    (невидимий підпис PAdES).
  - Термінал: qes-sign --pades --no-stamp document.pdf

• Мультипідписання (другий і наступні підписи):
  - Меню Nautilus: «✍️ Додати другий підпис (Мультипідпис)»
  - Опис: Додає підпис наступного підписанта без пошкодження попередніх
    підписів. Штампи в PDF автоматично розміщуються вертикально один над іншим.
  - Термінал: qes-sign --append document_signed.pdf

• Відокремлений підпис (.p7s):
  - Меню Nautilus: «✍️ Підписати (Відокремлений підпис .p7s)»
  - Опис: Створює файл «документ.p7s» поруч з оригіналом. Для тендерів
    Prozorro, судів, M.E.Doc, Вчасно та ЦЗО.
  - Термінал: qes-sign document.docx

• Пакетний контейнер ASiC-E (.asice):
  - Меню Nautilus: «📦 Підписати (Пакетний контейнер ASiC-E)»
  - Опис: Об'єднує виділені файли або папку у стандартизований європейський
    архів ETSI TS 102 918 з підписами всіх файлів.
  - Термінал: qes-sign --asice file1.pdf file2.xlsx -o bundle.asice

================================================================================
2. ПЕРЕВІРКА ПІДПИСІВ ТА СЕРТИФІКАТІВ
================================================================================
• Перевірка підпису КЕП:
  - Меню Nautilus: «🔍 Перевірити підпис КЕП»
  - Опис: Перевіряє чинність підпису, математичну цілісність, ПІБ підписувачів,
    РНОКПП, мітку точного часу TSP. Кнопка «Видобути документи» дозволяє
    дістати файли з архіву ASiC-E в 1 клік.
  - Термінал: qes-verify document_signed.pdf
              qes-verify bundle.asice

• Перегляд сертифіката КНЕДП:
  - Меню Nautilus: «📜 Переглянути сертифікат КНЕДП»
  - Опис: Показує всі реквізити сертифіката (.cer / .crt / .p7b) та надає
    кнопки швидкого копіювання до буфера обміну:
    * «Скопіювати РНОКПП»
    * «Скопіювати ЄДРПОУ»
    * «Скопіювати повні реквізити» (для позовних заяв та договорів)
  - Термінал: qes-cert cert.cer  (або qes-cert --gui cert.cer)

• Експорт сертифіката з ключа:
  - Термінал: qes-export-cert -o Мій_Сертифікат_КЕП.cer
  - Опис: Безпечно експортує відкритий сертифікат із закритого ключа (.pfx).

================================================================================
3. ОПТИЧНЕ РОЗПІЗНАВАННЯ ТЕКСТУ (OCR) ДЛЯ «ЕЛЕКТРОННОГО СУДУ»
================================================================================
• Чиста Англійська мова (1-клік):
  - Меню Nautilus: «👁️ Розпізнати текст OCR (🇬🇧 Чиста Англійська)»
  - Опис: Миттєве розпізнавання англомовних контрактів та інвойсів без діалогів.
  - Термінал: qes-ocr --eng contract.pdf  (або qes-ocr -e contract.pdf)

• Майстер розпізнавання (вибір мови):
  - Меню Nautilus: «👁️ Розпізнати текст OCR (Е-Суд)»
  - Опис: Дозволяє обрати мову: Англійська, Українська чи Двомовне (ukr+eng).
    Автоматично вирівнює перекошені сторінки, лінеаризує (Fast Web View)
    та перевіряє ліміт 50 МБ.
  - Термінал: qes-ocr --sidecar file.pdf  (зберігає розпізнаний текст у .txt)

================================================================================
4. КРИПТОГРАФІЧНИЙ СЕЙФ (ШИФРУВАННЯ ДСТУ 4145 / ГОСТ 28147:89)
================================================================================
• Особистий сейф:
  - Меню Nautilus: «🛡️ Зашифрувати в особистий сейф (.enc)»
  - Опис: Шифрує документ або папку виключно для вашого ключа. Відкрити
    зможете тільки ви.
  - Термінал: qes-encrypt private.pdf

• Шифрування для адресата:
  - Меню Nautilus: «📨 Зашифрувати для адресата (.enc)»
  - Опис: Оберіть відкритий сертифікат (.cer) клієнта, колеги або суду.
  - Термінал: qes-encrypt -r client.cer lawsuit.pdf

• Розшифрування:
  - Меню Nautilus: «🔓 Розшифрувати особистим КЕП»
  - Опис: Розшифровує файл за допомогою вашого закритого ключа та пароля.
  - Термінал: qes-decrypt file.enc

================================================================================
5. СУДОВА ОПТИМІЗАЦІЯ ДЛЯ «ЕЛЕКТРОННОГО СУДУ»
================================================================================
• Меню Nautilus: «⚖️ Оптимізувати PDF для Е-Суду»
• Опис: Стискає та лінеаризує PDF-файл, гарантуючи сумісність із вимогами
  підсистеми «Електронний суд» (обмеження 50 МБ, Fast Web View).
• Термінал: qes-pdf-court lawsuit_materials.pdf

================================================================================
6. БЕЗПЕКА ТА КЕШУВАННЯ ПАРОЛЯ В СЕСІЇ (SESSION TTL)
================================================================================
• Пароль кешується виключно в оперативній пам'яті (RAM tmpfs) на 15–30 хвилин.
• Жоден символ пароля чи ключа ніколи не записується на диск.
• Блокування сесії та очищення пам'яті:
  - Меню Nautilus: «🔒 Скинути кеш пароля (Заблокувати)»
  - Термінал: qes-agent clear  (перегляд стану: qes-agent status)

================================================================================
7. ЄДИНА КОМАНДА КЕРУВАННЯ ТА ДОВІДНИК QES-TOOL
================================================================================
• Перевірка поточної версії:
  $ qes-tool --version       (або qes-tool -v)
• Повна довідка з детальними прикладами:
  $ qes-tool --help          (або qes-tool -h)
• Перемикання мови меню Nautilus:
  $ qes-config --lang en     # Перемкнути на англійську (🔐 QES & Security)
  $ qes-config --lang uk     # Перемкнути на українську (🔐 КЕП та Безпека)
  $ qes-config --lang auto   # Автовизначення за мовою системи
• Прямі підкоманди через диспетчер:
  $ qes-tool sign [опції...]
  $ qes-tool verify [файл...]
  $ qes-tool encrypt [файл...]
  $ qes-tool decrypt [файл.enc]
  $ qes-tool cert [файл.cer]
  $ qes-tool agent [status|clear]
================================================================================
"
TITLE="Довідка та Інструкції — QES Tools (${VERSION})"
BTN_LABEL="Закрити"
EXTRA_BTN="Термінал: qes-tool --help"
TERMINAL_PROMPT="Натисніть Enter для виходу..."
fi

RES=$(echo -e "$HELP_TEXT" | zenity --text-info \
    --title="$TITLE" \
    --width=840 \
    --height=620 \
    --font="Sans 10" \
    --ok-label="$BTN_LABEL" \
    --extra-button="$EXTRA_BTN" 2>/dev/null || true)

if [[ "$RES" == "$EXTRA_BTN" ]]; then
    if command -v gnome-terminal >/dev/null 2>&1; then
        gnome-terminal -- bash -c "qes-tool --help; echo -e '\n${TERMINAL_PROMPT}'; read" &
    elif command -v x-terminal-emulator >/dev/null 2>&1; then
        x-terminal-emulator -e bash -c "qes-tool --help; read" &
    elif command -v xterm >/dev/null 2>&1; then
        xterm -hold -e "qes-tool --help" &
    fi
fi

