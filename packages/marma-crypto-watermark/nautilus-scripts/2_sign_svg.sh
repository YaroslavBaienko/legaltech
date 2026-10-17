#!/usr/bin/env bash
# ==============================================================================
# 📐 Згенерувати еталонну підписану Шрі Янтру (.svg) / Generate Signed Sri Yantra (.svg)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for p in "${SCRIPT_DIR}/.i18n.sh" "${SCRIPT_DIR}/_i18n.sh" "${SCRIPT_DIR}/../.i18n.sh" "/usr/share/marma-crypto-watermark/nautilus-scripts/_i18n.sh"; do
    [[ -f "$p" ]] && { source "$p"; break; }
done

TARGET_DIR="$PWD"
if [[ -n "${NAUTILUS_SCRIPT_CURRENT_URI:-}" && "${NAUTILUS_SCRIPT_CURRENT_URI}" == file://* ]]; then
    TARGET_DIR="$(python3 -c "import urllib.parse, sys; print(urllib.parse.unquote(sys.argv[1][7:]))" "$NAUTILUS_SCRIPT_CURRENT_URI")"
fi

OUT_SVG="${TARGET_DIR}/sri_yantra_marma_signed.svg"
if marma-watermark --sign-svg "$OUT_SVG" --gui >/dev/null 2>&1; then
    marma_notify "image-x-generic" \
        "📐 Згенеровано підписану Шрі Янтру (.svg)" \
        "📐 Generated Signed Sri Yantra (.svg)" \
        "Створено еталонний криптографічний вектор: $(basename "$OUT_SVG")" \
        "Created canonical cryptographically signed SVG: $(basename "$OUT_SVG")"
fi
