#!/usr/bin/env bash
# ==============================================================================
# _i18n.sh — Спільний модуль локалізації для Nautilus-скриптів Marma-Crypto
# ==============================================================================

get_marma_lang() {
    local cfg="$HOME/.config/marma-crypto/config.json"
    if [[ -f "$cfg" ]]; then
        local user_lang
        user_lang=$(grep -o '"lang"[[:space:]]*:[[:space:]]*"[^"]*"' "$cfg" 2>/dev/null | cut -d'"' -f4 || true)
        if [[ "$user_lang" == "en" ]]; then echo "en"; return; fi
        if [[ "$user_lang" == "uk" || "$user_lang" == "ua" ]]; then echo "uk"; return; fi
    fi

    local l="${LANGUAGE:-${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}}"
    if [[ -z "$l" && -f /etc/default/locale ]]; then
        l=$(grep -E '^(LANGUAGE|LANG|LC_MESSAGES)=' /etc/default/locale | head -n1 | cut -d= -f2 | tr -d '"' || true)
    fi
    if [[ "${l,,}" =~ ^uk ]]; then
        echo "uk"
    else
        echo "en"
    fi
}

MARMA_LANG="${MARMA_LANG:-$(get_marma_lang)}"
export MARMA_LANG

if [[ -f "$HOME/002_AI/PROJECTS/EDU-VEDI/marma-crypto-protocol/src/marma_watermark.py" ]]; then
    export PATH="$HOME/002_AI/PROJECTS/EDU-VEDI/marma-crypto-protocol/bin:$HOME/.local/bin:$PATH"
    marma-watermark() {
        python3 "$HOME/002_AI/PROJECTS/EDU-VEDI/marma-crypto-protocol/src/marma_watermark.py" "$@"
    }
    export -f marma-watermark 2>/dev/null || true
elif [[ -f "$HOME/ai-debian-admin/deb-packages/marma-crypto-watermark/src/marma_watermark.py" ]]; then
    export PATH="$HOME/ai-debian-admin/deb-packages/marma-crypto-watermark/bin:$HOME/.local/bin:$PATH"
    marma-watermark() {
        python3 "$HOME/ai-debian-admin/deb-packages/marma-crypto-watermark/src/marma_watermark.py" "$@"
    }
    export -f marma-watermark 2>/dev/null || true
fi

marma_text() {
    if [[ "$MARMA_LANG" == "en" ]]; then
        echo "$2"
    else
        echo "$1"
    fi
}

marma_get_window_icon() {
    local candidate
    for candidate in \
        "/usr/share/icons/hicolor/scalable/apps/marma-crypto-watermark.svg" \
        "${XDG_DATA_HOME:-$HOME/.local/share}/icons/Papirus/48x48/mimetypes/application-certificate.svg" \
        "/usr/share/icons/Papirus/48x48/mimetypes/application-certificate.svg"; do
        if [[ -f "$candidate" ]]; then
            echo "$candidate"
            return 0
        fi
    done
    echo "security-high"
}

marma_notify() {
    local icon="$1"
    local title_uk="$2"
    local title_en="$3"
    local body_uk="$4"
    local body_en="$5"

    if command -v notify-send >/dev/null 2>&1; then
        local w_icon
        w_icon="$(marma_get_window_icon)"
        local use_icon="$icon"
        [[ -z "$use_icon" ]] && use_icon="$w_icon"

        if [[ "$MARMA_LANG" == "en" ]]; then
            notify-send -a "Marma-Crypto Watermark" -h int:transient:1 -i "$use_icon" "$title_en" "$body_en"
        else
            notify-send -a "Marma-Crypto Watermark" -h int:transient:1 -i "$use_icon" "$title_uk" "$body_uk"
        fi
    fi
}

marma_warn_dialog() {
    local title_uk="$1"
    local title_en="$2"
    local text_uk="$3"
    local text_en="$4"
    local w_icon
    w_icon="$(marma_get_window_icon)"

    if command -v zenity >/dev/null 2>&1; then
        if [[ "$MARMA_LANG" == "en" ]]; then
            zenity --warning --title="$title_en" --text="<b>${title_en}</b>\n\n${text_en}" --width=480 --window-icon="$w_icon" 2>/dev/null || true
        else
            zenity --warning --title="$title_uk" --text="<b>${title_uk}</b>\n\n${text_uk}" --width=480 --window-icon="$w_icon" 2>/dev/null || true
        fi
    fi
}

marma_info_dialog() {
    local title_uk="$1"
    local title_en="$2"
    local text_uk="$3"
    local text_en="$4"
    local w_icon
    w_icon="$(marma_get_window_icon)"

    if command -v zenity >/dev/null 2>&1; then
        if [[ "$MARMA_LANG" == "en" ]]; then
            zenity --info --title="$title_en" --text="<b>${title_en}</b>\n\n${text_en}" --width=520 --window-icon="$w_icon" 2>/dev/null || true
        else
            zenity --info --title="$title_uk" --text="<b>${title_uk}</b>\n\n${text_uk}" --width=520 --window-icon="$w_icon" 2>/dev/null || true
        fi
    fi
}
