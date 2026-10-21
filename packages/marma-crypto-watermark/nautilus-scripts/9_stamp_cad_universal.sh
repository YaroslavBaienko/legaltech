#!/usr/bin/env bash
# ==============================================================================
# 📐 Захистити креслення CAD/SVG (Marma-Universal 27-DOF)
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
        CHOSEN=$(zenity --file-selection --multiple --separator="|" \
            --title="$(marma_text "Оберіть векторне креслення (.svg, .pdf) для захисту CAD-полігоном" "Select vector drawing (.svg, .pdf) for CAD polygon protection")" \
            --file-filter="Креслення (*.svg, *.pdf) | *.svg *.SVG *.pdf *.PDF" 2>/dev/null || true)
        [[ -n "$CHOSEN" ]] && IFS="|" read -ra FILES <<< "$CHOSEN" || exit 0
    else
        exit 0
    fi
fi

CMD_ARGS=(sign --emblem cad-polygon --optical-ring)
[[ -n "${MARMA_RECIPIENT_ID:-}" ]] && CMD_ARGS+=(--recipient-id "${MARMA_RECIPIENT_ID}")
[[ -z "${MARMA_HEADLESS:-}" ]] && CMD_ARGS+=(--gui)

if marma-watermark "${CMD_ARGS[@]}" "${FILES[@]}" >/dev/null 2>&1; then
    marma_notify "document-edit" \
        "✅ Захищено креслення CAD/SVG (Marma-Universal)" \
        "✅ Protected CAD/SVG Drawing (Marma-Universal)" \
        "Вбудовано 266-бітний векторний підпис (крок 18 npt) у ${#FILES[@]} файл(ів)." \
        "Embedded 266-bit sub-micron vector signature (18 npt step) in ${#FILES[@]} file(s)."
else
    marma_notify "dialog-error" \
        "❌ Помилка захисту креслення CAD/SVG" \
        "❌ CAD/SVG Protection Failed" \
        "Не вдалося накласти підпис Marma-Universal." \
        "Failed to apply Marma-Universal signature."
    exit 1
fi
