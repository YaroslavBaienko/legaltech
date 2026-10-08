# ==============================================================================
# Makefile — Головний диспетчер екосистеми LegalTech
# ==============================================================================

.PHONY: all help test build new-package clean lint

help:
	@echo "LegalTech Debian Ecosystem Commands:"
	@echo "  make test          — Запустити тести qes-tools (unit + e2e)"
	@echo "  make build         — Зібрати deb-пакет qes-tools у packages/qes-tools/dist/"
	@echo "  make new-package   — Створити новий deb-пакет з шаблону (NAME=my-tool)"
	@echo "  make clean         — Очистити тимчасові каталоги build/ та dist/"
	@echo "  make lint          — Перевірити скрипти через shellcheck (якщо встановлено)"

test:
	@echo "==> Запуск тестів qes-tools..."
	@cd packages/qes-tools && npm test
	@cd packages/qes-tools && ./tests/e2e_all_scenarios.sh

build:
	@echo "==> Збірка deb-пакета qes-tools..."
	@cd packages/qes-tools && ./build.sh

new-package:
	@./tools/new-deb-package.sh $(NAME)

clean:
	@rm -rf packages/*/build packages/*/dist dist/

lint:
	@if command -v shellcheck >/dev/null 2>&1; then \
		echo "==> Перевірка shell скриптів через shellcheck..."; \
		shellcheck tools/*.sh packages/qes-tools/build.sh packages/qes-tools/nautilus-scripts/*.sh; \
	else \
		echo "shellcheck не знайдено (встановіть: sudo apt install shellcheck)"; \
	fi
