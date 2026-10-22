#!/usr/bin/env bash
# ==============================================================================
# build.sh — Збірка .deb пакета marma-crypto-watermark v1.3.0 (Nautilus + GTK4/Adwaita)
# За зразком архітектури $HOME/legaltech (qes-tools)
#
# Встановлює у систему:
#   /usr/bin/marma-watermark                                     CLI/GUI ядро підпису та верифікації
#   /usr/bin/marma-dialog                                        GTK4 + Libadwaita діалоговий рушій
#   /usr/bin/marma-config                                        Менеджер меню Nautilus (UA/EN)
#   /usr/lib/marma-crypto-watermark/marma_watermark.py           Автономне математичне ядро
#   /usr/lib/marma-crypto-watermark/bin/marma-dialog
#   /usr/lib/marma-crypto-watermark/bin/marma-config
#   /usr/share/marma-crypto-watermark/nautilus-scripts/*         Канонічні скрипти Nautilus
#   /usr/share/icons/hicolor/scalable/apps/marma-crypto-watermark.svg
#   /usr/share/bash-completion/completions/marma-watermark
#   /usr/share/doc/marma-crypto-watermark/README.md, PROVENANCE.txt
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
SOURCE_DIR="${SCRIPT_DIR}/src"
BIN_DIR="${SCRIPT_DIR}/bin"
NAUTILUS_SRC="${SCRIPT_DIR}/nautilus-scripts"

PKG_NAME="marma-crypto-watermark"
PKG_VERSION="2.1.0-1"
PKG_ARCH="all"
PKG_MAINTAINER="Yaroslav Baienko <yaroslav@advocacy.uno>"

BUILD_DIR="${SCRIPT_DIR}/build"
PKGROOT="${BUILD_DIR}/pkgroot"
DIST_DIR="${SCRIPT_DIR}/dist"
DEB_FILE="${DIST_DIR}/${PKG_NAME}_${PKG_VERSION}_${PKG_ARCH}.deb"

MODE="build"
case "${1:-}" in
    --test) MODE="test" ;;
    --install) MODE="install" ;;
    --clean) MODE="clean" ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    "") ;;
    *) echo "Невідомий аргумент: $1 (див. --help)" >&2; exit 2 ;;
esac

if [[ "${MODE}" == "clean" ]]; then
    rm -rf "${BUILD_DIR}" "${DIST_DIR}"
    echo "Прибрано: ${BUILD_DIR}, ${DIST_DIR}"
    exit 0
fi

if [[ -z "${SOURCE_DATE_EPOCH:-}" ]] && git -C "${REPO_DIR}" rev-parse --git-dir >/dev/null 2>&1; then
    COMMIT_EPOCH="$(git -C "${REPO_DIR}" log -1 --format=%ct)"
    export SOURCE_DATE_EPOCH="${COMMIT_EPOCH}"
fi

echo "==> [1/6] Підготовка дерева каталогів ${PKGROOT}..."
rm -rf "${PKGROOT}"
mkdir -p \
    "${PKGROOT}/DEBIAN" \
    "${PKGROOT}/usr/bin" \
    "${PKGROOT}/usr/lib/marma-crypto-watermark/bin" \
    "${PKGROOT}/usr/lib/marma-crypto-watermark/marma_crypto" \
    "${PKGROOT}/usr/share/marma-crypto-watermark/nautilus-scripts" \
    "${PKGROOT}/usr/share/icons/hicolor/scalable/apps" \
    "${PKGROOT}/usr/share/bash-completion/completions" \
    "${PKGROOT}/usr/share/doc/marma-crypto-watermark"

install -m 0755 "${SOURCE_DIR}/marma_watermark.py" "${PKGROOT}/usr/lib/marma-crypto-watermark/marma_watermark.py"
install -m 0755 "${SOURCE_DIR}/dstu4145_bridge.js" "${PKGROOT}/usr/lib/marma-crypto-watermark/dstu4145_bridge.js"
install -m 0644 "${SOURCE_DIR}/marma_crypto/"*.py  "${PKGROOT}/usr/lib/marma-crypto-watermark/marma_crypto/"
install -m 0755 "${BIN_DIR}/marma-dialog"          "${PKGROOT}/usr/lib/marma-crypto-watermark/bin/marma-dialog"
install -m 0755 "${BIN_DIR}/marma-config"          "${PKGROOT}/usr/lib/marma-crypto-watermark/bin/marma-config"
install -m 0644 "${SCRIPT_DIR}/README.md"          "${PKGROOT}/usr/share/doc/marma-crypto-watermark/README.md"

echo "==> [2/6] Копіювання скриптів контекстного меню Nautilus..."
cp "${NAUTILUS_SRC}/"* "${PKGROOT}/usr/share/marma-crypto-watermark/nautilus-scripts/"
chmod 0755 "${PKGROOT}/usr/share/marma-crypto-watermark/nautilus-scripts/"*

echo "==> [3/6] Створення системних обгорток у /usr/bin..."
cat > "${PKGROOT}/usr/bin/marma-watermark" <<'EOF'
#!/bin/sh
set -e
exec /usr/bin/python3 /usr/lib/marma-crypto-watermark/marma_watermark.py "$@"
EOF
chmod 0755 "${PKGROOT}/usr/bin/marma-watermark"

cat > "${PKGROOT}/usr/bin/marma-dialog" <<'EOF'
#!/bin/sh
set -e
exec /usr/bin/python3 /usr/lib/marma-crypto-watermark/bin/marma-dialog "$@"
EOF
chmod 0755 "${PKGROOT}/usr/bin/marma-dialog"

cat > "${PKGROOT}/usr/bin/marma-config" <<'EOF'
#!/bin/sh
set -e
exec /usr/lib/marma-crypto-watermark/bin/marma-config "$@"
EOF
chmod 0755 "${PKGROOT}/usr/bin/marma-config"

cat > "${PKGROOT}/usr/share/bash-completion/completions/marma-watermark" <<'EOF'
_marma_watermark_completions() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    opts="sign verify trace protocol keygen clear-session selftest batch-seal serve-api --stamp-pdf --verify-pdf --stamp-docx --verify-docx --sign-svg --verify-svg --protocol --recipient-id --recipients --suspects --emblem --optical-ring --image --content-sha256 --port --key-file -k --output -o --secret --strict-key --mode --lang --gui --open --help --version"
    if [[ ${cur} == -* ]] || [[ ${COMP_CWORD} -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
        return 0
    fi
    COMPREPLY=( $(compgen -f -- ${cur}) )
}
complete -F _marma_watermark_completions marma-watermark
EOF
chmod 0644 "${PKGROOT}/usr/share/bash-completion/completions/marma-watermark"

echo "==> [4/6] Генерація векторної іконки Шрі Янтри..."
python3 "${SOURCE_DIR}/marma_watermark.py" --sign-svg "${PKGROOT}/usr/share/icons/hicolor/scalable/apps/marma-crypto-watermark.svg" \
    --payload "EDU-VEDI::Debian-Package-Icon::marma-crypto-watermark" >/dev/null
chmod 0644 "${PKGROOT}/usr/share/icons/hicolor/scalable/apps/marma-crypto-watermark.svg"

echo "==> [5/6] Генерація DEBIAN/control, postinst, prerm, postrm та PROVENANCE.txt..."
INSTALLED_SIZE=$(du -sk "${PKGROOT}/usr" | awk '{print $1}')
cat > "${PKGROOT}/DEBIAN/control" <<EOF
Package: ${PKG_NAME}
Version: ${PKG_VERSION}
Section: utils
Priority: optional
Architecture: ${PKG_ARCH}
Installed-Size: ${INSTALLED_SIZE}
Depends: python3 (>= 3.10), python3-pymupdf, python3-docx, python3-cairo, python3-gi, gir1.2-gtk-4.0, gir1.2-adw-1, zenity, libnotify-bin, xdg-utils
Maintainer: ${PKG_MAINTAINER}
Description: Sri Yantra Cryptographic Geometric Watermark & Nautilus Suite
 Zero-tolerance cryptographic geometric watermarking suite (Module 5 of EDU-VEDI)
 modeled after the LegalTech QES-Tools Nautilus architecture.
 .
 Integrates directly with ~/.secure_keys/ (.pfx, .p12, .key, .cer), hardware USB
 tokens, and GNOME Files (Nautilus) right-click Scripts menu ("🔱 Шрі Янтра · Marma-Crypto").
 .
 Provides /usr/bin/marma-watermark, /usr/bin/marma-dialog (GTK4/Libadwaita),
 and /usr/bin/marma-config for stamping 256-bit bijective vector watermarks,
 golden Bindu seals, Canary leak-tracing (--recipient-id / trace), verifying
 9-triangle concurrency invariants, and generating official PDF protocols.
EOF

cat > "${PKGROOT}/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e

if [ "$1" = "configure" ]; then
    chmod 0755 /usr/bin/marma-watermark /usr/bin/marma-dialog /usr/bin/marma-config 2>/dev/null || true

    # Видалення застарілих .desktop файлів (залишаємо чисту інтеграцію через контекстне меню Nautilus, як у qes-tools)
    rm -f /usr/share/applications/marma-crypto-watermark.desktop 2>/dev/null || true
    update-desktop-database -q /usr/share/applications 2>/dev/null || true
    gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor 2>/dev/null || true

    if [ -x /usr/bin/marma-config ]; then
        /usr/bin/marma-config --all-users --lang auto 2>/dev/null || true
    fi

    echo "================================================================================"
    echo " 🔱 Встановлено комплекс геометричного підпису marma-crypto-watermark v2.1.0"
    echo " • marma-watermark sign       — накладання 256-бітного водяного знака та печатки (Шрі Янтра / Тризуб / Щит / CAD)"
    echo " • marma-watermark batch-seal — пакетне штампування Deal-Room (N отримувачів + Optical Lotus ECC)"
    echo " • marma-watermark verify     — перевірка цілісності тексту, комбінера та 27-DOF геометрії"
    echo " • marma-watermark trace      — розшук джерела витоку з PDF/DOCX/SVG або фото екрана (.png/.jpg)"
    echo " • marma-watermark serve-api  — локальний REST-мікросервіс Deal-Room (/v1/seal-batch, /v1/trace-leak)"
    echo " • marma-watermark protocol   — формування офіційного PDF-протоколу перевірки"
    echo " • marma-dialog               — нативні вікна GTK4 / Libadwaita (вибір ключа з ~/.secure_keys)"
    echo " • marma-config               — керування мовою меню Nautilus (marma-config --lang uk|en|auto)"
    echo " 🖱️ Інтегровано у файловий менеджер GNOME (правий клік -> Скрипти -> 🔱 Шрі Янтра · Marma-Crypto)"
    echo "================================================================================"
fi
exit 0
EOF
chmod 0755 "${PKGROOT}/DEBIAN/postinst"

cat > "${PKGROOT}/DEBIAN/prerm" <<'EOF'
#!/bin/sh
set -e

if [ "$1" = "remove" ] || [ "$1" = "purge" ] || [ "$1" = "deconfigure" ]; then
    rm -rf "/etc/skel/.local/share/nautilus/scripts/🔱 Шрі Янтра · Marma-Crypto" \
           "/etc/skel/.local/share/nautilus/scripts/🔱 Sri Yantra · Marma-Crypto" 2>/dev/null || true

    for user_home in /home/*; do
        if [ -d "$user_home" ]; then
            rm -rf "$user_home/.local/share/nautilus/scripts/🔱 Шрі Янтра · Marma-Crypto" \
                   "$user_home/.local/share/nautilus/scripts/🔱 Sri Yantra · Marma-Crypto" 2>/dev/null || true
        fi
    done
fi
exit 0
EOF
chmod 0755 "${PKGROOT}/DEBIAN/prerm"

cat > "${PKGROOT}/DEBIAN/postrm" <<'EOF'
#!/bin/sh
set -e
exit 0
EOF
chmod 0755 "${PKGROOT}/DEBIAN/postrm"

{
    echo "Package: ${PKG_NAME} ${PKG_VERSION} (${PKG_ARCH})"
    echo "Built: $(date -u -Iseconds)"
    echo "Upstream Repository: https://github.com/YaroslavBaienko/marma-crypto-protocol"
    echo "CERN Zenodo DOI: 10.5281/zenodo.23510005"
    echo "Ecosystem Suite: https://github.com/YaroslavBaienko/legaltech"
    echo "Engine SHA-256: $(sha256sum "${SOURCE_DIR}/marma_watermark.py" | awk '{print $1}')"
    echo "Dialog SHA-256: $(sha256sum "${BIN_DIR}/marma-dialog" | awk '{print $1}')"
    echo "Config SHA-256: $(sha256sum "${BIN_DIR}/marma-config" | awk '{print $1}')"
} > "${PKGROOT}/usr/share/doc/marma-crypto-watermark/PROVENANCE.txt"
chmod 0644 "${PKGROOT}/usr/share/doc/marma-crypto-watermark/PROVENANCE.txt"

echo "==> [6/6] Збірка ${DEB_FILE}..."
mkdir -p "${DIST_DIR}"
chmod -R u=rwX,go=rX "${PKGROOT}/usr"
chmod 755 "${PKGROOT}/DEBIAN"
chmod 644 "${PKGROOT}/DEBIAN/control"
dpkg-deb --build --root-owner-group -Zzstd "${PKGROOT}" "${DEB_FILE}" >/dev/null

# Keep only the "latest" symlink; never duplicate the current build under an old
# version filename (that produced a misleading 1.3.0-1 artefact carrying 2.1.0 bits).
ln -sf "$(basename "${DEB_FILE}")" "${DIST_DIR}/${PKG_NAME}_latest_all.deb"

echo
dpkg-deb -f "${DEB_FILE}" Package Version Architecture Installed-Size
echo "файлів у пакеті: $(( $(dpkg-deb -c "${DEB_FILE}" | wc -l) - 1 ))"
DEB_BYTES="$(stat -c%s "${DEB_FILE}")"
awk -v b="${DEB_BYTES}" 'BEGIN { printf "розмір: %.1f КБ\n", b / 1024 }'
echo "sha256: $(sha256sum "${DEB_FILE}" | cut -d' ' -f1)"

if [[ "${MODE}" == "install" ]]; then
    echo "==> Встановлення пакета (потрібен root)..."
    sudo dpkg -i "${DEB_FILE}"
fi

if [[ "${MODE}" == "test" ]]; then
    echo "==> --test: розпаковуємо пакет у temp і проганяємо наскрізний крипто-тест + Nautilus deploy..."
    TEST_ROOT="$(mktemp -d /tmp/marma-deb-test.XXXXXX)"
    dpkg-deb -x "${DEB_FILE}" "${TEST_ROOT}"

    echo "    контроль вмісту пакета:"
    dpkg-deb --contents "${DEB_FILE}" | awk '{print "      " $1, $6}'

    echo "    перевірка розгортання меню Nautilus у ізольованому HOME:"
    FAKE_HOME="${TEST_ROOT}/fake_home"
    mkdir -p "${FAKE_HOME}"
    HOME="${FAKE_HOME}" MARMA_SOURCE_SCRIPTS_DIR="${TEST_ROOT}/usr/share/marma-crypto-watermark/nautilus-scripts" \
        "${TEST_ROOT}/usr/lib/marma-crypto-watermark/bin/marma-config" --lang uk
    find "${FAKE_HOME}/.local/share/nautilus/scripts" -maxdepth 3 | sed 's/^/      /'

    echo "    запуск автономного самотесту (SVG + PDF + DOCX + PDF Protocol + Tamper Detection):"
    python3 "${TEST_ROOT}/usr/lib/marma-crypto-watermark/marma_watermark.py" selftest
    rm -rf "${TEST_ROOT}"
    echo "==> --test: PASS (пакет і меню Nautilus повністю працездатні)"
fi
