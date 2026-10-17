#!/usr/bin/env bash
# ==============================================================================
# 📄 Сформувати PDF-протокол перевірки Marma-Crypto / Generate PDF Verification Protocol
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for p in "${SCRIPT_DIR}/.i18n.sh" "${SCRIPT_DIR}/_i18n.sh" "${SCRIPT_DIR}/../.i18n.sh" "/usr/share/marma-crypto-watermark/nautilus-scripts/_i18n.sh"; do
    [[ -f "$p" ]] && { source "$p"; break; }
done

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
            *.pdf|*.docx|*.svg) VALID_FILES+=("$f") ;;
            *.p7s)
                [[ -f "${f%.p7s}" ]] && VALID_FILES+=("${f%.p7s}")
                ;;
            *)
                [[ -f "${f%.*}.pdf" ]] && VALID_FILES+=("${f%.*}.pdf")
                ;;
        esac
    fi
done

if [[ ${#VALID_FILES[@]} -eq 0 ]]; then
    marma_warn_dialog \
        "PDF-протокол перевірки Marma-Crypto" \
        "Marma-Crypto PDF Verification Protocol" \
        "Оберіть підписаний документ (.pdf, .docx, .svg) для формування офіційного PDF-протоколу перевірки 9 трикутників Шрі Янтри." \
        "Select a signed document (.pdf, .docx, .svg) to generate an official 9-triangle Sri Yantra verification PDF protocol."
    exit 0
fi

PROTO_LANG="${MARMA_LANG:-uk}"
if [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]] && command -v zenity >/dev/null 2>&1; then
    CHOSEN_LANG=$(zenity --list --radiolist \
        --title="Мова PDF-протоколу — Marma-Crypto" \
        --text="<b>📄 Формування офіційного PDF-протоколу перевірки Marma-Crypto</b>\n\nОберіть мову документа (з таблицею координат 9 трикутників та SHA-256 / HMAC-SHA256):" \
        --column="Вибір" --column="Code" --column="Мова протоколу / Protocol Language" \
        "TRUE" "uk" "🇺🇦 Українська (UA) — Офіційний протокол перевірки Шрі Янтри (Marma-Crypto)" \
        "FALSE" "en" "🇬🇧 English (EN) — Sri Yantra Geometric Signature Verification Protocol" \
        --hide-column=2 --print-column=2 --width=660 --height=290 2>/dev/null || true)
    [[ -z "$CHOSEN_LANG" ]] && exit 0
    PROTO_LANG="$CHOSEN_LANG"
fi

if marma-watermark protocol --lang "$PROTO_LANG" --open "${VALID_FILES[@]}" >/dev/null 2>&1; then
    marma_notify "document-send" \
        "📄 PDF-протокол перевірки створено" \
        "📄 Verification PDF Protocol Generated" \
        "Сформовано офіційний PDF-протокол перевірки 9 трикутників Шрі Янтри." \
        "Generated official 9-triangle Sri Yantra verification PDF protocol."
fi
