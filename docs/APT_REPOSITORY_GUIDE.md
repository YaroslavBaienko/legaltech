# 🌐 Посібник з розгортання та адміністрування APT-репозиторію на GitHub Pages

Цей посібник описує архітектуру, налаштування та щоденне обслуговування власного статичного **APT-репозиторію** для Debian та Ubuntu на базі **GitHub Pages** та **GitHub Actions** в екосистемі **LegalTech**.

---

## 🏗️ 1. Архітектура статичного APT-репозиторію

Менеджер пакетів `APT` не вимагає складного бекенду або бази даних. Він працює через звичайні статичні HTTP/HTTPS файли стандартизованої структури:

```text
https://yaroslavbaienko.github.io/legaltech/
│
├── .nojekyll                                  # Запобігає обробці Jekyll на GitHub Pages
├── index.html                                 # Веб-вітрина репозиторію з інструкціями
├── public.gpg / KEY.gpg                       # Відкритий GPG-ключ для верифікації
│
├── pool/                                      # Каталог бінарних deb-пакетів
│   └── main/
│       ├── qes-tools_1.0.2_amd64.deb
│       └── qes-tools_1.0.3_amd64.deb
│
└── dists/                                     # Метадані та індекси дистрибутивів
    └── stable/
        ├── InRelease                          # Маніфест з вбудованим цифровим GPG-підписом
        ├── Release                            # Текстовий маніфест з контрольними сумами
        ├── Release.gpg                        # Відокремлений цифровий GPG-підпис
        └── main/
            └── binary-amd64/
                ├── Packages                   # Текстовий список доступних пакетів та версій
                └── Packages.gz                # Стиснутий індекс для швидкого завантаження APT
```

Завдяки цьому **GitHub Pages** працює як безкоштовний, відмовостійкий, глобально розподілений (CDN) APT-репозиторій із підтримкою HTTPS.

---

## 🔐 2. Безпека та криптографічний підпис (GPG)

Кожен реліз репозиторію підписується цифровим підписом.

### Ізоляція ключів:
- Особисті GPG-ключі розробника **не використовуються**.
- Створено окрему 4096-бітну RSA пару ключів:
  `LegalTech APT Repository <zerhug@gmail.com>` (ID: `C7E35514B6251C8B4E58A28BF8F3BF5DBA24A05A`).
- **Закритий ключ** зберігається виключно в зашифрованих секретах GitHub Actions:
  `Settings ➔ Secrets and variables ➔ Actions ➔ GPG_PRIVATE_KEY`.
- Локальні копії приватного ключа безпечно видалені (`shred`).
- **Відкритий ключ** зберігається у файлі `keys/public.gpg` та автоматично публікується на GitHub Pages як `public.gpg`.

---

## 🛠️ 3. Локальна генерація репозиторію (`build-apt-repo.sh`)

У каталозі `tools/` створено автономний скрипт [`build-apt-repo.sh`](../tools/build-apt-repo.sh), який дозволяє зібрати та протестувати репозиторій локально або в CI/CD:

```bash
# Запуск генератора (за замовчуванням створює дерево в dist-apt/)
./tools/build-apt-repo.sh /шлях/до/папки/призначення
```

### Що робить скрипт:
1. Знаходить усі зібрані `.deb` файли в `packages/*/dist/` та копіює їх у `pool/main/`.
2. Запускає утиліту `apt-ftparchive packages` для генерації `Packages` та `Packages.gz`.
3. Запускає `apt-ftparchive release` для формування маніфесту `Release` з усіма контрольними сумами (MD5, SHA1, SHA256, SHA512).
4. Якщо доступний GPG-ключ (змінна оточення `GPG_PRIVATE_KEY`), генерує цифрові підписи `Release.gpg` та `InRelease`.
5. Створює файл `.nojekyll` та стильну веб-сторінку `index.html`.

---

## 🤖 4. Автоматизація CI/CD в GitHub Actions

Процес розгортання повністю автоматизовано у файлі [`.github/workflows/apt-repo.yml`](../.github/workflows/apt-repo.yml).

### Тригери запуску:
1. **Створення релізного тегу**: `git push origin v1.0.4`
2. **Публікація GitHub Release**: створення релізу в інтерфейсі GitHub.
3. **Ручний запуск (Manual Dispatch)**: кнопка **Run workflow** у вкладці Actions або команда:
   ```bash
   gh workflow run "Update APT Repository"
   ```

### Робочий процес GitHub Actions:
1. Створює віртуальну машину `ubuntu-latest`.
2. Встановлює системні утиліти пакування: `dpkg-dev`, `apt-utils`, `binutils`, `lintian`, `typst`.
3. Збирає найновіші deb-пакети через `./packages/<пакет>/build.sh`.
4. Підтягує попередні версії пакетів із гілки `gh-pages` (щоб старі версії не зникали з архіву).
5. Викликає `./tools/build-apt-repo.sh`.
6. Підписує репозиторій закритим ключем із секрету `GPG_PRIVATE_KEY`.
7. Публікує результат у гілку **`gh-pages`**, після чого GitHub Pages миттєво оновлює сайт.

---

## 🚀 5. Як випустити оновлення пакета (Крок за кроком)

Коли ви внесли зміни в код пакета (наприклад, `qes-tools`):

### Крок 1. Підняти версію
1. Оновіть `PKG_VERSION="1.0.4"` у `packages/qes-tools/build.sh`.
2. Оновіть версію в `packages/qes-tools/debian/control`: `Version: 1.0.4`.
3. Оновіть версію в `packages/qes-tools/package.json`: `"version": "1.0.4"`.

### Крок 2. Зробити коміт та створити Git-тег
```bash
git commit -am "chore(release): bump version to v1.0.4"
git tag v1.0.4
git push origin main --tags
```

### Крок 3. Все решта — автоматично!
- GitHub Actions запустить workflow `Update APT Repository`.
- Новий файл `qes-tools_1.0.4_amd64.deb` потрапить у `pool/main/`.
- Індекси `Packages.gz` та `InRelease` буде підписано та оновлено на GitHub Pages.

---

## 👥 6. Як користувачам підключити ваш репозиторій

Для кінцевих користувачів усе зводиться до 1 команди:

```bash
sudo mkdir -p /etc/apt/keyrings && \
curl -fsSL https://yaroslavbaienko.github.io/legaltech/public.gpg | gpg --dearmor | sudo tee /etc/apt/keyrings/legaltech.gpg > /dev/null && \
sudo chmod 644 /etc/apt/keyrings/legaltech.gpg && \
echo "deb [signed-by=/etc/apt/keyrings/legaltech.gpg] https://yaroslavbaienko.github.io/legaltech stable main" | sudo tee /etc/apt/sources.list.d/legaltech.list > /dev/null && \
sudo apt update && \
sudo apt install -y qes-tools
```

Детальнішу інформацію для користувачів дивіться у файлі [docs/INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md).
