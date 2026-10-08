#!/usr/bin/env bash
# ==============================================================================
# main.sh — Головна логіка інструмента {{PACKAGE_NAME}}
# ==============================================================================
set -euo pipefail

VERSION="{{VERSION}}"
PKG_NAME="{{PACKAGE_NAME}}"

show_help() {
    cat << EOF
$PKG_NAME v$VERSION — {{DESCRIPTION_SHORT}}

Використання:
  $PKG_NAME [ОПЦІЇ] [АРГУМЕНТИ]

Опції:
  -h, --help       Показати цю довідку
  -v, --version    Показати версію пакета
  -r, --run        Виконати головну дію

Приклади:
  $PKG_NAME --help
  $PKG_NAME --run
EOF
}

case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    -v|--version)
        echo "$PKG_NAME версії $VERSION"
        exit 0
        ;;
    -r|--run)
        echo "Виконання основної задачі $PKG_NAME..."
        echo "✅ Успішно завершено!"
        exit 0
        ;;
    *)
        if [ $# -eq 0 ]; then
            show_help
            exit 0
        fi
        echo "Невідома опція: $1" >&2
        echo "Спробуйте '$PKG_NAME --help' для отримання довідки." >&2
        exit 1
        ;;
esac
