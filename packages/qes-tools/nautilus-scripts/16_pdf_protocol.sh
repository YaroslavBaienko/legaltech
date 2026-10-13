#!/usr/bin/env bash
# ==============================================================================
# 📄 Сформувати PDF-протокол перевірки КЕП / Generate PDF Verification Protocol
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

FILES=()
if [[ -n "${NAUTILUS_SCRIPT_SELECTED_FILE_PATHS:-}" ]]; then
    while IFS= read -r line; do
        [[ -n "$line" ]] && FILES+=("$line")
    done <<< "$NAUTILUS_SCRIPT_SELECTED_FILE_PATHS"
else
    FILES=("$@")
fi

VALID_FILES=()
for f in "${FILES[@]}"; do
    if [[ -f "$f" ]]; then
        case "${f,,}" in
            *.pdf|*.p7s|*.asice|*.asics)
                VALID_FILES+=("$f")
                ;;
        esac
    fi
done

if [[ ${#VALID_FILES[@]} -eq 0 ]]; then
    qes_warn_dialog \
        "PDF-протокол перевірки КЕП" \
        "QES PDF Verification Protocol" \
        "Оберіть підписаний документ (.pdf), контейнер (.asice) або файл підпису (.p7s) для формування офіційного PDF-протоколу перевірки та ланцюга сертифікатів." \
        "Select a signed document (.pdf), container (.asice) or signature file (.p7s) to generate an official PDF verification and certificate chain protocol."
    exit 0
fi

PROTO_LANG="${QES_LANG:-uk}"

if [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]] && [[ "${QES_NONINTERACTIVE:-0}" != "1" ]] && command -v zenity >/dev/null 2>&1; then
    PAPIRUS_ICON=""
    if [[ -f "$HOME/.local/share/icons/Papirus/48x48/mimetypes/application-certificate.svg" ]]; then
        PAPIRUS_ICON="$HOME/.local/share/icons/Papirus/48x48/mimetypes/application-certificate.svg"
    elif [[ -f "/usr/share/icons/Papirus/48x48/mimetypes/application-certificate.svg" ]]; then
        PAPIRUS_ICON="/usr/share/icons/Papirus/48x48/mimetypes/application-certificate.svg"
    fi

    if [[ "${QES_LANG:-uk}" == "en" ]]; then
        DLG_TITLE="PDF Protocol Language — QES Tools"
        DLG_TEXT="<span size='larger' weight='bold' color='#1a5fb4'>📄 Generate Official QES Verification PDF Protocol</span>\n\nSelect the language for the generated PDF protocol (with full QTSP ➔ Root CA CZO trust chain):\n<span size='small' color='#666666'>Оберіть мову формування офіційного PDF-протоколу перевірки КЕП та ланцюжка сертифікатів:</span>"
        COL_PICK="Select"
        COL_LANG="Protocol Language / Мова протоколу"
        OK_LBL="📄 Generate PDF"
        CANCEL_LBL="Cancel"
        UK_DEF="FALSE"
        EN_DEF="TRUE"
    else
        DLG_TITLE="Мова PDF-протоколу — QES Tools"
        DLG_TEXT="<span size='larger' weight='bold' color='#1a5fb4'>📄 Формування офіційного PDF-протоколу перевірки КЕП</span>\n\nОберіть мову документа (протокол із повним ланцюжком сертифікатів КНЕДП ➔ ЦЗО):\n<span size='small' color='#666666'>Select the language for the official QES &amp; LTV Trust Chain Verification Protocol:</span>"
        COL_PICK="Вибір"
        COL_LANG="Мова протоколу / Protocol Language"
        OK_LBL="📄 Сформувати PDF"
        CANCEL_LBL="Скасувати"
        UK_DEF="TRUE"
        EN_DEF="FALSE"
    fi

    ZEN_ARGS=(
        --list --radiolist
        --title="$DLG_TITLE"
        --text="$DLG_TEXT"
        --column="$COL_PICK" --column="Code" --column="$COL_LANG"
        "$UK_DEF" "uk" "🇺🇦 Українська (UA) — Протокол перевірки КЕП (ДСТУ 4145-2002 / Закон України)"
        "$EN_DEF" "en" "🇬🇧 English (EN) — QES & LTV Verification Protocol (eIDAS / International)"
        --hide-column=2 --print-column=2
        --ok-label="$OK_LBL"
        --cancel-label="$CANCEL_LBL"
        --icon-name="application-pdf"
        --width=680 --height=310
    )
    [[ -n "$PAPIRUS_ICON" ]] && ZEN_ARGS+=(--window-icon="$PAPIRUS_ICON")

    CHOSEN_LANG="$(zenity "${ZEN_ARGS[@]}" 2>/dev/null || true)"
    if [[ -z "$CHOSEN_LANG" ]]; then
        exit 0
    fi
    PROTO_LANG="$CHOSEN_LANG"
fi

GENERATED_PROTOCOLS=()
for f in "${VALID_FILES[@]}"; do
    base="${f%.*}"
    out_pdf="${base}_protocol.pdf"
    if qes-verify --protocol --lang "$PROTO_LANG" "$f" -o "$out_pdf" >/dev/null 2>&1 || [[ -s "$out_pdf" ]]; then
        GENERATED_PROTOCOLS+=("$out_pdf")
    fi
done

if [[ ${#GENERATED_PROTOCOLS[@]} -gt 0 ]]; then
    qes_notify "document-send" \
        "📄 PDF-протокол перевірки КЕП створено" \
        "📄 QES PDF Verification Protocol Generated" \
        "Сформовано офіційний PDF-протокол з ланцюгом сертифікатів КНЕДП/ЦЗО: $(basename "${GENERATED_PROTOCOLS[0]}")" \
        "Generated official PDF protocol with QTSP/Root CA trust chain: $(basename "${GENERATED_PROTOCOLS[0]}")"
    if [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]] && command -v xdg-open >/dev/null 2>&1; then
        xdg-open "${GENERATED_PROTOCOLS[0]}" >/dev/null 2>&1 &
    fi
else
    qes_notify "dialog-error" \
        "❌ Помилка створення PDF-протоколу" \
        "❌ PDF Protocol Generation Failed" \
        "Не вдалося сформувати PDF-протокол перевірки КЕП (перевірте наявність підпису у файлі)." \
        "Could not generate QES verification PDF protocol (check if the file contains a digital signature)."
    exit 1
fi
