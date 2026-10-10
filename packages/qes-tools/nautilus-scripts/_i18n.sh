#!/usr/bin/env bash
# ==============================================================================
# _i18n.sh — Спільний модуль локалізації для Nautilus-скриптів QES Tools
# Shared localization helper for QES Tools Nautilus Scripts
# ==============================================================================

get_qes_lang() {
    # 1. Пріоритет: файл налаштувань користувача ~/.config/qes/config.json
    local cfg="$HOME/.config/qes/config.json"
    if [[ -f "$cfg" ]]; then
        local user_lang
        user_lang=$(grep -o '"lang"[[:space:]]*:[[:space:]]*"[^"]*"' "$cfg" 2>/dev/null | cut -d'"' -f4 || true)
        if [[ "$user_lang" == "en" ]]; then echo "en"; return; fi
        if [[ "$user_lang" == "uk" || "$user_lang" == "ua" ]]; then echo "uk"; return; fi
    fi

    # 2. Перевірка локалі оточення ($LC_ALL, $LC_MESSAGES, $LANG)
    local l="${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}"
    if [[ -z "$l" && -f /etc/default/locale ]]; then
        l=$(grep -E '^(LANG|LC_MESSAGES)=' /etc/default/locale | head -n1 | cut -d= -f2 | tr -d '"' || true)
    fi
    if [[ "${l,,}" =~ ^uk ]]; then
        echo "uk"
    else
        echo "en"
    fi
}

QES_LANG="${QES_LANG:-$(get_qes_lang)}"
export QES_LANG

# Повертає перший аргумент для української мови, другий — для англійської
qes_text() {
    if [[ "$QES_LANG" == "en" ]]; then
        echo "$2"
    else
        echo "$1"
    fi
}

# Двомовне сповіщення desktop notify-send
qes_notify() {
    local icon="$1"
    local title_uk="$2"
    local title_en="$3"
    local body_uk="$4"
    local body_en="$5"

    if command -v notify-send >/dev/null 2>&1; then
        if [[ "$QES_LANG" == "en" ]]; then
            notify-send -a "QES Tools" -i "$icon" "$title_en" "$body_en"
        else
            notify-send -a "QES Tools" -i "$icon" "$title_uk" "$body_uk"
        fi
    fi
}

# Двомовне діалогове вікно попередження zenity
qes_warn_dialog() {
    local title_uk="$1"
    local title_en="$2"
    local text_uk="$3"
    local text_en="$4"

    if command -v zenity >/dev/null 2>&1; then
        if [[ "$QES_LANG" == "en" ]]; then
            zenity --warning --title="$title_en" --text="$text_en" 2>/dev/null || true
        else
            zenity --warning --title="$title_uk" --text="$text_uk" 2>/dev/null || true
        fi
    fi
}
