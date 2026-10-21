#!/usr/bin/env bash
# ==============================================================================
# 🔱 Підписати Гербом-Тризубом або Корпоративним Щитом (Marma-Universal v2.1)
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

EMBLEM="${MARMA_EMBLEM:-tryzub}"
RECIPIENT="${MARMA_RECIPIENT_ID:-}"

if [[ ${#FILES[@]} -eq 0 ]]; then
    if command -v zenity >/dev/null 2>&1; then
        CHOSEN=$(zenity --file-selection --multiple --separator="|" \
            --title="$(marma_text "Оберіть документи (.pdf, .svg) для печатки Тризуб / Щит" "Select documents (.pdf, .svg) for Trident / Shield seal")" \
            --file-filter="Документи (*.pdf, *.svg) | *.pdf *.PDF *.svg *.SVG" 2>/dev/null || true)
        [[ -n "$CHOSEN" ]] && IFS="|" read -ra FILES <<< "$CHOSEN" || exit 0
    else
        exit 0
    fi
fi

if [[ -z "${MARMA_EMBLEM:-}" ]] && command -v zenity >/dev/null 2>&1 && [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then
    CHOICE=$(zenity --list --radiolist \
        --title="$(marma_text "Вибір емблеми Marma-Universal v2.1" "Select Marma-Universal v2.1 Emblem")" \
        --column="" --column="ID" --column="$(marma_text "Векторна печатка (27 ступенів свободи)" "Vector Emblem (27 DOFs)")" \
        TRUE "tryzub" "$(marma_text "Малий Державний Герб України (Тризуб)" "Ukrainian State Trident (Tryzub)")" \
        FALSE "corporate-shield" "$(marma_text "Корпоративний щит (GOLAW / B2B / Банк)" "Corporate Heraldic Shield (B2B / LegalTech)")" \
        FALSE "sri-yantra" "$(marma_text "Канонічна Шрі Янтра (9 трикутників)" "Canonical Sri Yantra (9 Triangles)")" \
        --height=260 --width=540 2>/dev/null || echo "tryzub")
    [[ -n "$CHOICE" ]] && EMBLEM="$CHOICE"
fi

CMD_ARGS=(sign --emblem "$EMBLEM" --optical-ring)
[[ -n "$RECIPIENT" ]] && CMD_ARGS+=(--recipient-id "$RECIPIENT")
[[ -z "${MARMA_HEADLESS:-}" ]] && CMD_ARGS+=(--gui)

if marma-watermark "${CMD_ARGS[@]}" "${FILES[@]}" >/dev/null 2>&1; then
    marma_notify "document-edit" \
        "✅ Накладено печатку Marma-Universal (${EMBLEM})" \
        "✅ Applied Marma-Universal Seal (${EMBLEM})" \
        "Підписано ${#FILES[@]} документ(ів) із 32-секторним оптичним кільцем Lotus ECC." \
        "Signed ${#FILES[@]} document(s) with 32-sector Optical Lotus ECC ring."
else
    marma_notify "dialog-error" \
        "❌ Помилка підписання Marma-Universal" \
        "❌ Marma-Universal Signing Failed" \
        "Перевірте вхідний файл або параметри ключа." \
        "Check input file or key parameters."
    exit 1
fi
