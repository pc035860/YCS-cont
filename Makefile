.PHONY: help release build-chrome build-firefox build-all clean

# Configuration
APP_DIR := app
DIST_PATH := $(APP_DIR)/dist

# Default target
help:
	@echo "YCS Release Management"
	@echo ""
	@echo "Usage:"
	@echo "  make release TYPE=[major|minor|patch]  - Create new release"
	@echo "  make build-chrome VERSION=x.y.z        - Build Chrome extension"
	@echo "  make build-firefox VERSION=x.y.z       - Build Firefox extension"
	@echo "  make build-all VERSION=x.y.z           - Build both platforms"
	@echo "  make clean                             - Clean packing directory"
	@echo ""
	@echo "Example:"
	@echo "  make release TYPE=patch                - Release 1.3.5 → 1.3.6"

# Main release workflow
release:
	@if [ -z "$(TYPE)" ]; then \
		echo "❌ TYPE is required (major|minor|patch)"; \
		echo "Usage: make release TYPE=patch"; \
		exit 1; \
	fi
	@echo "🚀 Starting release process (TYPE=$(TYPE))..."
	@echo ""

	# Step 1: Bump version in both manifests
	@echo "📝 Step 1: Updating version in app/manifest.json and app/manifest.firefox.json..."
	@VERSION=$$(./scripts/bump-version.sh $(TYPE) | tail -1) && \
	echo "" && \
	\
	echo "📦 Step 2: Committing changes..." && \
	git add app/manifest.json app/manifest.firefox.json && \
	git commit -m "Bump version to $$VERSION" && \
	git tag -a "v$$VERSION" -m "Release v$$VERSION" && \
	echo "" && \
	\
	echo "🏗️  Step 3: Building extensions..." && \
	$(MAKE) build-all VERSION=$$VERSION && \
	echo "" && \
	\
	echo "✅ Release v$$VERSION completed!" && \
	echo "" && \
	echo "📋 Summary:" && \
	echo "   - Version: v$$VERSION" && \
	echo "   - Git tag: v$$VERSION" && \
	echo "   - Chrome: packing/chrome-$$VERSION.zip" && \
	echo "   - Firefox: packing/firefox-$$VERSION.zip" && \
	echo "" && \
	echo "Next steps:" && \
	echo "   1. Review the packages in packing/" && \
	echo "   2. git push origin main --tags"

# Build Chrome extension
build-chrome:
	@if [ -z "$(VERSION)" ]; then \
		echo "❌ VERSION is required"; \
		exit 1; \
	fi
	@echo "🔨 Building Chrome extension v$(VERSION)..."
	@./scripts/build-extension.sh chrome
	@./scripts/package-extension.sh chrome $(VERSION) "$(DIST_PATH)"

# Build Firefox extension
build-firefox:
	@if [ -z "$(VERSION)" ]; then \
		echo "❌ VERSION is required"; \
		exit 1; \
	fi
	@echo "🦊 Building Firefox extension v$(VERSION)..."
	@./scripts/build-extension.sh firefox
	@./scripts/package-extension.sh firefox $(VERSION) "$(DIST_PATH)"

# Build both platforms
build-all:
	@if [ -z "$(VERSION)" ]; then \
		echo "❌ VERSION is required"; \
		exit 1; \
	fi
	@$(MAKE) build-chrome VERSION=$(VERSION)
	@echo ""
	@$(MAKE) build-firefox VERSION=$(VERSION)

# Clean packing directory
clean:
	@echo "🧹 Cleaning packing directory..."
	@rm -rf packing/*.zip
	@rm -rf packing/YCS-cont/*-*
	@echo "✅ Cleaned"
