#!/usr/bin/env bash
# ==============================================================================
# 📦 Пакетне штампування Deal-Room (N отримувачів + Canary Leak-Tracing)
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

if [[ ${#FILES[@]} -eq 0 ]]; then
    if command -v zenity >/dev/null 2>&1; then
        CHOSEN=$(zenity --file-selection \
            --title="$(marma_text "Оберіть майстер-документ PDF для розсилки у Deal-Room" "Select master PDF document for Deal-Room batch distribution")" \
            --file-filter="PDF (*.pdf) | *.pdf *.PDF" 2>/dev/null || true)
        [[ -n "$CHOSEN" ]] && FILES=("$CHOSEN") || exit 0
    else
        exit 0
    fi
fi

RECIPIENTS="${MARMA_RECIPIENTS:-}"
if [[ -z "$RECIPIENTS" ]] && command -v zenity >/dev/null 2>&1 && [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then
    RECIPIENTS=$(zenity --entry \
        --title="$(marma_text "Список отримувачів Deal-Room (Canary Leak-Tracing)" "Deal-Room Recipients List (Canary Leak-Tracing)")" \
        --text="$(marma_text "Введіть ідентифікатори отримувачів через кому:" "Enter comma-separated recipient IDs:")" \
        --entry-text="Investor_Alpha,Investor_Beta,Legal_Auditor_03,Board_Member_04" \
        --width=520 2>/dev/null || true)
fi
[[ -z "$RECIPIENTS" ]] && RECIPIENTS="Investor_Alpha,Investor_Beta,Legal_Auditor_03"

EMBLEM="${MARMA_EMBLEM:-tryzub}"
CMD_ARGS=(batch-seal --recipients "$RECIPIENTS" --emblem "$EMBLEM" --optical-ring)
[[ -n "${MARMA_OUTPUT_DIR:-}" ]] && CMD_ARGS+=(--output "${MARMA_OUTPUT_DIR}")
[[ -z "${MARMA_HEADLESS:-}" ]] && CMD_ARGS+=(--gui)

if marma-watermark "${CMD_ARGS[@]}" "${FILES[0]}" >/dev/null 2>&1; then
    marma_notify "folder-documents" \
        "✅ Deal-Room Пакет сформовано" \
        "✅ Deal-Room Batch Generated" \
        "Індивідуальні копії з маркерами Canary та Optical ECC збережено у підкаталог _dealroom_copies." \
        "Individualized copies with Canary & Optical ECC markers saved to _dealroom_copies subfolder."
else
    marma_notify "dialog-error" \
        "❌ Помилка пакетного штампування Deal-Room" \
        "❌ Deal-Room Batch Stamping Failed" \
        "Перевірте вхідний PDF-файл." \
        "Check the input PDF file."
    exit 1
fi
