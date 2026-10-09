# ==============================================================================
# Makefile — Main Dispatcher for the LegalTech Ecosystem
# ==============================================================================

.PHONY: all help test build new-package clean lint

help:
	@echo "LegalTech Debian Ecosystem Commands:"
	@echo "  make test          — Run qes-tools tests (unit + e2e)"
	@echo "  make build         — Build qes-tools deb package in packages/qes-tools/dist/"
	@echo "  make new-package   — Create a new deb package from template (NAME=my-tool)"
	@echo "  make clean         — Clean temporary build/ and dist/ directories"
	@echo "  make lint          — Check scripts with shellcheck (if installed)"

test:
	@echo "==> Running qes-tools test suites..."
	@cd packages/qes-tools && npm test
	@cd packages/qes-tools && ./tests/e2e_all_scenarios.sh

build:
	@echo "==> Building qes-tools deb package..."
	@cd packages/qes-tools && ./build.sh

new-package:
	@./tools/new-deb-package.sh $(NAME)

clean:
	@rm -rf packages/*/build packages/*/dist dist/

lint:
	@if command -v shellcheck >/dev/null 2>&1; then \
		echo "==> Linting shell scripts with shellcheck..."; \
		shellcheck tools/*.sh packages/qes-tools/build.sh packages/qes-tools/nautilus-scripts/*.sh; \
	else \
		echo "shellcheck not found (install via: sudo apt install shellcheck)"; \
	fi
