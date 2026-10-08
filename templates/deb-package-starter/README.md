# 🚀 Debian Package Starter Template (Boilerplate)

Універсальний стартовий шаблон для розробки будь-якого нового `.deb` пакета для Debian / Ubuntu відповідно до стандартів Debian Policy.

---

## 📁 Структура каталогу

```text
.
├── debian/
│   ├── control       # Залежності, назва, архітектура, опис
│   ├── copyright     # Ліцензія та автори (machine-readable dep5)
│   ├── changelog     # Журнал версій
│   ├── rules         # Сценарій debhelper (опціонально)
│   ├── postinst      # Дії після інсталяції (налаштування прав, демони)
│   └── prerm         # Дії перед видаленням
├── src/              # Вихідний код вашого інструменту
├── bin/              # Бінарні лаунчери для /usr/bin/
├── tests/            # Автоматичні тести
├── build.sh          # Скрипт автоматичної збірки через dpkg-deb
├── Makefile          # Зручні команди (make build, make test, make clean)
└── README.md
```

---

## ⚡ Як створити новий пакет

### Варіант 1. Автоматично через генератор:
З кореня репозиторію `legaltech`:
```bash
./tools/new-deb-package.sh my-cool-tool "Короткий опис інструмента"
```

### Варіант 2. Вручну:
1. Скопіюйте каталог `templates/deb-package-starter` у `packages/<назва-пакета>`.
2. Замініть змінні `{{PACKAGE_NAME}}`, `{{VERSION}}`, `{{MAINTAINER_NAME}}` у `debian/control`, `debian/changelog`, `debian/copyright`.
3. Додайте ваш вихідний код у `src/`.
4. Запустіть тестування та збірку:
   ```bash
   make test
   make build
   ```
5. Готовий `.deb` буде створено в `dist/<назва-пакета>_<версія>_<архітектура>.deb`.
