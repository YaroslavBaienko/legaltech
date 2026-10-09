# 📖 Practical Guide to Debian Packaging (.deb)

This guide covers modern best practices for designing, structuring, linting, and automating releases of `.deb` packages for Debian and Ubuntu within the **LegalTech** ecosystem.

---

## 1. Anatomy of a Debian Package

Every `.deb` file is an `ar` archive containing three core components:
1. `debian-binary` — Format version string (always `2.0`).
2. `control.tar.xz` — Package metadata, dependency definitions, and maintainer installation scripts.
3. `data.tar.xz` — Application files and binaries extracted to target filesystem paths (`/usr/bin`, `/usr/lib`, `/usr/share`).

### Key Control Files in `debian/`:

| File | Purpose |
| :--- | :--- |
| `control` | Core metadata: package name, version, architecture, dependencies (`Depends`, `Recommends`, `Suggests`), maintainer contacts, and description. |
| `copyright` | Machine-readable copyright and license details adhering to [Debian DEP-5 format](https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/). |
| `changelog` | Version history formatted according to Debian standards: `pkg (1.0.0-1) unstable; urgency=medium`. |
| `postinst` | Shell script executed as `root` **after** file unpacking (permissions setup, database updates, service initialization). |
| `prerm` | Shell script executed **before** package removal or upgrade (stopping services, temporary cleanup). |
| `postrm` | Shell script executed **after** removal (final cleanup of configuration files upon `purge`). |

---

## 2. Filesystem Hierarchy Standard (FHS) Guidelines

When packaging applications, adhere strictly to Debian FHS directory locations:

- **/usr/bin/** — Only primary executables (binaries or thin wrapper shell scripts). Avoid placing heavy dependency folders (`node_modules`) or auxiliary scripts here.
- **/usr/lib/\<package-name\>/** — Private application directory: core code, internal modules, runtime dependencies, and vendor assets.
- **/usr/share/\<package-name\>/** — Architecture-independent data: templates, sample assets, certificates, icons.
- **/usr/share/nautilus-scripts/** — Integration scripts for the GNOME Files (Nautilus) context menu.
- **/usr/share/doc/\<package-name\>/** — Mandatory documentation: `copyright` and compressed `changelog.Debian.gz`.
- **/etc/\<package-name\>/** — System configuration files editable by the system administrator.

---

## 3. Dependency Management (`control`)

Define dependency severity appropriately:

```text
Depends: nodejs (>= 18), python3-cryptography, openssl, qpdf
Recommends: wl-clipboard | xclip
Suggests: tesseract-ocr-fra
```

1. **`Depends`** — Mandatory dependencies. The package cannot function without them; `apt` will refuse installation if any dependency is missing.
2. **`Recommends`** — Recommended dependencies. Installed by default in standard `apt` installations, but users may opt out via `--no-install-recommends`.
3. **`Suggests`** — Optional enhancements that provide extended capabilities.

---

## 4. Creating a New Package with the Generator

The `legaltech` repository includes a fast scaffolding tool:

```bash
# Syntax:
./tools/new-deb-package.sh <package-name> "<short description>" [version] [architecture]

# Example:
./tools/new-deb-package.sh court-fetcher "Registry court decision fetcher" 1.0.0 all
```

After execution:
1. Navigate to the new package directory: `cd packages/court-fetcher`
2. Add your source code to `src/`
3. Run tests: `make test`
4. Build the package: `make build`
5. The verified `.deb` package will be generated at `dist/court-fetcher_1.0.0_all.deb`!

---

## 5. Validation and Quality Assurance with Lintian

Always validate newly built packages with the official Debian package checker **Lintian**:

```bash
# Install Lintian
sudo apt install lintian

# Run validation
lintian --no-tag-display-limit dist/qes-tools_1.0.2_amd64.deb
```

Lintian inspects:
- File permissions (e.g. flagging insecure `0777` permissions or non-executable scripts in `/usr/bin/`).
- Missing copyright or changelog records.
- Syntax discrepancies in `control` and maintainer scripts (`postinst`, `prerm`, `postrm`).

---

## 6. Release Automation with GitHub Actions

The repository includes pre-configured CI/CD workflows (`.github/workflows/`):

1. **`ci.yml`** — Runs on every push or pull request to `main` inside a clean Ubuntu runner, verifying all unit and integration test suites.
2. **`build-deb.yml`** — Builds `.deb` packages in isolated containers and archives them as workflow artifacts.
3. **`release.yml`** — Automatically publishes an official **GitHub Release** whenever a version tag is pushed:
   ```bash
   git tag v1.0.2
   git push origin v1.0.2
   ```
   The workflow builds the packages, computes checksums in `SHA256SUMS.txt`, and publishes the release assets.
