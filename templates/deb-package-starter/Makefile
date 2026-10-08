# Makefile для швидкого тестування та збірки пакета

.PHONY: all build test lint clean install

all: test build

build:
	@chmod +x build.sh src/*.sh bin/* 2>/dev/null || true
	@./build.sh

test:
	@chmod +x src/*.sh tests/*.sh 2>/dev/null || true
	@./tests/test_basic.sh

lint:
	@if command -v shellcheck >/dev/null 2>&1; then \
		shellcheck build.sh src/*.sh tests/*.sh debian/postinst debian/prerm; \
	else \
		echo "shellcheck не встановлено"; \
	fi

clean:
	@rm -rf build/ dist/

install: build
	@sudo apt install ./dist/*.deb
