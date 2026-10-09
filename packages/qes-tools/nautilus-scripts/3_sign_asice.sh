#!/usr/bin/env bash
# ==============================================================================
# 📦 Підписати (Пакетний контейнер ASiC-E) / Sign (Package Container ASiC-E)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/.i18n.sh" ]]; then
    source "${SCRIPT_DIR}/.i18n.sh"
elif [[ -f "${SCRIPT_DIR}/_i18n.sh" ]]; then
    source "${SCRIPT_DIR}/_i18n.sh"
elif [[ -f "/usr/share/qes-tools/nautilus-scripts/_i18n.sh" ]]; then
    source "/usr/share/qes-tools/nautilus-scripts/_i18n.sh"
fi
QES_LANG="${QES_LANG:-uk}"

FILES=()
if [[ -n "${NAUTILUS_SCRIPT_SELECTED_FILE_PATHS:-}" ]]; then
    while IFS= read -r line; do
        [[ -n "$line" ]] && FILES+=("$line")
    done <<< "$NAUTILUS_SCRIPT_SELECTED_FILE_PATHS"
else
    FILES=("$@")
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
    qes_warn_dialog \
        "Пакетний КЕП (ASiC-E)" \
        "Batch QES (ASiC-E)" \
        "Оберіть файли або папку для створення пакетного контейнера ASiC-E." \
        "Select files or folder to create an ASiC-E package container."
    exit 0
fi

OUTPUT_FLAG=()
if [[ ${#FILES[@]} -gt 1 && ! -d "${FILES[0]}" ]]; then
    PARENT_DIR="$(dirname "${FILES[0]}")"
    title="$(qes_text "Назва пакету ASiC-E" "ASiC-E Package Name")"
    prompt="$(qes_text "Вкажіть назву файлу архіву:" "Enter the archive filename:")"
    default_name="$(qes_text "пакет_документів.asice" "document_package.asice")"
    PKG_NAME=$(zenity --entry --title="$title" --text="$prompt" --entry-text="$default_name" 2>/dev/null || true)
    if [[ -z "$PKG_NAME" ]]; then
        exit 0
    fi
    [[ "$PKG_NAME" != *.asice ]] && PKG_NAME="${PKG_NAME}.asice"
    OUTPUT_FLAG=("-o" "${PARENT_DIR}/${PKG_NAME}")
fi

if qes-sign --asice --gui "${OUTPUT_FLAG[@]}" "${FILES[@]}"; then
    qes_notify "package-x-generic" \
        "✅ Створено архів ASiC-E" \
        "✅ ASiC-E Archive Created" \
        "Пакет документів успішно завірено європейським контейнером ASiC-E." \
        "Document package successfully certified with European ASiC-E container."
else
    qes_notify "dialog-error" \
        "❌ Помилка створення ASiC-E" \
        "❌ ASiC-E Creation Error" \
        "Операцію скасовано або сталася помилка." \
        "Operation was cancelled or an error occurred."
fi
