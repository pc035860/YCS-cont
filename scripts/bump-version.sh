#!/bin/bash
# bump-version.sh - Semantic version bumping tool
# Usage: ./bump-version.sh [major|minor|patch]
#
# Updates version in both app/manifest.json and app/manifest.firefox.json

set -e

TYPE="${1:-patch}"
MANIFEST_CHROME="app/manifest.json"
MANIFEST_FIREFOX="app/manifest.firefox.json"

# Validate bump type
if [[ ! "$TYPE" =~ ^(major|minor|patch)$ ]]; then
    echo "❌ Invalid bump type: $TYPE"
    echo "Usage: $0 [major|minor|patch]"
    exit 1
fi

# Check if manifest files exist
if [ ! -f "$MANIFEST_CHROME" ]; then
    echo "❌ $MANIFEST_CHROME not found"
    exit 1
fi

if [ ! -f "$MANIFEST_FIREFOX" ]; then
    echo "❌ $MANIFEST_FIREFOX not found"
    exit 1
fi

# Extract current version from Chrome manifest
CURRENT_VERSION=$(grep -o '"version": *"[^"]*"' "$MANIFEST_CHROME" | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')

if [ -z "$CURRENT_VERSION" ]; then
    echo "❌ Cannot parse version from $MANIFEST_CHROME"
    exit 1
fi

echo "Current version: $CURRENT_VERSION"

# Parse version parts
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR="${VERSION_PARTS[0]}"
MINOR="${VERSION_PARTS[1]}"
PATCH="${VERSION_PARTS[2]}"

# Bump version based on type
case "$TYPE" in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

echo "New version: $NEW_VERSION"

# Update both manifest files (macOS-compatible sed)
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/\"version\": *\"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST_CHROME"
    sed -i '' "s/\"version\": *\"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST_FIREFOX"
else
    sed -i "s/\"version\": *\"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST_CHROME"
    sed -i "s/\"version\": *\"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST_FIREFOX"
fi

echo "✅ Updated $MANIFEST_CHROME: $CURRENT_VERSION → $NEW_VERSION"
echo "✅ Updated $MANIFEST_FIREFOX: $CURRENT_VERSION → $NEW_VERSION"

# Output new version for Makefile to capture
echo "$NEW_VERSION"
