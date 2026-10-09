# 🇺🇦 LegalTech — Open Source Debian Packaging Ecosystem

Відкрита екосистема інструментів **LegalTech** та професійне середовище розробки `.deb` пакетів для Debian та Ubuntu.

Проєкт створено для юристів, адвокатів, арбітражних керуючих, ІТ-фахівців та дослідників. Усі інструменти проєкту сповідують фундаментальний принцип: **100% Offline-First, нульова телеметрія, захист персональних даних та суворе збереження адвокатської таємниці**.

---

## 🏛️ Пакети в екосистемі

| Пакет | Опис | Статус | Документація |
| :--- | :--- | :---: | :---: |
| **`qes-tools`** | Автономний комплекс КЕП/УЕП (ДСТУ 4145, CAdES, PAdES зі штампом та без штампа, QR, ASiC-E, ГОСТ шифрування, OCR для судів, 16 сценаріїв у Nautilus). | **v1.0.3** (Stable) | [README пакета](packages/qes-tools/README.md) |
| **`deb-package-starter`** | Універсальний стартовий шаблон для швидкої розробки будь-якого нового deb-пакета. | **Template** | [README шаблону](templates/deb-package-starter/README.md) |

---

## ⚡ Швидке встановлення та автоматичні оновлення

### 🌟 Офіційний APT-репозиторій (Рекомендовано для отримання `sudo apt upgrade`):

Підключіть репозиторій один раз у своєму терміналі:

```bash
# 1. Додати публічний GPG-ключ репозиторію
curl -fsSL https://yaroslavbaienko.github.io/legaltech/public.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/legaltech.gpg

# 2. Додати репозиторій LegalTech у список джерел APT
echo "deb [signed-by=/etc/apt/keyrings/legaltech.gpg] https://yaroslavbaienko.github.io/legaltech stable main" | sudo tee /etc/apt/sources.list.d/legaltech.list

# 3. Оновити індекси та встановити qes-tools
sudo apt update
sudo apt install qes-tools
```

Після цього будь-які нові версії будуть автоматично оновлюватися системною командою:
```bash
sudo apt update && sudo apt upgrade
```

---

### Або локальне встановлення готового `.deb` файлу:

Завантажте останній релізний `.deb` пакет з [Releases](https://github.com/YaroslavBaienko/legaltech/releases) та встановіть його:

```bash
sudo apt install ./packages/qes-tools/dist/qes-tools_1.0.3_amd64.deb
```

Менеджер пакетів `apt` автоматично розв'яже всі системні залежності. Після встановлення всі функції доступні:
- **У файловому менеджері GNOME (Nautilus)**: правий клік на будь-який файл ➔ **Скрипти** ➔ **`🔐 КЕП та Безпека`** (16 зручних сценаріїв).
- **У терміналі**: `qes-sign`, `qes-verify`, `qes-cert`, `qes-ocr`, `qes-pdf-court`, `qes-encrypt`, `qes-decrypt`, `qes-export-cert`, `qes-agent`.

---

## 🛠️ Середовище розробки та створення нових пакетів

Цей репозиторій спроєктовано як **фабрику розробки deb-пакетів** (Debian Packaging Workspace).

### Як створити новий пакет за 10 секунд:

1. Запустіть вбудований CLI-генератор:
   ```bash
   ./tools/new-deb-package.sh my-legal-tool "Швидкий інструмент для судових справ"
   ```
2. Генератор автоматично створить каталог `packages/my-legal-tool` з усіма стандартами Debian Policy (`control`, `copyright`, `changelog`, `build.sh`, `Makefile`, `tests/`).
3. Додайте свій вихідний код у `packages/my-legal-tool/src/`.
4. Запустіть тести та збірку:
   ```bash
   cd packages/my-legal-tool
   make test
   make build
   ```
5. Ваш новий `.deb` пакет готовий у папці `dist/`!

---

## 📚 Документація

- [📦 Посібник зі встановлення та оновлення пакетів](docs/INSTALLATION_GUIDE.md) — як користувачу підключити APT-репозиторій, встановити та оновлювати пакети через `sudo apt upgrade`.
- [📖 Практичний посібник з розробки Debian-пакетів](docs/DEB_PACKAGING_GUIDE.md) — анатомія `.deb`, FHS стандарти, правила `control`, робота з `lintian`.
- [🌐 Адміністрування та розгортання APT-репозиторію](docs/APT_REPOSITORY_GUIDE.md) — архітектура GitHub Pages репозиторію, автоматизація збірки та випуску оновлень.
- [🔐 Документація QES Tools](packages/qes-tools/README.md) — повний мануал по всіх 16 сценаріях та командах КЕП.

---

## 🧪 CI/CD та автоматизація

Усі пакети покриті наскрізними тестами та автоматизованими робочими процесами GitHub Actions:
- **`ci.yml`**: автоматичний запуск unit-тестів та E2E сценаріїв на чистому образі Ubuntu при кожному коміті.
- **`build-deb.yml`**: ізольована збірка `.deb` пакетів та збереження артефактів.
- **`apt-repo.yml`**: автоматична збірка, індексація, цифровий GPG-підпис та публікація APT-репозиторію на GitHub Pages.
- **`release.yml`**: автоматичний реліз та публікація бінарників при створенні git-тегу (`git tag v1.0.3 && git push origin v1.0.3`).

---

## ⚖️ Ліцензія

Вихідний код поширюється під ліцензією [Apache 2.0](LICENSE). Вільне використання, модифікація та розповсюдження.
