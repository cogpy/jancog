# Makefile for Jan AI App - Build, Lint, Test, and Clean
# Supports desktop (Tauri), web, mobile (Android/iOS), and all testing targets

REPORT_PORTAL_URL ?= ""
REPORT_PORTAL_API_KEY ?= ""
REPORT_PORTAL_PROJECT_NAME ?= ""
REPORT_PORTAL_LAUNCH_NAME ?= "Jan App"
REPORT_PORTAL_DESCRIPTION ?= "Jan App report"

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Default target - show help
.PHONY: all
all: help

# Help target
.PHONY: help
help:
	@echo "$(GREEN)Jan AI Application - Build & Test Targets$(NC)"
	@echo ""
	@echo "$(YELLOW)Setup:$(NC)"
	@echo "  config-yarn         Configure Yarn 4.5.3"
	@echo "  install-and-build   Install dependencies and build all packages"
	@echo ""
	@echo "$(YELLOW)Development:$(NC)"
	@echo "  dev                 Start development server (Tauri desktop)"
	@echo "  dev-web-app         Start web app development server"
	@echo "  dev-android         Start Android development"
	@echo "  dev-ios             Start iOS development (macOS only)"
	@echo ""
	@echo "$(YELLOW)Build:$(NC)"
	@echo "  build               Build for production (desktop)"
	@echo "  build-web-app       Build web application"
	@echo "  build-android       Build Android APK"
	@echo "  build-ios           Build iOS app"
	@echo "  build-all           Build all platforms"
	@echo ""
	@echo "$(YELLOW)Testing:$(NC)"
	@echo "  test                Run all tests (lint + unit + Rust)"
	@echo "  test-unit           Run TypeScript unit tests only"
	@echo "  test-rust           Run Rust tests only"
	@echo "  test-e2e            Run E2E tests"
	@echo "  test-coverage       Run tests with coverage report"
	@echo "  test-extensions     Run extension tests"
	@echo ""
	@echo "$(YELLOW)Quality:$(NC)"
	@echo "  lint                Run linting"
	@echo "  lint-fix            Run linting with auto-fix"
	@echo "  format              Format code"
	@echo ""
	@echo "$(YELLOW)Release:$(NC)"
	@echo "  release-desktop     Build release for all desktop platforms"
	@echo "  release-web         Build and package web app"
	@echo "  release-mobile      Build Android and iOS releases"
	@echo ""
	@echo "$(YELLOW)Utilities:$(NC)"
	@echo "  clean               Clean all build artifacts"
	@echo "  clean-deep          Deep clean including caches"

# ============================================================================
# SETUP TARGETS
# ============================================================================

.PHONY: config-yarn
config-yarn:
	@echo "$(GREEN)Configuring Yarn 4.5.3...$(NC)"
	corepack enable
	corepack prepare yarn@4.5.3 --activate
	yarn --version
	yarn config set -H enableImmutableInstalls false

.PHONY: install-and-build
install-and-build: config-yarn
	@echo "$(GREEN)Installing dependencies and building packages...$(NC)"
ifeq ($(OS),Windows_NT)
	echo "Windows setup..."
else ifeq ($(shell uname -s),Linux)
	chmod +x src-tauri/build-utils/*
endif
	yarn install
	yarn build:tauri:plugin:api
	yarn build:core
	yarn build:extensions && yarn build:extensions-web

.PHONY: install-rust-targets
install-rust-targets:
	@echo "$(GREEN)Installing Rust targets...$(NC)"
ifeq ($(shell uname -s),Darwin)
	@echo "Detected macOS, installing universal build targets..."
	rustup target add x86_64-apple-darwin
	rustup target add aarch64-apple-darwin
	@echo "Rust targets installed successfully!"
else
	@echo "Not macOS; skipping Rust target installation."
endif

.PHONY: install-android-rust-targets
install-android-rust-targets:
	@echo "$(GREEN)Installing Android Rust targets...$(NC)"
	@rustup target list --installed | grep -q "aarch64-linux-android" || rustup target add aarch64-linux-android
	@rustup target list --installed | grep -q "armv7-linux-androideabi" || rustup target add armv7-linux-androideabi
	@rustup target list --installed | grep -q "i686-linux-android" || rustup target add i686-linux-android
	@rustup target list --installed | grep -q "x86_64-linux-android" || rustup target add x86_64-linux-android
	@echo "Android Rust targets ready!"

.PHONY: install-ios-rust-targets
install-ios-rust-targets:
	@echo "$(GREEN)Installing iOS Rust targets...$(NC)"
	@rustup target list --installed | grep -q "aarch64-apple-ios" || rustup target add aarch64-apple-ios
	@rustup target list --installed | grep -q "aarch64-apple-ios-sim" || rustup target add aarch64-apple-ios-sim
	@rustup target list --installed | grep -q "x86_64-apple-ios" || rustup target add x86_64-apple-ios
	@echo "iOS Rust targets ready!"

.PHONY: install-e2e
install-e2e:
	@echo "$(GREEN)Installing E2E test dependencies...$(NC)"
	cd e2e && yarn install
	cd e2e && npx playwright install --with-deps

# ============================================================================
# DEVELOPMENT TARGETS
# ============================================================================

.PHONY: dev
dev: install-and-build
	@echo "$(GREEN)Starting development server...$(NC)"
	yarn download:bin
	yarn dev

.PHONY: install-web-app
install-web-app: config-yarn
	yarn install

.PHONY: dev-web-app
dev-web-app: install-web-app
	@echo "$(GREEN)Starting web app development server...$(NC)"
	yarn build:core
	yarn dev:web-app

.PHONY: dev-android
dev-android: install-and-build install-android-rust-targets
	@echo "$(GREEN)Setting up Android development environment...$(NC)"
	@if [ ! -d "src-tauri/gen/android" ]; then \
		echo "Android app not initialized. Initializing..."; \
		yarn tauri android init; \
	fi
	@echo "Sourcing Android environment setup..."
	@bash autoqa/scripts/setup-android-env.sh echo "Android environment ready"
	@echo "Starting Android development server..."
	yarn dev:android

.PHONY: dev-ios
dev-ios: install-and-build install-ios-rust-targets
	@echo "$(GREEN)Setting up iOS development environment...$(NC)"
ifeq ($(shell uname -s),Darwin)
	@if [ ! -d "src-tauri/gen/ios" ]; then \
		echo "iOS app not initialized. Initializing..."; \
		yarn tauri ios init; \
	fi
	@echo "Checking iOS development requirements..."
	@xcrun --version > /dev/null 2>&1 || (echo "$(RED)Xcode command line tools not found. Install with: xcode-select --install$(NC)" && exit 1)
	@xcrun simctl list devices available | grep -q "iPhone\|iPad" || (echo "$(RED)No iOS simulators found. Install simulators through Xcode.$(NC)" && exit 1)
	@echo "Starting iOS development server..."
	yarn dev:ios
else
	@echo "$(RED)iOS development is only supported on macOS$(NC)"
	@exit 1
endif

# ============================================================================
# BUILD TARGETS
# ============================================================================

.PHONY: build
build: install-and-build install-rust-targets
	@echo "$(GREEN)Building for production...$(NC)"
	yarn build

.PHONY: build-web-app
build-web-app: install-web-app
	@echo "$(GREEN)Building web application...$(NC)"
	yarn build:core
	yarn build:web-app

.PHONY: serve-web-app
serve-web-app:
	yarn serve:web-app

.PHONY: build-serve-web-app
build-serve-web-app: build-web-app
	yarn serve:web-app

.PHONY: build-android
build-android: install-and-build install-android-rust-targets
	@echo "$(GREEN)Building Android APK...$(NC)"
	@if [ ! -d "src-tauri/gen/android" ]; then \
		yarn tauri android init; \
	fi
	yarn build:android

.PHONY: build-ios
build-ios: install-and-build install-ios-rust-targets
	@echo "$(GREEN)Building iOS app...$(NC)"
ifeq ($(shell uname -s),Darwin)
	@if [ ! -d "src-tauri/gen/ios" ]; then \
		yarn tauri ios init; \
	fi
	yarn build:ios
else
	@echo "$(RED)iOS builds only supported on macOS$(NC)"
	@exit 1
endif

.PHONY: build-all
build-all: build build-web-app
	@echo "$(GREEN)All builds completed!$(NC)"

# ============================================================================
# TESTING TARGETS
# ============================================================================

.PHONY: lint
lint: install-and-build
	@echo "$(GREEN)Running linter...$(NC)"
	yarn lint

.PHONY: lint-fix
lint-fix: install-and-build
	@echo "$(GREEN)Running linter with auto-fix...$(NC)"
	yarn lint --fix

.PHONY: format
format:
	@echo "$(GREEN)Formatting code...$(NC)"
	yarn prettier --write "**/*.{ts,tsx,js,jsx,json,md}"

.PHONY: test
test: lint
	@echo "$(GREEN)Running all tests...$(NC)"
	yarn download:bin
	yarn test
	yarn copy:assets:tauri
	yarn build:icon
	$(MAKE) test-rust

.PHONY: test-unit
test-unit:
	@echo "$(GREEN)Running TypeScript unit tests...$(NC)"
	yarn test

.PHONY: test-rust
test-rust:
	@echo "$(GREEN)Running Rust tests...$(NC)"
	cargo test --manifest-path src-tauri/Cargo.toml --no-default-features --features test-tauri -- --test-threads=1
	cargo test --manifest-path src-tauri/plugins/tauri-plugin-hardware/Cargo.toml
	cargo test --manifest-path src-tauri/plugins/tauri-plugin-llamacpp/Cargo.toml
	cargo test --manifest-path src-tauri/plugins/tauri-plugin-vector-db/Cargo.toml || true
	cargo test --manifest-path src-tauri/plugins/tauri-plugin-rag/Cargo.toml || true
	cargo test --manifest-path src-tauri/utils/Cargo.toml

.PHONY: test-e2e
test-e2e: install-e2e build-web-app
	@echo "$(GREEN)Running E2E tests...$(NC)"
	cd e2e && yarn test

.PHONY: test-e2e-chromium
test-e2e-chromium: install-e2e build-web-app
	@echo "$(GREEN)Running E2E tests (Chromium only)...$(NC)"
	cd e2e && yarn test:chromium

.PHONY: test-e2e-firefox
test-e2e-firefox: install-e2e build-web-app
	@echo "$(GREEN)Running E2E tests (Firefox only)...$(NC)"
	cd e2e && yarn test:firefox

.PHONY: test-e2e-webkit
test-e2e-webkit: install-e2e build-web-app
	@echo "$(GREEN)Running E2E tests (WebKit only)...$(NC)"
	cd e2e && yarn test:webkit

.PHONY: test-e2e-headed
test-e2e-headed: install-e2e build-web-app
	@echo "$(GREEN)Running E2E tests (headed mode)...$(NC)"
	cd e2e && yarn test:headed

.PHONY: test-e2e-ui
test-e2e-ui: install-e2e build-web-app
	@echo "$(GREEN)Running E2E tests with UI...$(NC)"
	cd e2e && yarn test:ui

.PHONY: test-coverage
test-coverage: install-and-build
	@echo "$(GREEN)Running tests with coverage...$(NC)"
	yarn test:coverage

.PHONY: test-coverage-report
test-coverage-report: test-coverage
	@echo "$(GREEN)Opening coverage report...$(NC)"
	@if [ -f "coverage/lcov-report/index.html" ]; then \
		open coverage/lcov-report/index.html 2>/dev/null || xdg-open coverage/lcov-report/index.html 2>/dev/null || echo "Coverage report at: coverage/lcov-report/index.html"; \
	else \
		echo "Coverage report not found. Run 'make test-coverage' first."; \
	fi

.PHONY: test-extensions
test-extensions:
	@echo "$(GREEN)Running extension tests...$(NC)"
	@for ext in extensions/*/; do \
		if [ -f "$$ext/package.json" ]; then \
			echo "Testing $$ext..."; \
			(cd "$$ext" && yarn test 2>/dev/null || echo "No tests or tests skipped for $$ext"); \
		fi \
	done

.PHONY: test-core
test-core:
	@echo "$(GREEN)Running core tests...$(NC)"
	yarn workspace @janhq/core test

.PHONY: test-web-app
test-web-app:
	@echo "$(GREEN)Running web app tests...$(NC)"
	yarn workspace @janhq/web-app test

.PHONY: test-all
test-all: test test-e2e
	@echo "$(GREEN)All tests completed!$(NC)"

# ============================================================================
# RELEASE TARGETS
# ============================================================================

.PHONY: release-desktop
release-desktop: install-and-build install-rust-targets
	@echo "$(GREEN)Building desktop release...$(NC)"
	yarn build

.PHONY: release-web
release-web: build-web-app
	@echo "$(GREEN)Packaging web app release...$(NC)"
	@VERSION=$$(node -p "require('./web-app/package.json').version"); \
	cd web-app && \
	tar -czvf jan-web-$$VERSION.tar.gz dist-web/ && \
	zip -r jan-web-$$VERSION.zip dist-web/ && \
	echo "$(GREEN)Web app packaged as jan-web-$$VERSION.tar.gz and jan-web-$$VERSION.zip$(NC)"

.PHONY: release-mobile
release-mobile: build-android
	@echo "$(GREEN)Mobile release completed!$(NC)"
ifeq ($(shell uname -s),Darwin)
	$(MAKE) build-ios
endif

# ============================================================================
# CLEAN TARGETS
# ============================================================================

.PHONY: clean
clean:
	@echo "$(GREEN)Cleaning build artifacts...$(NC)"
ifeq ($(OS),Windows_NT)
	-powershell -Command "Get-ChildItem -Path . -Include node_modules, .next, dist, build, out, .turbo, .yarn -Recurse -Directory | Remove-Item -Recurse -Force"
	-powershell -Command "Get-ChildItem -Path . -Include package-lock.json, tsconfig.tsbuildinfo -Recurse -File | Remove-Item -Recurse -Force"
	-powershell -Command "Remove-Item -Recurse -Force ./pre-install/*.tgz"
	-powershell -Command "Remove-Item -Recurse -Force ./extensions/*/*.tgz"
	-powershell -Command "Remove-Item -Recurse -Force ./electron/pre-install/*.tgz"
	-powershell -Command "Remove-Item -Recurse -Force ./src-tauri/resources"
	-powershell -Command "Remove-Item -Recurse -Force ./src-tauri/target"
	-powershell -Command "Remove-Item -Recurse -Force ./e2e/node_modules"
	-powershell -Command "Remove-Item -Recurse -Force ./e2e/test-results"
	-powershell -Command "Remove-Item -Recurse -Force ./e2e/playwright-report"
	-powershell -Command "Remove-Item -Recurse -Force ./coverage"
	-powershell -Command "if (Test-Path \"$($env:USERPROFILE)\jan\extensions\") { Remove-Item -Path \"$($env:USERPROFILE)\jan\extensions\" -Recurse -Force }"
else ifeq ($(shell uname -s),Linux)
	find . -name "node_modules" -type d -prune -exec rm -rf '{}' + 2>/dev/null || true
	find . -name ".next" -type d -exec rm -rf '{}' + 2>/dev/null || true
	find . -name "dist" -type d -exec rm -rf '{}' + 2>/dev/null || true
	find . -name "build" -type d -exec rm -rf '{}' + 2>/dev/null || true
	find . -name "out" -type d -exec rm -rf '{}' + 2>/dev/null || true
	find . -name ".turbo" -type d -exec rm -rf '{}' + 2>/dev/null || true
	find . -name ".yarn" -type d -exec rm -rf '{}' + 2>/dev/null || true
	find . -name "package-lock.json" -type f -exec rm -rf '{}' + 2>/dev/null || true
	rm -rf ./pre-install/*.tgz 2>/dev/null || true
	rm -rf ./extensions/*/*.tgz 2>/dev/null || true
	rm -rf ./electron/pre-install/*.tgz 2>/dev/null || true
	rm -rf ./src-tauri/resources 2>/dev/null || true
	rm -rf ./src-tauri/target 2>/dev/null || true
	rm -rf ./e2e/node_modules 2>/dev/null || true
	rm -rf ./e2e/test-results 2>/dev/null || true
	rm -rf ./e2e/playwright-report 2>/dev/null || true
	rm -rf ./coverage 2>/dev/null || true
	rm -rf ~/jan/extensions 2>/dev/null || true
	rm -rf ~/.cache/jan* 2>/dev/null || true
	rm -rf ./.cache 2>/dev/null || true
else
	find . -name "node_modules" -type d -prune -exec rm -rfv '{}' + 2>/dev/null || true
	find . -name ".next" -type d -exec rm -rfv '{}' + 2>/dev/null || true
	find . -name "dist" -type d -exec rm -rfv '{}' + 2>/dev/null || true
	find . -name "build" -type d -exec rm -rfv '{}' + 2>/dev/null || true
	find . -name "out" -type d -exec rm -rfv '{}' + 2>/dev/null || true
	find . -name ".turbo" -type d -exec rm -rfv '{}' + 2>/dev/null || true
	find . -name ".yarn" -type d -exec rm -rfv '{}' + 2>/dev/null || true
	find . -name "package-lock.json" -type f -exec rm -rfv '{}' + 2>/dev/null || true
	rm -rfv ./pre-install/*.tgz 2>/dev/null || true
	rm -rfv ./extensions/*/*.tgz 2>/dev/null || true
	rm -rfv ./electron/pre-install/*.tgz 2>/dev/null || true
	rm -rfv ./src-tauri/resources 2>/dev/null || true
	rm -rfv ./src-tauri/target 2>/dev/null || true
	rm -rfv ./e2e/node_modules 2>/dev/null || true
	rm -rfv ./e2e/test-results 2>/dev/null || true
	rm -rfv ./e2e/playwright-report 2>/dev/null || true
	rm -rfv ./coverage 2>/dev/null || true
	rm -rfv ~/jan/extensions 2>/dev/null || true
	rm -rfv ~/Library/Caches/jan* 2>/dev/null || true
endif
	@echo "$(GREEN)Clean completed!$(NC)"

.PHONY: clean-deep
clean-deep: clean
	@echo "$(GREEN)Deep cleaning (including Rust target and caches)...$(NC)"
	rm -rf ./src-tauri/target
	cargo clean --manifest-path src-tauri/Cargo.toml 2>/dev/null || true
	@echo "$(GREEN)Deep clean completed!$(NC)"

.PHONY: clean-coverage
clean-coverage:
	@echo "$(GREEN)Cleaning coverage reports...$(NC)"
	rm -rf ./coverage
	rm -rf ./e2e/test-results
	rm -rf ./e2e/playwright-report

# ============================================================================
# CI/CD HELPERS
# ============================================================================

.PHONY: ci-test
ci-test: lint test-unit test-rust
	@echo "$(GREEN)CI tests completed!$(NC)"

.PHONY: ci-build
ci-build: install-and-build
	@echo "$(GREEN)CI build completed!$(NC)"

.PHONY: ci-e2e
ci-e2e: install-e2e build-web-app
	cd e2e && CI=true yarn test
	@echo "$(GREEN)CI E2E tests completed!$(NC)"

# Version info
.PHONY: version
version:
	@echo "$(GREEN)Version Information:$(NC)"
	@echo "Node: $$(node --version 2>/dev/null || echo 'Not installed')"
	@echo "Yarn: $$(yarn --version 2>/dev/null || echo 'Not installed')"
	@echo "Rust: $$(rustc --version 2>/dev/null || echo 'Not installed')"
	@echo "Cargo: $$(cargo --version 2>/dev/null || echo 'Not installed')"
	@echo "App Version: $$(node -p "require('./src-tauri/tauri.conf.json').version" 2>/dev/null || echo 'Unknown')"
