#!/bin/bash
# build-extension.sh - Build Chrome/Firefox extension
# Usage: ./build-extension.sh [chrome|firefox]
#
# Builds extension in app/ directory using the appropriate manifest

set -e

PLATFORM=$1
APP_DIR="app"

# Validate platform
if [[ ! "$PLATFORM" =~ ^(chrome|firefox)$ ]]; then
    echo "❌ Invalid platform: $PLATFORM"
    echo "Usage: $0 [chrome|firefox]"
    exit 1
fi

echo "🏗️  Building $PLATFORM extension..."
echo ""

# Step 1: Copy appropriate manifest to src/static/
echo "📋 Step 1: Preparing manifest..."
if [ "$PLATFORM" = "firefox" ]; then
    cp "$APP_DIR/manifest.firefox.json" "$APP_DIR/src/static/manifest.json"
    echo "✅ Using Firefox manifest"
else
    cp "$APP_DIR/manifest.json" "$APP_DIR/src/static/manifest.json"
    echo "✅ Using Chrome manifest"
fi
echo ""

# Step 2: Navigate to app directory
cd "$APP_DIR"

# Step 3: Switch Node version if nvm is available
echo "🔧 Step 2: Checking Node version..."
if [ -f ~/.nvm/nvm.sh ] && [ -f .nvmrc ]; then
    echo "   Switching to Node $(cat .nvmrc)..."
    source ~/.nvm/nvm.sh
    nvm use
    echo "   ✅ Current Node version: $(node --version)"
elif [ -f .nvmrc ]; then
    echo "   ⚠️  Warning: nvm not found, but project requires Node $(cat .nvmrc)"
    echo "   Current Node version: $(node --version)"
else
    echo "   ✅ Current Node version: $(node --version)"
fi
echo ""

# Step 4: Clean and build
# Use rebuild instead of build to ensure clean, reproducible releases
# and avoid Parcel cache pollution issues (prevents bundle size inconsistencies)
echo "🧹 Step 3: Cleaning dist/..."
rm -rf dist/
echo ""

echo "📦 Step 4: Running clean rebuild..."
npm run rebuild
echo ""

echo "✅ $PLATFORM extension built successfully!"
echo "📁 Output: $(pwd)/dist/"
