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

    # 2. Перевірка локалі оточення ($LANGUAGE, $LC_ALL, $LC_MESSAGES, $LANG)
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

# Знайти відповідну іконку для Zenity діалогів (Papirus або hicolor fallback)
qes_get_window_icon() {
    local candidate
    for candidate in \
        "${XDG_DATA_HOME:-$HOME/.local/share}/icons/Papirus/48x48/mimetypes/application-certificate.svg" \
        "/usr/share/icons/Papirus/48x48/mimetypes/application-certificate.svg" \
        "/usr/share/icons/hicolor/scalable/apps/qes-tools.svg" \
        "/usr/share/icons/hicolor/48x48/apps/security-high.png"; do
        if [[ -f "$candidate" ]]; then
            echo "$candidate"
            return 0
        fi
    done
    echo "security-high"
}

# Двомовне сповіщення desktop notify-send з прапорцем транзитності
qes_notify() {
    local icon="$1"
    local title_uk="$2"
    local title_en="$3"
    local body_uk="$4"
    local body_en="$5"

    if command -v notify-send >/dev/null 2>&1; then
        local w_icon
        w_icon="$(qes_get_window_icon)"
        local use_icon="$icon"
        [[ -z "$use_icon" ]] && use_icon="$w_icon"

        if [[ "$QES_LANG" == "en" ]]; then
            notify-send -a "QES Tools" -h int:transient:1 -i "$use_icon" "$title_en" "$body_en"
        else
            notify-send -a "QES Tools" -h int:transient:1 -i "$use_icon" "$title_uk" "$body_uk"
        fi
    fi
}

qes_escape_pango() {
    printf '%s' "$1" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g'
}

# Двомовне діалогове вікно попередження zenity з Pango-розміткою (GNOME Adwaita HIG)
qes_warn_dialog() {
    local title_uk="$1"
    local title_en="$2"
    local text_uk="$3"
    local text_en="$4"
    local w_icon
    w_icon="$(qes_get_window_icon)"

    if command -v zenity >/dev/null 2>&1; then
        local dlg_title dlg_text safe_title
        if [[ "$QES_LANG" == "en" ]]; then
            dlg_title="$title_en"
            safe_title="$(qes_escape_pango "$title_en")"
            dlg_text="<span weight='bold' size='larger'>${safe_title}</span>\n\n${text_en}"
        else
            dlg_title="$title_uk"
            safe_title="$(qes_escape_pango "$title_uk")"
            dlg_text="<span weight='bold' size='larger'>${safe_title}</span>\n\n${text_uk}"
        fi
        zenity --warning --title="$dlg_title" --text="$dlg_text" --width=450 --icon-name="dialog-warning" --window-icon="$w_icon" 2>/dev/null || true
    fi
}

# Двомовне інформаційне діалогове вікно zenity з Pango-розміткою
qes_info_dialog() {
    local title_uk="$1"
    local title_en="$2"
    local text_uk="$3"
    local text_en="$4"
    local w_icon
    w_icon="$(qes_get_window_icon)"

    if command -v zenity >/dev/null 2>&1; then
        local dlg_title dlg_text safe_title
        if [[ "$QES_LANG" == "en" ]]; then
            dlg_title="$title_en"
            safe_title="$(qes_escape_pango "$title_en")"
            dlg_text="<span weight='bold' size='larger'>${safe_title}</span>\n\n${text_en}"
        else
            dlg_title="$title_uk"
            safe_title="$(qes_escape_pango "$title_uk")"
            dlg_text="<span weight='bold' size='larger'>${safe_title}</span>\n\n${text_uk}"
        fi
        zenity --info --title="$dlg_title" --text="$dlg_text" --width=450 --icon-name="security-high" --window-icon="$w_icon" 2>/dev/null || true
    fi
}

# Двомовне діалогове вікно помилки zenity з Pango-розміткою
qes_error_dialog() {
    local title_uk="$1"
    local title_en="$2"
    local text_uk="$3"
    local text_en="$4"
    local w_icon
    w_icon="$(qes_get_window_icon)"

    if command -v zenity >/dev/null 2>&1; then
        local dlg_title dlg_text safe_title
        if [[ "$QES_LANG" == "en" ]]; then
            dlg_title="$title_en"
            safe_title="$(qes_escape_pango "$title_en")"
            dlg_text="<span weight='bold' size='larger'>${safe_title}</span>\n\n${text_en}"
        else
            dlg_title="$title_uk"
            safe_title="$(qes_escape_pango "$title_uk")"
            dlg_text="<span weight='bold' size='larger'>${safe_title}</span>\n\n${text_uk}"
        fi
        zenity --error --title="$dlg_title" --text="$dlg_text" --width=450 --icon-name="dialog-error" --window-icon="$w_icon" 2>/dev/null || true
    fi
}
