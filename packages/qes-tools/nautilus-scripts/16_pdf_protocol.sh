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

GENERATED_PROTOCOLS=()
for f in "${VALID_FILES[@]}"; do
    base="${f%.*}"
    out_pdf="${base}_protocol.pdf"
    if qes-verify --protocol "$f" -o "$out_pdf" >/dev/null 2>&1 || [[ -s "$out_pdf" ]]; then
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
