#!/usr/bin/env bash
# ==============================================================================
# test_basic.sh — Базові перевірки працездатності інструмента
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> Перевірка виводу --help..."
out=$("${PACKAGE_DIR}/src/main.sh" --help)
echo "$out" | grep -qi "Використання"
echo "  ✅ --help працює"

echo "==> Перевірка виводу --version..."
out=$("${PACKAGE_DIR}/src/main.sh" --version)
echo "$out" | grep -qi "версії"
echo "  ✅ --version працює"

echo "==> Перевірка працездатності команди --run..."
out=$("${PACKAGE_DIR}/src/main.sh" --run)
echo "$out" | grep -qi "Успішно"
echo "  ✅ --run працює"

echo "🎉 Усі базові тести пройдено!"
