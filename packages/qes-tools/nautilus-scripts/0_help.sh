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
elif [[ -f "${SCRIPT_DIR}/../.i18n.sh" ]]; then
    source "${SCRIPT_DIR}/../.i18n.sh"
elif [[ -f "${SCRIPT_DIR}/../_i18n.sh" ]]; then
    source "${SCRIPT_DIR}/../_i18n.sh"
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
    echo "${v:-1.0.16}"
}
VERSION="$(get_version)"
[[ "$VERSION" != v* ]] && VERSION="v${VERSION}"

if [[ "$QES_LANG" == "en" ]]; then
HELP_TEXT="================================================================================
📖 QES TOOLS USER GUIDE & DOCUMENTATION (${VERSION})
================================================================================
Suite Version: ${VERSION}
100% Offline-First | DSTU 4145-2002 | PAdES-LTA | CAdES-LTA | ASiC-E | GOST 28147:89
================================================================================

OVERVIEW:
QES Tools is a 100% offline-first cryptographic suite for Ukrainian Qualified
Electronic Signatures (QES / DSTU 4145-2002), Archival LTV (PAdES-LTA / CAdES-LTA
for 25+ years), Official PDF Verification & Trust Chain Protocols (UA / EN),
asymmetric encryption (GOST 28147:89), and Ukrainian E-Court document workflows.

All cryptographic operations run entirely on your local workstation without
transmitting files, keys, or passwords to any external cloud server.

GNOME FILES (NAUTILUS) CONTEXT MENU STRUCTURE (5 GNOME HIG CATEGORIES):
Right-click on file(s) ➔ Scripts ➔ 🔐 QES & Security:
  1. ✍️ Signing
  2. 🔍 Verification & Certificates
  3. ⚖️ Court & OCR
  4. 🛡️ Encryption & Vault
  5. ⚙️ Management & Help

================================================================================
1. ✍️ SIGNING (QES / AES / PAdES-LTA / CAdES-LTA / ASiC-E)
================================================================================
• Sign PDF (with Stamp & QR):
  - Nautilus: 🔐 QES & Security ➔ ✍️ Signing ➔ Sign PDF (with Stamp & QR)
  - Description: Embeds a cryptographic PAdES-LTA signature, vector attorney
    stamp, verification QR code, TSP timestamp, and archival LTV (/DSS) onto
    the PDF. Produces: document_signed.pdf
  - CLI: qes-sign --pades document.pdf

• Sign PDF (without Stamp):
  - Nautilus: 🔐 QES & Security ➔ ✍️ Signing ➔ Sign PDF (without Stamp)
  - Description: Applies an invisible cryptographic PAdES-LTA signature without
    modifying visual page content.
  - CLI: qes-sign --pades --no-stamp document.pdf

• Sign with Detached File (.p7s):
  - Nautilus: 🔐 QES & Security ➔ ✍️ Signing ➔ Sign with Detached File (.p7s)
  - Description: Creates a detached CAdES-LTA signature file «document.p7s»
    alongside the original file (Prozorro, courts, M.E.Doc, Vchasno).
  - CLI: qes-sign document.docx

• Sign Package Container (ASiC-E):
  - Nautilus: 🔐 QES & Security ➔ ✍️ Signing ➔ Sign Package Container (ASiC-E)
  - Description: Bundles multiple selected files or folders into an ETSI TS 102 918
    (.asice) archive signed with QES and archival LTV evidence.
  - CLI: qes-sign --asice file1.pdf file2.xlsx -o bundle.asice

• Add Second Signature (Multi-Sign):
  - Nautilus: 🔐 QES & Security ➔ ✍️ Signing ➔ Add Second Signature (Multi-Sign)
  - Description: Appends an additional signature to an already signed PDF,
    ASiC-E, or .p7s without invalidating previous signatures.
  - CLI: qes-sign --append document_signed.pdf

• Batch Sign Folder:
  - Nautilus: 🔐 QES & Security ➔ ✍️ Signing ➔ Batch Sign Folder
  - Description: Signs all documents inside a selected folder in a single pass.

================================================================================
2. 🔍 VERIFICATION, PDF PROTOCOLS & CERTIFICATES
================================================================================
• Verify QES Signature:
  - Nautilus: 🔐 QES & Security ➔ 🔍 Verification & Certificates ➔ Verify QES Signature
  - Description: Validates signature integrity, signer identity (Name, Tax ID,
    USREOU), TSP timestamp, Archival LTV status (25+ years), and full
    Certificate Trust Chain ([1] Signer ➔ [2] Accredited QTSP ➔ [3] Root CA CZO).
    Includes «📄 Save PDF Protocol» button (with 🇺🇦 UA / 🇬🇧 EN language choice)
    and «Extract Documents» for ASiC-E archives.
  - CLI: qes-verify document_signed.pdf
         qes-verify --gui document_signed.pdf

• Generate PDF Verification Protocol (UA / EN):
  - Nautilus: 🔐 QES & Security ➔ 🔍 Verification & Certificates ➔ Generate PDF Verification Protocol
  - Description: Prompts to choose the protocol language (🇺🇦 Ukrainian UA or
    🇬🇧 English EN) and generates a standalone, print-ready vector PDF protocol
    (<file>_protocol.pdf) with SHA-256 digest, signer requisites, TSP/LTV
    status, and the full 3-tier CA Certificate Trust Chain table.
  - CLI: qes-verify --protocol --lang ua document_signed.pdf
         qes-verify --protocol --lang en document_signed.pdf
         qes-tool protocol --lang ua document_signed.pdf

• Upgrade to Archival LTV (PAdES-LTA, 25 Years):
  - Nautilus: 🔐 QES & Security ➔ 🔍 Verification & Certificates ➔ Upgrade to Archival LTV (PAdES-LTA, 25 Years)
  - Description: Keylessly upgrades any existing signed document (.pdf, .p7s,
    .asice) to archival LTV (embeds full CA chain, live OCSP status, and PDF
    /DSS + /VRI dictionary) without needing a private key or password.
  - CLI: qes-sign --upgrade-ltv document_signed.pdf
         qes-tool ltv document_signed.pdf

• View CA Certificate Details:
  - Nautilus: 🔐 QES & Security ➔ 🔍 Verification & Certificates ➔ View CA Certificate Details
  - Description: Inspects certificates (.cer, .crt, .p7b) with 1-click buttons
    to copy Tax ID, USREOU, or formatted legal requisites to the clipboard.
  - CLI: qes-cert cert.cer  (or qes-cert --gui cert.cer)

• Export Public Certificate (.cer):
  - Nautilus: 🔐 QES & Security ➔ 🔍 Verification & Certificates ➔ Export Public Certificate (.cer)
  - CLI: qes-export-cert -o my_cert.cer

================================================================================
3. ⚖️ COURT & OCR (ELECTRONIC COURT WORKFLOWS)
================================================================================
• Prepare Document for E-Court (All-in-One):
  - Nautilus: 🔐 QES & Security ➔ ⚖️ Court & OCR ➔ Prepare Document for E-Court (All-in-One)
  - Description: Runs OCR text layer recognition + court PDF optimization (<50MB)
    + PAdES-LTA signing in one guided workflow.

• Optimize PDF for E-Court (<50 MB):
  - Nautilus: 🔐 QES & Security ➔ ⚖️ Court & OCR ➔ Optimize PDF for E-Court (<50 MB)
  - CLI: qes-pdf-court lawsuit_evidence.pdf

• OCR Text Recognition (Choose Language / Pure English):
  - Nautilus: 🔐 QES & Security ➔ ⚖️ Court & OCR ➔ OCR Text Recognition (Choose Language)
              🔐 QES & Security ➔ ⚖️ Court & OCR ➔ OCR Text Recognition (Pure English)
  - CLI: qes-ocr --sidecar document.pdf
         qes-ocr --eng contract.pdf

================================================================================
4. 🛡️ ENCRYPTION & VAULT (DSTU 4145 / GOST 28147:89)
================================================================================
• Encrypt to Personal Vault (.enc):
  - Nautilus: 🔐 QES & Security ➔ 🛡️ Encryption & Vault ➔ Encrypt to Personal Vault (.enc)
  - CLI: qes-encrypt private.pdf

• Encrypt for Recipient (.cer -> .enc):
  - Nautilus: 🔐 QES & Security ➔ 🛡️ Encryption & Vault ➔ Encrypt for Recipient (.cer -> .enc)
  - CLI: qes-encrypt -r recipient.cer contract.pdf

• Decrypt File (.enc):
  - Nautilus: 🔐 QES & Security ➔ 🛡️ Encryption & Vault ➔ Decrypt File (.enc)
  - CLI: qes-decrypt document.pdf.enc

================================================================================
5. ⚙️ MANAGEMENT, HARDWARE TOKENS & HELP
================================================================================
• Clear Password Cache (Lock Session):
  - Nautilus: 🔐 QES & Security ➔ ⚙️ Management & Help ➔ Clear Password Cache (Lock Session)
  - CLI: qes-agent clear  (status: qes-agent status)

• Hardware Token Diagnostics (USB):
  - Nautilus: 🔐 QES & Security ➔ ⚙️ Management & Help ➔ Hardware Token Diagnostics (USB)
  - CLI: qes-tool token  (or qes-cert --tokens)

• Master CLI & Configuration (qes-tool / qes-config):
  $ qes-tool --version                  # Check suite version (${VERSION})
  $ qes-tool --help                     # Full CLI manual & examples
  $ qes-tool protocol --lang en doc.pdf # Generate English PDF protocol
  $ qes-tool ltv doc_signed.pdf         # Keyless archival LTV upgrade
  $ qes-config --lang en                # English menu (🔐 QES & Security)
  $ qes-config --lang uk                # Ukrainian menu (🔐 КЕП та Безпека)
  $ qes-config --layout categorized     # 5 GNOME HIG category submenus
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
100% Offline-First | ДСТУ 4145-2002 | PAdES-LTA | CAdES-LTA | ASiC-E | ГОСТ 28147:89
================================================================================

ОПИС КОМПЛЕКСУ:
QES Tools — це автономний комплекс для роботи з кваліфікованим електронним
підписом (КЕП / ДСТУ 4145-2002), архівною валідацією LTV (PAdES-LTA / CAdES-LTA
на 25+ років), офіційними PDF-протоколами перевірки КЕП та ланцюгів сертифікатів
двома мовами (🇺🇦 UA / 🇬🇧 EN), шифруванням файлів (ГОСТ 28147:89) та судовою
підсистемою «Електронний суд».

Усі криптографічні операції виконуються 100% автономно на вашому комп'ютері.
Жодні дані, файли чи паролі ніколи не передаються у хмару чи сторонні сервери.

СТРУКТУРА МЕНЮ NAUTILUS (5 КАТЕГОРІЙ ЗА СТАНДАРТОМ GNOME HIG):
Правий клік мишею на файлі ➔ Скрипти ➔ 🔐 КЕП та Безпека:
  1. ✍️ Підписання
  2. 🔍 Перевірка та Сертифікати
  3. ⚖️ Суд та OCR
  4. 🛡️ Шифрування та Сховище
  5. ⚙️ Керування та Довідка

================================================================================
1. ✍️ ПІДПИСАННЯ ДОКУМЕНТІВ (КЕП / УЕП / PAdES-LTA / CAdES-LTA / ASiC-E)
================================================================================
• Підписати PDF (зі штампом та QR):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ ✍️ Підписання ➔ Підписати PDF (зі штампом та QR)
  - Опис: Накладає вбудований підпис PAdES-LTA, офіційний векторний штамп,
    QR-код перевірки, мітку часу TSP та архівний словник LTV (/DSS) на останню
    сторінку. Створює файл «документ_signed.pdf».
  - Термінал: qes-sign --pades document.pdf

• Підписати PDF (без штампа):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ ✍️ Підписання ➔ Підписати PDF (без штампа)
  - Опис: Накладає чистий криптографічний підпис PAdES-LTA без візуальних
    позначок на сторінках.
  - Термінал: qes-sign --pades --no-stamp document.pdf

• Підписати окремим файлом (.p7s):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ ✍️ Підписання ➔ Підписати окремим файлом (.p7s)
  - Опис: Створює відокремлений підпис CAdES-LTA «документ.p7s» поруч з
    оригіналом (для Prozorro, судів, M.E.Doc, Вчасно та ЦЗО).
  - Термінал: qes-sign document.docx

• Підписати контейнер (ASiC-E):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ ✍️ Підписання ➔ Підписати контейнер (ASiC-E)
  - Опис: Об'єднує виділені файли або папку у стандартизований європейський
    архів ETSI TS 102 918 (.asice) з підписами та архівними доказами LTV.
  - Термінал: qes-sign --asice file1.pdf file2.xlsx -o bundle.asice

• Додати другий підпис (Мультипідпис):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ ✍️ Підписання ➔ Додати другий підпис (Мультипідпис)
  - Опис: Додає підпис наступного підписанта без пошкодження попередніх підписів.
  - Термінал: qes-sign --append document_signed.pdf

• Пакетно підписати папку:
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ ✍️ Підписання ➔ Пакетно підписати папку
  - Опис: Пакетно підписує всі документи у вибраній теці за один прохід.

================================================================================
2. 🔍 ПЕРЕВІРКА ПІДПИСІВ, PDF-ПРОТОКОЛИ ТА СЕРТИФІКАТИ
================================================================================
• Перевірити КЕП (Детальний звіт):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ 🔍 Перевірка та Сертифікати ➔ Перевірити КЕП (Детальний звіт)
  - Опис: Перевіряє чинність підпису, математичну цілісність, ПІБ, РНОКПП,
    мітку часу TSP, архівний статус LTV (25+ років) та повний ланцюг довіри
    сертифікатів ([1] Підписувач ➔ [2] КНЕДП ➔ [3] Кореневий ЦЗО). Містить
    кнопку «📄 Зберегти PDF-протокол» (з вибором мови 🇺🇦 UA або 🇬🇧 EN) та
    «Видобути документи» (для архівів ASiC-E).
  - Термінал: qes-verify document_signed.pdf
              qes-verify --gui document_signed.pdf

• Сформувати PDF-протокол перевірки КЕП (UA / EN):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ 🔍 Перевірка та Сертифікати ➔ Сформувати PDF-протокол перевірки КЕП
  - Опис: Наступним кроком пропонує обрати мову протоколу (🇺🇦 Українська UA або
    🇬🇧 English EN) та формує окремий друкований векторний PDF-протокол
    (<файл>_protocol.pdf) із SHA-256 гешем документа, реквізитами підписувача,
    статусом TSP/LTV і таблицею повного ланцюга сертифікатів (Підписувач ➔ КНЕДП ➔ ЦЗО).
  - Термінал: qes-verify --protocol --lang ua document_signed.pdf
              qes-verify --protocol --lang en document_signed.pdf
              qes-tool protocol --lang ua document_signed.pdf

• Додати архівну LTV-мітку (PAdES-LTA, 25 років):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ 🔍 Перевірка та Сертифікати ➔ Додати архівну LTV-мітку (PAdES-LTA, 25 років)
  - Опис: Автоматично вшиває у вже підписаний документ (.pdf, .p7s, .asice)
    повний ланцюжок сертифікатів КНЕДП/ЦЗО, статус OCSP та словник PDF /DSS
    без потреби в особистому ключі чи паролі.
  - Термінал: qes-sign --upgrade-ltv document_signed.pdf
              qes-tool ltv document_signed.pdf

• Переглянути сертифікат ЦСК:
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ 🔍 Перевірка та Сертифікати ➔ Переглянути сертифікат ЦСК
  - Опис: Показує всі реквізити сертифіката (.cer / .crt / .p7b) та кнопки
    копіювання РНОКПП, ЄДРПОУ або повних реквізитів до буфера обміну.
  - Термінал: qes-cert cert.cer  (або qes-cert --gui cert.cer)

• Експортувати мій сертифікат (.cer):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ 🔍 Перевірка та Сертифікати ➔ Експортувати мій сертифікат (.cer)
  - Термінал: qes-export-cert -o Мій_Сертифікат_КЕП.cer

================================================================================
3. ⚖️ СУД ТА OCR (ПІДСИСТЕМА «ЕЛЕКТРОННИЙ СУД»)
================================================================================
• Підготувати документ до Е-Суду (Все-в-одному):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ ⚖️ Суд та OCR ➔ Підготувати документ до Е-Суду (Все-в-одному)
  - Опис: Поєднує OCR-розпізнавання + судову оптимізацію (<50 МБ) + накладання
    КЕП PAdES-LTA в один автоматизований процес.

• Оптимізувати PDF для Е-Суду (<50 МБ):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ ⚖️ Суд та OCR ➔ Оптимізувати PDF для Е-Суду (<50 МБ)
  - Термінал: qes-pdf-court lawsuit_materials.pdf

• Розпізнати текст OCR (Вибір мови / Чиста Англійська):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ ⚖️ Суд та OCR ➔ Розпізнати текст OCR (Вибір мови)
                   🔐 КЕП та Безпека ➔ ⚖️ Суд та OCR ➔ Розпізнати текст OCR (Чиста Англійська)
  - Термінал: qes-ocr --sidecar file.pdf
              qes-ocr --eng contract.pdf

================================================================================
4. 🛡️ ШИФРУВАННЯ ТА СХОВИЩЕ (ДСТУ 4145 / ГОСТ 28147:89)
================================================================================
• Зашифрувати в особистий сейф (.enc):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ 🛡️ Шифрування та Сховище ➔ Зашифрувати в особистий сейф (.enc)
  - Термінал: qes-encrypt private.pdf

• Зашифрувати для отримувача (.cer -> .enc):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ 🛡️ Шифрування та Сховище ➔ Зашифрувати для отримувача (.cer -> .enc)
  - Термінал: qes-encrypt -r client.cer lawsuit.pdf

• Розшифрувати файл (.enc):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ 🛡️ Шифрування та Сховище ➔ Розшифрувати файл (.enc)
  - Термінал: qes-decrypt file.enc

================================================================================
5. ⚙️ КЕРУВАННЯ, АПАРАТНІ ТОКЕНИ ТА ДОВІДКА
================================================================================
• Очистити кеш пароля (Заблокувати):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ ⚙️ Керування та Довідка ➔ Очистити кеш пароля (Заблокувати)
  - Термінал: qes-agent clear  (перегляд стану: qes-agent status)

• Діагностика апаратного токена (USB):
  - Меню Nautilus: 🔐 КЕП та Безпека ➔ ⚙️ Керування та Довідка ➔ Діагностика апаратного токена (USB)
  - Термінал: qes-tool token  (або qes-cert --tokens)

• Головна команда керування (qes-tool / qes-config):
  $ qes-tool --version                  # Перевірка версії (${VERSION})
  $ qes-tool --help                     # Повна довідка CLI з прикладами
  $ qes-tool protocol --lang ua doc.pdf # PDF-протокол українською мовою
  $ qes-tool protocol --lang en doc.pdf # PDF-протокол англійською мовою
  $ qes-tool ltv doc_signed.pdf         # Додати архівну LTV-мітку без ключа
  $ qes-config --lang uk                # Меню українською (🔐 КЕП та Безпека)
  $ qes-config --lang en                # Меню англійською (🔐 QES & Security)
  $ qes-config --layout categorized     # 5 тематичних категорій GNOME HIG
================================================================================
"
TITLE="Довідка та Інструкції — QES Tools (${VERSION})"
BTN_LABEL="Закрити"
EXTRA_BTN="Термінал: qes-tool --help"
TERMINAL_PROMPT="Натисніть Enter для виходу..."
fi

HELP_ZEN_ARGS=(
    --text-info
    --title="$TITLE"
    --width=860
    --height=640
    --font="Sans 10"
    --ok-label="$BTN_LABEL"
    --extra-button="$EXTRA_BTN"
    --icon-name="help-browser"
)
local_cert_icon="${XDG_DATA_HOME:-$HOME/.local/share}/icons/Papirus/48x48/mimetypes/application-certificate.svg"
if [[ -f "$local_cert_icon" ]]; then
    HELP_ZEN_ARGS+=(--window-icon="$local_cert_icon")
elif [[ -f "/usr/share/icons/Papirus/48x48/mimetypes/application-certificate.svg" ]]; then
    HELP_ZEN_ARGS+=(--window-icon="/usr/share/icons/Papirus/48x48/mimetypes/application-certificate.svg")
fi

RES=$(echo -e "$HELP_TEXT" | zenity "${HELP_ZEN_ARGS[@]}" 2>/dev/null || true)

if [[ "$RES" == "$EXTRA_BTN" ]]; then
    if command -v gnome-terminal >/dev/null 2>&1; then
        gnome-terminal -- bash -c "qes-tool --help; echo -e '\n${TERMINAL_PROMPT}'; read" &
    elif command -v x-terminal-emulator >/dev/null 2>&1; then
        x-terminal-emulator -e bash -c "qes-tool --help; read" &
    elif command -v xterm >/dev/null 2>&1; then
        xterm -hold -e "qes-tool --help" &
    fi
fi

