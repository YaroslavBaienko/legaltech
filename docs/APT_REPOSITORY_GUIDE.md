# 🌐 Guide to Deploying & Administering an APT Repository on GitHub Pages

This guide documents the architecture, configuration, and maintenance workflows for hosting a static **APT repository** for Debian and Ubuntu using **GitHub Pages** and **GitHub Actions** within the **LegalTech** ecosystem.

---

## 🏗️ 1. Architecture of a Static APT Repository

The `APT` package manager does not require a complex backend service or database. It operates over standard static HTTP/HTTPS files adhering to a standardized layout:

```text
https://yaroslavbaienko.github.io/legaltech/
│
├── .nojekyll                                  # Prevents Jekyll processing on GitHub Pages
├── index.html                                 # Web portal with repository setup instructions
├── public.gpg / KEY.gpg                       # Public GPG key for signature verification
│
├── pool/                                      # Binary .deb package storage
│   └── main/
│       ├── qes-tools_1.0.2_amd64.deb
│       └── qes-tools_1.0.3_amd64.deb
│
└── dists/                                     # Distribution metadata and indices
    └── stable/
        ├── InRelease                          # Inline cryptographically signed manifest
        ├── Release                            # Manifest containing package checksums
        ├── Release.gpg                        # Detached GPG signature
        └── main/
            └── binary-amd64/
                ├── Packages                   # Plaintext index of available packages and versions
                └── Packages.gz                # Compressed index for rapid APT download
```

This structure allows **GitHub Pages** to serve as a fast, highly available, CDN-backed APT repository over HTTPS at zero infrastructure cost.

---

## 🔐 2. Security & Cryptographic Signing (GPG)

Every repository release is cryptographically signed.

### Key Isolation:
- Personal developer GPG keys are **never used**.
- A dedicated 4096-bit RSA key pair was provisioned:
  `LegalTech APT Repository <zerhug@gmail.com>` (ID: `C7E35514B6251C8B4E58A28BF8F3BF5DBA24A05A`).
- **Private key** is stored exclusively in encrypted GitHub Actions repository secrets:
  `Settings ➔ Secrets and variables ➔ Actions ➔ GPG_PRIVATE_KEY`.
- Local copies of the private key have been securely wiped (`shred`).
- **Public key** is tracked in `keys/public.gpg` and automatically published to GitHub Pages as `public.gpg`.

---

## 🛠️ 3. Local Repository Generation (`build-apt-repo.sh`)

The `tools/` directory contains an autonomous build script, [`build-apt-repo.sh`](../tools/build-apt-repo.sh), allowing repository testing locally or in CI/CD:

```bash
# Run the generator (defaults to generating in dist-apt/)
./tools/build-apt-repo.sh /path/to/target/directory
```

### Script Execution Steps:
1. Scans for built `.deb` files in `packages/*/dist/` and copies them to `pool/main/`.
2. Runs `apt-ftparchive packages` to generate `Packages` and `Packages.gz`.
3. Runs `apt-ftparchive release` to generate the `Release` manifest with all checksum hashes (MD5, SHA1, SHA256, SHA512).
4. If a GPG signing key is available (via the `GPG_PRIVATE_KEY` environment variable), produces `Release.gpg` and `InRelease`.
5. Emits the `.nojekyll` marker and the modern `index.html` landing page.

---

## 🤖 4. CI/CD Automation with GitHub Actions

The deployment workflow is fully automated in [`.github/workflows/apt-repo.yml`](../.github/workflows/apt-repo.yml).

### Workflow Triggers:
1. **Pushing a release tag**: `git push origin v1.0.4`
2. **Publishing a GitHub Release**: Creating a release in the GitHub UI.
3. **Manual Trigger (workflow_dispatch)**: Clicking **Run workflow** in the Actions tab or running:
   ```bash
   gh workflow run "Update APT Repository"
   ```

### GitHub Actions Pipeline:
1. Boots an `ubuntu-latest` virtual machine.
2. Installs packaging toolchains: `dpkg-dev`, `apt-utils`, `binutils`, `lintian`, `typst`.
3. Compiles package `.deb` artifacts via `./packages/<package>/build.sh`.
4. Synchronizes historical packages from the `gh-pages` branch so previous versions remain available.
5. Executes `./tools/build-apt-repo.sh`.
6. Signs the repository using the `GPG_PRIVATE_KEY` secret.
7. Publishes the updated repository tree to the **`gh-pages`** branch.

---

## 🚀 5. How to Release a Package Update (Step-by-Step)

When updating package code (e.g. for `qes-tools`):

### Step 1. Bump the Version
1. Update `PKG_VERSION="1.0.4"` in `packages/qes-tools/build.sh`.
2. Update the version in `packages/qes-tools/debian/control`: `Version: 1.0.4`.
3. Update the version in `packages/qes-tools/package.json`: `"version": "1.0.4"`.

### Step 2. Commit and Create a Git Tag
```bash
git commit -am "chore(release): bump version to v1.0.4"
git tag v1.0.4
git push origin main --tags
```

### Step 3. Automatic Processing
- GitHub Actions triggers the `Update APT Repository` workflow.
- The new `qes-tools_1.0.4_amd64.deb` is published to `pool/main/`.
- Updated `Packages.gz` and signed `InRelease` manifests are deployed to GitHub Pages.

---

## 👥 6. How Users Connect to Your Repository

End users can configure the repository with a single command:

```bash
sudo mkdir -p /etc/apt/keyrings && \
curl -fsSL https://yaroslavbaienko.github.io/legaltech/public.gpg | gpg --dearmor | sudo tee /etc/apt/keyrings/legaltech.gpg > /dev/null && \
sudo chmod 644 /etc/apt/keyrings/legaltech.gpg && \
echo "deb [signed-by=/etc/apt/keyrings/legaltech.gpg] https://yaroslavbaienko.github.io/legaltech stable main" | sudo tee /etc/apt/sources.list.d/legaltech.list > /dev/null && \
sudo apt update && \
sudo apt install -y qes-tools
```

For full setup documentation, see [docs/INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md).
