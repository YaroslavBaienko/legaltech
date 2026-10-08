# 🌐 Як налаштувати власний APT-репозиторій на GitHub Pages

Налаштування власного репозиторію дозволяє користувачам встановлювати ваші пакети через `sudo apt install <пакет>` та отримувати автоматичні оновлення через `sudo apt upgrade`.

---

## 🏗️ Архітектура статичного APT-репозиторію

APT працює через звичайні статичні HTTP(S) файли:
- `dists/stable/main/binary-amd64/Packages.gz` — індекс доступних пакетів та їх хешів.
- `dists/stable/Release` та `dists/stable/Release.gpg` — підписаний GPG-ключем маніфест.
- `pool/main/q/qes-tools/*.deb` — самі бінарні пакети.

Завдяки цьому, GitHub Pages або Cloudflare Pages можуть працювати як повноцінний, безкоштовний, наднадійний APT-репозиторій.

---

## 🚀 Покроковий план розгортання через GitHub Action

### Крок 1. Генерація GPG-ключа для репозиторію
Для підпису репозиторію потрібен окремий GPG-ключ:
```bash
gpg --batch --gen-key <<EOF
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: Yaroslav Baienko (LegalTech APT Repo)
Name-Email: zerhug@gmail.com
Expire-Date: 0
%no-protection
%commit
EOF
```

Експортуйте відкритий ключ у файл:
```bash
gpg --armor --export "zerhug@gmail.com" > public-key.gpg
```

Експортуйте закритий ключ у форматі ASCII armor:
```bash
gpg --armor --export-secret-keys "zerhug@gmail.com" > secret-key.gpg
```

### Крок 2. Додавання секретів у GitHub
У репозиторії GitHub перейдіть у **Settings ➔ Secrets and variables ➔ Actions** та додайте:
- `GPG_PRIVATE_KEY` — вміст `secret-key.gpg`
- `GPG_PASSPHRASE` — пароль (якщо встановлено)

### Крок 3. Автоматизація через action-apt-repo
Додайте workflow `.github/workflows/apt-repo.yml`:
```yaml
name: Update APT Repository

on:
  release:
    types: [ published ]
  workflow_dispatch:

jobs:
  apt-repo:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Build Debian Packages
        run: |
          cd packages/qes-tools && ./build.sh

      - name: Deploy to GitHub Pages APT Repo
        uses: anton-yurchenko/action-apt-repo@v1
        with:
          repo-name: legaltech
          gpg-private-key: ${{ secrets.GPG_PRIVATE_KEY }}
          gpg-passphrase: ${{ secrets.GPG_PASSPHRASE }}
          file: packages/qes-tools/dist/*.deb
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

## 💻 Як користувачі підключають ваш репозиторій

Після публікації репозиторію користувачеві достатньо виконати 3 команди у своєму терміналі:

```bash
# 1. Завантажити публічний GPG-ключ
curl -fsSL https://yaroslavbaienko.github.io/legaltech/public-key.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/legaltech.gpg

# 2. Додати джерело репозиторію в APT
echo "deb [signed-by=/etc/apt/keyrings/legaltech.gpg] https://yaroslavbaienko.github.io/legaltech stable main" | sudo tee /etc/apt/sources.list.d/legaltech.list

# 3. Оновити індекси та встановити пакет
sudo apt update
sudo apt install qes-tools
```
