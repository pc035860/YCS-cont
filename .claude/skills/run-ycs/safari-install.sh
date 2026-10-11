#!/bin/bash
# safari-install.sh - Build the Safari extension from the current checkout, wrap it
# in an ad-hoc signed macOS app, and register it so Safari (incl. safaridriver/MCP
# automation sessions) loads it.
#
# Usage: safari-install.sh
# Output dir: <repo>/packing/safari-e2e/ (gitignored)
#
# Bundle id must end with the sanitized app name: Xcode 27's
# safari-web-extension-packager derives the app id from the id's prefix + app
# name, and gives the extension <id>.Extension; anything else fails the
# "embedded binary not prefixed" check.

set -euo pipefail

REPO="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$REPO"

if [ ! -f app/manifest.safari.json ]; then
    echo "❌ app/manifest.safari.json not found — this checkout has no Safari build support" >&2
    exit 1
fi

APP_NAME="YCS (Cont.)"
BUNDLE_ID="local.ycs-cont.YCS--Cont--"
OUT="$REPO/packing/safari-e2e"
APP="$OUT/dd/Build/Products/Debug/$APP_NAME.app"
APPEX="$APP/Contents/PlugIns/$APP_NAME Extension.appex"
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister

if ! xcrun --find safari-web-extension-packager >/dev/null 2>&1; then
    echo "❌ safari-web-extension-packager not found — needs full Xcode (sudo xcode-select -s /Applications/Xcode.app)" >&2
    exit 1
fi
mkdir -p "$OUT"

echo "🔨 [1/4] Building Safari extension (scripts/build-extension.sh safari)..."
./scripts/build-extension.sh safari > "$OUT/build.log" 2>&1 || {
    tail -30 "$OUT/build.log" >&2
    exit 1
}

echo "📦 [2/4] Generating Xcode project..."
rm -rf -- "$OUT/xcode"
xcrun safari-web-extension-packager "$REPO/app/dist" \
    --project-location "$OUT/xcode" \
    --app-name "$APP_NAME" \
    --bundle-identifier "$BUNDLE_ID" \
    --swift --copy-resources --no-prompt --force --macos-only --no-open > "$OUT/packager.log" 2>&1 || {
    cat "$OUT/packager.log" >&2
    exit 1
}

echo "🏗️  [3/4] xcodebuild (ad-hoc signed)..."
# stderr carries noisy CoreDevice/CoreSimulator warnings on Xcode 27; keep it in a log.
xcodebuild -project "$OUT/xcode/$APP_NAME/$APP_NAME.xcodeproj" \
    -scheme "$APP_NAME" -configuration Debug -destination 'platform=macOS' \
    -derivedDataPath "$OUT/dd" CODE_SIGN_IDENTITY=- build > "$OUT/xcodebuild.log" 2>&1 || {
    grep -E '^error|BUILD FAILED' "$OUT/xcodebuild.log" >&2 || tail -30 "$OUT/xcodebuild.log" >&2
    exit 1
}

echo "🔌 [4/4] Registering extension..."
# Drop every other registration of a YCS (Cont.) app or appex (older build paths,
# loose .appex copies). pluginkit does not list all of them, but Safari still shows
# each one as a separate YCS entry, so walk the LaunchServices database too.
"$LSREGISTER" -dump 2>/dev/null | sed -n 's/^path: *\(.*YCS (Cont\.)[^/]*\.app\(ex\)\{0,1\}\) (0x[0-9a-f]*)$/\1/p' | sort -u |
while IFS= read -r path; do
    case "$path" in "$APP" | "$APPEX") continue ;; esac
    echo "   removing stale registration: $path"
    pluginkit -r "$path" 2>/dev/null || true
    "$LSREGISTER" -u "$path" 2>/dev/null || true
done
# Launch the container app once so Safari registers the rebuilt extension, then quit
# it; it only shows a "turn on the extension" window.
"$LSREGISTER" -f "$APP"
open -gj "$APP"
sleep 3
osascript -e "tell application id \"$BUNDLE_ID\" to quit" 2>/dev/null || true

if pluginkit -m -v -A -i "$BUNDLE_ID.Extension" 2>/dev/null | grep -qF "$APPEX"; then
    echo "✅ Installed: $APPEX"
    echo "   First install only, in your normal Safari: enable \"$APP_NAME\" in Settings > Extensions and"
    echo "   allow youtube.com (YCS toolbar icon > Always Allow on This Website);"
    echo "   Safari > Settings > Developer > \"Allow remote automation and external agents\" on."
else
    echo "❌ Extension not registered with pluginkit" >&2
    exit 1
fi
