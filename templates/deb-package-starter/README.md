# 🚀 Debian Package Starter Template (Boilerplate)

Universal starter boilerplate for developing new `.deb` packages for Debian and Ubuntu adhering to Debian Policy standards.

---

## 📁 Directory Structure

```text
.
├── debian/
│   ├── control       # Dependencies, package name, architecture, description
│   ├── copyright     # License and authorship (machine-readable DEP-5)
│   ├── changelog     # Version history
│   ├── rules         # Debhelper rules script (optional)
│   ├── postinst      # Post-installation script (permissions, daemons)
│   └── prerm         # Pre-removal script
├── src/              # Source code of your tool
├── bin/              # Binary launchers deployed to /usr/bin/
├── tests/            # Automated test suite
├── build.sh          # Packaging build script using dpkg-deb
├── Makefile          # Developer shortcuts (make build, make test, make clean)
└── README.md
```

---

## ⚡ How to Create a New Package

### Option 1. Automatically via the Generator:
From the root of the `legaltech` repository:
```bash
./tools/new-deb-package.sh my-cool-tool "Short description of the tool"
```

### Option 2. Manually:
1. Copy the `templates/deb-package-starter` directory to `packages/<package-name>`.
2. Replace variables `{{PACKAGE_NAME}}`, `{{VERSION}}`, `{{MAINTAINER_NAME}}` in `debian/control`, `debian/changelog`, and `debian/copyright`.
3. Add your source code to `src/`.
4. Run tests and build:
   ```bash
   make test
   make build
   ```
5. The ready-to-deploy `.deb` will be generated at `dist/<package-name>_<version>_<architecture>.deb`.
