# 📦 Посібник зі встановлення та оновлення пакетів LegalTech

Цей посібник містить повні, перевірені інструкції для встановлення, налаштування та автоматичного оновлення пакетів екосистеми **LegalTech** (зокрема флагманського пакета `qes-tools`) в операційних системах **Debian**, **Ubuntu**, **Linux Mint** та інших дистрибутивах на базі Debian.

---

## 🌟 Спосіб 1. Встановлення через офіційний APT-репозиторій (Рекомендовано)

Підключення офіційного APT-репозиторію забезпечує:
- 🔄 **Автоматичні оновлення**: отримати нову версію можна стандартною системною командою `sudo apt update && sudo apt upgrade`.
- 🛡️ **Криптографічний захист**: кожен реліз перевіряється офіційним цифровим GPG-підписом розробника.
- 📦 **Автоматичне розв'язання залежностей**: системні бібліотеки (`nodejs`, `python3-cryptography`, `zenity`, `ocrmypdf`, `tesseract-ocr-ukr` тощо) завантажуються та встановлюються автоматично.

### Швидке підключення в 1 команду (One-Liner):

Скопіюйте та виконайте в терміналі:

```bash
sudo mkdir -p /etc/apt/keyrings && \
curl -fsSL https://yaroslavbaienko.github.io/legaltech/public.gpg | gpg --dearmor | sudo tee /etc/apt/keyrings/legaltech.gpg > /dev/null && \
sudo chmod 644 /etc/apt/keyrings/legaltech.gpg && \
echo "deb [signed-by=/etc/apt/keyrings/legaltech.gpg] https://yaroslavbaienko.github.io/legaltech stable main" | sudo tee /etc/apt/sources.list.d/legaltech.list > /dev/null && \
sudo apt update && \
sudo apt install -y qes-tools
```

---

### Покрокове встановлення:

#### Крок 1. Завантаження та збереження публічного GPG-ключа
Для безпеки та сумісності з сучасними версіями Debian/Ubuntu ключ розміщується в ізольованому каталозі `/etc/apt/keyrings/`:

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://yaroslavbaienko.github.io/legaltech/public.gpg | gpg --dearmor | sudo tee /etc/apt/keyrings/legaltech.gpg > /dev/null
sudo chmod 644 /etc/apt/keyrings/legaltech.gpg
```

*(Якщо ви працюєте з локальної копії репозиторію legaltech, ключ можна імпортувати без інтернету):*
```bash
gpg --dearmor < keys/public.gpg | sudo tee /etc/apt/keyrings/legaltech.gpg > /dev/null
sudo chmod 644 /etc/apt/keyrings/legaltech.gpg
```

#### Крок 2. Додавання репозиторію в системні джерела APT
Створіть конфігураційний файл `/etc/apt/sources.list.d/legaltech.list`:

```bash
echo "deb [signed-by=/etc/apt/keyrings/legaltech.gpg] https://yaroslavbaienko.github.io/legaltech stable main" | sudo tee /etc/apt/sources.list.d/legaltech.list
```

#### Крок 3. Оновлення списку пакетів
```bash
sudo apt update
```

Ви повинні побачити рядок підтвердження:
```text
Get:... https://yaroslavbaienko.github.io/legaltech stable InRelease [2,349 B]
Hit:... https://yaroslavbaienko.github.io/legaltech stable/main amd64 Packages
```

#### Крок 4. Встановлення пакета
```bash
sudo apt install -y qes-tools
```

---

## 💻 Спосіб 2. Локальне встановлення завантаженого `.deb` файлу

Якщо вам потрібно встановити пакет офлайн або протестувати конкретну версію:

1. Завантажте файл `.deb` зі сторінки [GitHub Releases](https://github.com/YaroslavBaienko/legaltech/releases).
2. Встановіть його за допомогою менеджера `apt` (він сам завантажить системні залежності):

```bash
sudo apt install ./qes-tools_1.0.3_amd64.deb
```

> ⚠️ **Зверніть увагу:** При локальному встановленні окремого файлу система не зможе автоматично оновлювати його через `apt upgrade`, доки не буде підключено офіційний APT-репозиторій (Спосіб 1).

---

## 🔍 Перевірка встановлення та джерела пакета

Щоб переконатися, яка версія встановлена і з якого саме репозиторію, виконайте:

```bash
apt policy qes-tools
```

Зразковий вивід:
```text
qes-tools:
  Installed: 1.0.3
  Candidate: 1.0.3
  Version table:
 *** 1.0.3 500
        500 https://yaroslavbaienko.github.io/legaltech stable/main amd64 Packages
        100 /var/lib/dpkg/status
```

Також перевірте працездатність CLI-утиліт:
```bash
qes-sign --help
qes-agent status
```

У файловому менеджері **Nautilus**: правий клік на будь-якому файлі ➔ меню **Скрипти** ➔ **`🔐 КЕП та Безпека`** (16 доступних сценаріїв).

---

## 🔄 Як працює автоматичне оновлення

Коли розробники випускають оновлення (наприклад, версію `1.0.4`):
1. Ви виконуєте стандартні команди обслуговування системи:
   ```bash
   sudo apt update
   sudo apt upgrade
   ```
2. Менеджер `APT` виявляє, що версія на сервері новіша за встановлену:
   ```text
   The following packages will be upgraded:
     qes-tools (1.0.3 => 1.0.4)
   ```
3. Пакет оновлюється без втрати ваших персональних ключів, налаштувань чи сесій.

---

## 🗑️ Видалення пакета з системи

### 1. Звичайне видалення (збереження конфігурацій):
```bash
sudo apt remove qes-tools
```

### 2. Повне очищення (Purge):
Видаляє пакет, усі системні бінарники з `/usr/bin/` та меню з файлового менеджера Nautilus:
```bash
sudo apt purge qes-tools
```

### 3. Відключення репозиторію (якщо більше не потрібен):
```bash
sudo rm -f /etc/apt/sources.list.d/legaltech.list
sudo rm -f /etc/apt/keyrings/legaltech.gpg
sudo apt update
```

---

## 🛠️ Вирішення можливих проблем (Troubleshooting)

### 1. Помилка: `Failed to parse keyring "/etc/apt/keyrings/legaltech.gpg": No such file or directory`
**Причина:** Джерело репозиторію було додано до `/etc/apt/sources.list.d/`, але файл публічного ключа ще не записався.
**Рішення:**
```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://yaroslavbaienko.github.io/legaltech/public.gpg | gpg --dearmor | sudo tee /etc/apt/keyrings/legaltech.gpg > /dev/null
sudo chmod 644 /etc/apt/keyrings/legaltech.gpg
sudo apt update
```

### 2. Debian 13 (Trixie) та рушій `sqv` (Sequoia PGP)
У Debian 13 валідація підписів здійснюється новим рушієм `sqv`. Він вимагає:
- Суворе дотримання формату binary keyring (`gpg --dearmor`).
- Права доступу `0644` на файл ключа (користувач `_apt` повинен мати доступ до читання).
Виконання команд із цього посібника гарантує повну сумісність як з Debian 12 (Bookworm), так і з Debian 13 (Trixie) та Ubuntu 24.04 LTS.
