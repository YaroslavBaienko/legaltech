#!/usr/bin/env bash
# ==============================================================================
# 📦 Підписати (Пакетний контейнер ASiC-E)
# ==============================================================================
set -euo pipefail

FILES=()
if [[ -n "${NAUTILUS_SCRIPT_SELECTED_FILE_PATHS:-}" ]]; then
    while IFS= read -r line; do
        [[ -n "$line" ]] && FILES+=("$line")
    done <<< "$NAUTILUS_SCRIPT_SELECTED_FILE_PATHS"
else
    FILES=("$@")
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
    zenity --warning --title="Пакетний КЕП (ASiC-E)" --text="Оберіть файли або папку для створення пакетного контейнера ASiC-E."
    exit 0
fi

# If multiple files selected, ask container name
OUTPUT_FLAG=()
if [[ ${#FILES[@]} -gt 1 && ! -d "${FILES[0]}" ]]; then
    PARENT_DIR="$(dirname "${FILES[0]}")"
    PKG_NAME=$(zenity --entry --title="Назва пакету ASiC-E" --text="Вкажіть назву файлу архіву:" --entry-text="пакет_документів.asice")
    if [[ -z "$PKG_NAME" ]]; then
        exit 0
    fi
    [[ "$PKG_NAME" != *.asice ]] && PKG_NAME="${PKG_NAME}.asice"
    OUTPUT_FLAG=("-o" "${PARENT_DIR}/${PKG_NAME}")
fi

if qes-sign --asice --gui "${OUTPUT_FLAG[@]}" "${FILES[@]}"; then
    notify-send -a "QES Tools" -i package-x-generic \
        "✅ Створено архів ASiC-E" \
        "Пакет документів успішно завірено європейським контейнером ASiC-E."
else
    notify-send -a "QES Tools" -i dialog-error \
        "❌ Помилка створення ASiC-E" \
        "Операцію скасовано або сталася помилка."
fi
