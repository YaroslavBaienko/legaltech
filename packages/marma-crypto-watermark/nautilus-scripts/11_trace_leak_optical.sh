#!/usr/bin/env bash
# ==============================================================================
# 🕵️ Розшук джерела витоку (PDF / DOCX / SVG / Фото екрана Marma-Optical)
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
            --title="$(marma_text "Оберіть злитий файл або фото екрана (.pdf, .png, .jpg, .svg, .docx)" "Select leaked document or screen photo (.pdf, .png, .jpg, .svg, .docx)")" \
            --file-filter="Файли та знімки (*.pdf, *.png, *.jpg, *.jpeg, *.svg, *.docx) | *.pdf *.PDF *.png *.PNG *.jpg *.JPG *.jpeg *.JPEG *.svg *.SVG *.docx *.DOCX" 2>/dev/null || true)
        [[ -n "$CHOSEN" ]] && FILES=("$CHOSEN") || exit 0
    else
        exit 0
    fi
fi

SUSPECTS="${MARMA_SUSPECTS:-}"
if [[ -z "$SUSPECTS" ]] && command -v zenity >/dev/null 2>&1 && [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then
    SUSPECTS=$(zenity --entry \
        --title="$(marma_text "Підозрювані отримувачі (Canary / Optical Trace)" "Suspect Recipients (Canary / Optical Trace)")" \
        --text="$(marma_text "Введіть список підозрюваних ID через кому:" "Enter comma-separated suspect IDs:")" \
        --entry-text="Investor_Alpha,Investor_Beta,Legal_Auditor_03,Board_Member_04" \
        --width=520 2>/dev/null || true)
fi
[[ -z "$SUSPECTS" ]] && SUSPECTS="Investor_Alpha,Investor_Beta,Legal_Auditor_03,Board_Member_04"

CMD_ARGS=(trace --suspects "$SUSPECTS")
[[ -n "${MARMA_CONTENT_SHA256:-}" ]] && CMD_ARGS+=(--content-sha256 "${MARMA_CONTENT_SHA256}")

OUT_JSON=$(marma-watermark "${CMD_ARGS[@]}" "${FILES[0]}")
echo "$OUT_JSON"

MATCHED=$(python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(d.get("matched_recipient") or "НЕ ЗНАЙДЕНО / NONE")' <<< "$OUT_JSON" 2>/dev/null || echo "UNKNOWN")
WORD=$(python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(d.get("canary_beacon_word") or 0)' <<< "$OUT_JSON" 2>/dev/null || echo "0")

marma_notify "security-high" \
    "🕵️ Результат трасування витоку: ${MATCHED}" \
    "🕵️ Leak Attribution Result: ${MATCHED}" \
    "Вилучено маяк Canary #${WORD}. Збіг із підозрюваним: ${MATCHED}." \
    "Extracted Canary Beacon #${WORD}. Matched suspect: ${MATCHED}."

if [[ -z "${MARMA_HEADLESS:-}" ]] && command -v zenity >/dev/null 2>&1 && [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then
    zenity --info \
        --title="$(marma_text "Криміналістичний звіт Marma-Crypto (Vector + Optical)" "Marma-Crypto Forensic Report (Vector + Optical)")" \
        --text="$(marma_text "<b>Джерело витоку встановлено:</b> ${MATCHED}\n<b>Canary Beacon Word:</b> ${WORD}\n<b>Файл:</b> $(basename "${FILES[0]}")" "<b>Identified Leaker:</b> ${MATCHED}\n<b>Canary Beacon Word:</b> ${WORD}\n<b>File:</b> $(basename "${FILES[0]}")")" \
        --width=480 2>/dev/null || true
fi
