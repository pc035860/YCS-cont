#!/bin/bash
# package-extension.sh - Package built extension to packing directory
# Usage: ./package-extension.sh [chrome|firefox] [version] [dist_path]

set -e

PLATFORM="$1"
VERSION="$2"
DIST_PATH="${3:-app/dist}"

# Validate parameters
if [[ ! "$PLATFORM" =~ ^(chrome|firefox)$ ]]; then
    echo "❌ Invalid platform: $PLATFORM"
    echo "Usage: $0 [chrome|firefox] [version] [dist_path]"
    exit 1
fi

if [ -z "$VERSION" ]; then
    echo "❌ Version is required"
    echo "Usage: $0 [chrome|firefox] [version] [dist_path]"
    exit 1
fi

if [ ! -d "$DIST_PATH" ]; then
    echo "❌ Dist path not found: $DIST_PATH"
    exit 1
fi

# Setup paths
PACKING_DIR="packing"
CONT_DIR="$PACKING_DIR/YCS-cont"
PLATFORM_DIR="$CONT_DIR/${PLATFORM}-${VERSION}"
ZIP_FILE="$PACKING_DIR/${PLATFORM}-${VERSION}.zip"

echo "📦 Packaging $PLATFORM extension v$VERSION..."

# Create directories
mkdir -p "$PLATFORM_DIR"

# Copy dist files
echo "Copying files from $DIST_PATH..."
cp -R "$DIST_PATH"/* "$PLATFORM_DIR/"

# Create zip file
echo "Creating archive: $ZIP_FILE"

# Save current directory
ORIG_DIR=$(pwd)

if [ "$PLATFORM" = "firefox" ]; then
    # Firefox: zip directly from dist without parent folder
    cd "$DIST_PATH"
    zip -r "$ORIG_DIR/${ZIP_FILE}" . > /dev/null
else
    # Chrome: zip with parent folder
    FOLDER_NAME="${PLATFORM}-${VERSION}"
    cd "$CONT_DIR"
    zip -r "$ORIG_DIR/${ZIP_FILE}" "$FOLDER_NAME" > /dev/null
fi

cd "$ORIG_DIR"

echo "✅ Package created:"
echo "   - Directory: $PLATFORM_DIR"
echo "   - Archive: $ZIP_FILE"
