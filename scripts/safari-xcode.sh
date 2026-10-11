#!/bin/bash
# safari-xcode.sh - Wrap the built Safari extension in an Xcode app project
# Usage: ./scripts/safari-xcode.sh <version>
#
# Requires macOS with Xcode installed. Run `make build-safari VERSION=x.y.z` first
# (or use `make safari-xcode VERSION=x.y.z`, which does both).
#
# Environment overrides:
#   YCS_BUNDLE_ID   Bundle identifier for the container app (default: local.ycs-cont.YCS--Cont--).
#                   Its last component should be the sanitized app name (YCS--Cont--); see below.
#   YCS_PLATFORMS   "macos" (default), "ios", or "both"
#   YCS_OPEN        set to 0 to skip opening Xcode afterwards

set -e

VERSION="$1"
if [ -z "$VERSION" ]; then
    echo "❌ Version is required"
    echo "Usage: $0 <version>"
    exit 1
fi

if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This step needs macOS with Xcode (xcrun). The zip in packing/ can still be"
    echo "   loaded with Safari > Settings > Developer > Add Temporary Extension..."
    exit 1
fi

EXT_DIR="packing/YCS-cont/safari-${VERSION}"
PROJECT_DIR="packing/YCS-Safari-${VERSION}"
APP_NAME="YCS (Cont.)"

# The packager gives the extension "<bundle-id>.Extension" but derives the app's ID from the
# bundle-id prefix plus the sanitized app name. If the last component differs from that name,
# Xcode 27 fails with "embedded binary's bundle identifier is not prefixed with that of the
# parent app". So the default follows that rule, and custom IDs get a warning.
APP_ID_SUFFIX=$(printf '%s' "$APP_NAME" | sed 's/[^A-Za-z0-9-]/-/g')
BUNDLE_ID="${YCS_BUNDLE_ID:-local.ycs-cont.${APP_ID_SUFFIX}}"
if [ "${BUNDLE_ID##*.}" != "$APP_ID_SUFFIX" ]; then
    echo "⚠️  YCS_BUNDLE_ID=$BUNDLE_ID: its last component isn't \"$APP_ID_SUFFIX\"."
    echo "   Xcode may refuse to build (extension ID not prefixed with the app ID)."
    echo "   If it does, use ${BUNDLE_ID%.*}.${APP_ID_SUFFIX} instead."
    echo ""
fi
PLATFORMS="${YCS_PLATFORMS:-macos}"

if [ ! -f "$EXT_DIR/manifest.json" ]; then
    echo "❌ $EXT_DIR/manifest.json not found. Run: make build-safari VERSION=$VERSION"
    exit 1
fi

# The tool was renamed from safari-web-extension-converter to safari-web-extension-packager.
if xcrun --find safari-web-extension-packager >/dev/null 2>&1; then
    TOOL="safari-web-extension-packager"
elif xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
    TOOL="safari-web-extension-converter"
else
    echo "❌ Neither safari-web-extension-packager nor safari-web-extension-converter found."
    echo "   Install Xcode from the App Store, then run: sudo xcode-select -s /Applications/Xcode.app"
    exit 1
fi

PLATFORM_FLAG=()
case "$PLATFORMS" in
    macos) PLATFORM_FLAG=(--macos-only) ;;
    ios) PLATFORM_FLAG=(--ios-only) ;;
    both) PLATFORM_FLAG=() ;;
    *)
        echo "❌ YCS_PLATFORMS must be macos, ios or both"
        exit 1
        ;;
esac

OPEN_FLAG=()
if [ "${YCS_OPEN:-1}" = "0" ]; then
    OPEN_FLAG=(--no-open)
fi

echo "🧭 Generating Xcode project with $TOOL..."
xcrun "$TOOL" "$EXT_DIR" \
    --project-location "$PROJECT_DIR" \
    --app-name "$APP_NAME" \
    --bundle-identifier "$BUNDLE_ID" \
    --swift \
    --copy-resources \
    --no-prompt \
    --force \
    "${PLATFORM_FLAG[@]}" \
    "${OPEN_FLAG[@]}"

echo ""
# The packager creates the project one level below --project-location.
echo "✅ Xcode project: $PROJECT_DIR/$APP_NAME/$APP_NAME.xcodeproj"
echo ""
echo "Next steps:"
echo "   1. In Xcode, pick the macOS scheme and press Run (⌘R)."
echo "   2. Safari > Settings > Extensions > enable \"YCS (Cont.)\"."
echo "   3. Grant it access to youtube.com when Safari asks."
echo ""
echo "   No paid developer account? Sign the target with your personal team in"
echo "   Signing & Capabilities, or tick Safari > Settings > Developer >"
echo "   \"Allow unsigned extensions\" (resets each time Safari quits)."
