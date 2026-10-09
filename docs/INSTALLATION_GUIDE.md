# 📦 LegalTech Package Installation & Upgrade Guide

This guide provides comprehensive, verified instructions for installing, configuring, and automatically updating packages from the **LegalTech** ecosystem (including the flagship `qes-tools` suite) on **Debian**, **Ubuntu**, **Linux Mint**, and other Debian-based Linux distributions.

---

## 🌟 Method 1. Installation via the Official APT Repository (Recommended)

Configuring the official APT repository provides:
- 🔄 **Automatic updates**: Receive new versions with standard system commands: `sudo apt update && sudo apt upgrade`.
- 🛡️ **Cryptographic security**: Every release is verified with the maintainer's official digital GPG signature.
- 📦 **Automated dependency resolution**: System libraries (`nodejs`, `python3-cryptography`, `zenity`, `ocrmypdf`, `tesseract-ocr-ukr`, etc.) are downloaded and configured automatically.

### Quick One-Line Setup:

Copy and run this command in your terminal:

```bash
sudo mkdir -p /etc/apt/keyrings && \
curl -fsSL https://yaroslavbaienko.github.io/legaltech/public.gpg | gpg --dearmor | sudo tee /etc/apt/keyrings/legaltech.gpg > /dev/null && \
sudo chmod 644 /etc/apt/keyrings/legaltech.gpg && \
echo "deb [signed-by=/etc/apt/keyrings/legaltech.gpg] https://yaroslavbaienko.github.io/legaltech stable main" | sudo tee /etc/apt/sources.list.d/legaltech.list > /dev/null && \
sudo apt update && \
sudo apt install -y qes-tools
```

---

### Step-by-Step Installation:

#### Step 1. Download and Save the Public GPG Key
For security and compatibility with modern Debian/Ubuntu releases, the key is placed in the isolated directory `/etc/apt/keyrings/`:

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://yaroslavbaienko.github.io/legaltech/public.gpg | gpg --dearmor | sudo tee /etc/apt/keyrings/legaltech.gpg > /dev/null
sudo chmod 644 /etc/apt/keyrings/legaltech.gpg
```

*(If you are working from a local clone of the `legaltech` repository, the key can be imported offline):*
```bash
gpg --dearmor < keys/public.gpg | sudo tee /etc/apt/keyrings/legaltech.gpg > /dev/null
sudo chmod 644 /etc/apt/keyrings/legaltech.gpg
```

#### Step 2. Add the Repository to APT Sources
Create the configuration file `/etc/apt/sources.list.d/legaltech.list`:

```bash
echo "deb [signed-by=/etc/apt/keyrings/legaltech.gpg] https://yaroslavbaienko.github.io/legaltech stable main" | sudo tee /etc/apt/sources.list.d/legaltech.list
```

#### Step 3. Update Package Lists
```bash
sudo apt update
```

You should see confirmation output similar to:
```text
Get:... https://yaroslavbaienko.github.io/legaltech stable InRelease [2,349 B]
Hit:... https://yaroslavbaienko.github.io/legaltech stable/main amd64 Packages
```

#### Step 4. Install the Package
```bash
sudo apt install -y qes-tools
```

---

## 💻 Method 2. Local Installation of a Downloaded `.deb` File

If you need to install the package offline or test a specific build:

1. Download the `.deb` file from [GitHub Releases](https://github.com/YaroslavBaienko/legaltech/releases).
2. Install it using `apt` (which will resolve necessary system dependencies from your existing repositories):

```bash
sudo apt install ./qes-tools_1.0.6_amd64.deb
```

> ⚠️ **Note:** When installing a standalone file locally, the system will not receive automated updates via `apt upgrade` unless the official APT repository is configured (Method 1).

---

## 🔍 Verifying the Installation & Package Source

To inspect the installed version and verify the repository origin, run:

```bash
apt policy qes-tools
```

Expected output:
```text
qes-tools:
  Installed: 1.0.6
  Candidate: 1.0.6
  Version table:
 *** 1.0.6 500
        500 https://yaroslavbaienko.github.io/legaltech stable/main amd64 Packages
        100 /var/lib/dpkg/status
```

Verify CLI utilities:
```bash
qes-tool --help
qes-tool token
qes-sign --help
qes-agent status
```

In **GNOME Files (Nautilus)**: Right-click any file ➔ **Scripts** ➔ **`🔐 КЕП та Безпека`** (16 actions available).

---

## 🔄 How Automatic Updates Work

When a new version is released (e.g., version `1.0.6`):
1. Run standard system maintenance commands:
   ```bash
   sudo apt update
   sudo apt upgrade
   ```
2. The `APT` package manager detects the newer version available on the server:
   ```text
   The following packages will be upgraded:
     qes-tools (1.0.5 => 1.0.6)
   ```
3. The package updates seamlessly without affecting your personal keys, configurations, or sessions.

---

## 🗑️ Uninstalling Packages

### 1. Standard Removal (Preserving Configuration Files):
```bash
sudo apt remove qes-tools
```

### 2. Complete Purge:
Removes the package, system binaries from `/usr/bin/`, and desktop menu integrations from Nautilus:
```bash
sudo apt purge qes-tools
```

### 3. Removing the APT Repository (If No Longer Needed):
```bash
sudo rm -f /etc/apt/sources.list.d/legaltech.list
sudo rm -f /etc/apt/keyrings/legaltech.gpg
sudo apt update
```

---

## 🛠️ Troubleshooting

### 1. Error: `Failed to parse keyring "/etc/apt/keyrings/legaltech.gpg": No such file or directory`
**Cause:** The repository file was added to `/etc/apt/sources.list.d/`, but the public key file has not been created or written yet.  
**Solution:**
```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://yaroslavbaienko.github.io/legaltech/public.gpg | gpg --dearmor | sudo tee /etc/apt/keyrings/legaltech.gpg > /dev/null
sudo chmod 644 /etc/apt/keyrings/legaltech.gpg
sudo apt update
```

### 2. Debian 13 (Trixie) and the `sqv` (Sequoia PGP) Engine
Debian 13 performs signature verification using the `sqv` engine, which strictly enforces:
- Proper binary keyring format (`gpg --dearmor`).
- `0644` read permissions on the keyring file so the unprivileged `_apt` user can read it.  
Following the commands in this guide ensures full compatibility across Debian 12 (Bookworm), Debian 13 (Trixie), Ubuntu 24.04 LTS, and Ubuntu 22.04 LTS.
