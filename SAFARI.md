# YCS (Cont.) for Safari

Safari runs standard WebExtensions, so YCS builds for it from the same source as Chrome and Firefox. The Safari build uses its own manifest (`app/manifest.safari.json`) plus a small amount of Safari-only code, which is compiled in only when `YCS_PLATFORM=safari`.

Requires Safari 27 or later; it has been tested on Safari 27.0.1 with Xcode 27.0 on macOS 27.0.1. Older versions are untested, so the manifest sets `strict_min_version` to 27.0.

## Build

```bash
cd app && npm ci && cd ..
make build-safari VERSION=1.10.2
```

Output:

- `packing/safari-1.10.2.zip` (`manifest.json` at the root)
- `packing/YCS-cont/safari-1.10.2/` (the same files, unzipped)

Always build Safari with `make build-safari` (or `./scripts/build-extension.sh safari`). A plain `npm run build` / `npm run dev` doesn't set `YCS_PLATFORM=safari` and doesn't build `web-resources/xlsx-global.js`, so the result won't inject its page script or export `.xlsx` in Safari.

## Option A: quick test, no Xcode

1. Safari > Settings > Advanced > tick **Show features for web developers**.
2. Safari > Settings > **Developer** > **Add Temporary Extension…**
3. Pick the zip or the unzipped folder and confirm with your password or Touch ID.
4. Open a YouTube video, click the YCS toolbar icon, and allow access to youtube.com.

Safari removes temporary extensions when it quits or after 24 hours.

## Option B: keep it installed (Xcode)

```bash
make safari-xcode VERSION=1.10.2
```

This command wraps the build in a macOS container app using `xcrun safari-web-extension-packager`. On older Xcode versions it falls back to `safari-web-extension-converter`. It then opens the project in Xcode.

1. Select the **macOS** scheme and press **Run** (⌘R).
2. Go to Safari > Settings > Extensions and enable **YCS (Cont.)**.
3. Signing, if you don't have a paid Apple Developer account, choose one of these:
   - Sign with your free personal team under *Signing & Capabilities*.
   - Tick Safari > Settings > Developer > **Allow unsigned extensions**. This setting resets every time Safari quits.

You can set these environment variables before running the command:

| Variable | Values | Default |
|---|---|---|
| `YCS_BUNDLE_ID` | your bundle identifier | `local.ycs-cont.YCS--Cont--` |
| `YCS_PLATFORMS` | `macos`, `ios`, `both` | `macos` |
| `YCS_OPEN` | `0` to skip opening Xcode | `1` |

**Bundle ID rule:** make the last component of `YCS_BUNDLE_ID` `YCS--Cont--` (the app name with every character other than letters, digits and `-` replaced by `-`), for example `com.yourname.YCS--Cont--`. The packager names the extension `<bundle-id>.Extension` but builds the app's ID from the prefix plus that sanitized name; if they don't match, Xcode 27 fails with "embedded binary's bundle identifier is not prefixed with that of the parent app". The script warns when a custom ID breaks this rule.

The generated project is at `packing/YCS-Safari-<version>/YCS (Cont.)/YCS (Cont.).xcodeproj`.

## What changed for Safari

- **Background:** the Safari build uses a non-persistent background page (`scripts` + `persistent: false`) instead of a service worker. Safari supports this form better, and Safari's debugger can attach to it at Develop > Web Extension Background Content.
- **Page script injection (Safari build only):** Safari applies YouTube's Content Security Policy to `<script src="safari-web-extension://…">` tags, while Chrome and Firefox exempt them. In the Safari build, `web-resources/wresources.js` is therefore injected by the background script with `scripting.executeScript({ world: "MAIN" })`, falling back to the script tag if that fails. See `app/src/source/utils/mainWorld.ts` for the message contract.
- **`.xlsx` export (Safari build only):** the lazily loaded XLSX chunk hits the same CSP block, so the Safari build skips it and has the extension inject a standalone `web-resources/xlsx-global.js` the same way (`web-resources/services/xlsxLoader.ts`, 15 s timeout). That file is built only by `build-extension.sh safari`; Chrome and Firefox builds don't contain it or any of this code.
- **Injected-script lookup:** this lookup used a hardcoded `chrome-extension://` URL. It now uses `runtime.getURL()`. Safari's URLs are `safari-web-extension://<uuid>/…`.
- **Messaging:** content-script messages no longer pass `runtime.id` as the target. In Safari that id looks like `com.x.Extension (TEAMID)`.
- **Storage:** `storage.local.get()` is now `get(null)`, the form defined by the spec.
- **Re-injection into open tabs:** promise rejections from re-injecting into already-open tabs are caught. Safari rejects these until you grant site access.
- **Storage estimate:** the background script checks that `navigator.storage.estimate()` exists before calling it. If it doesn't, the cache is capped at 200 entries (with a console warning) instead of by the size limit in options.

All of these changes also work in Chrome and Firefox.

## Known limitations

- **iPhone:** Safari loads `m.youtube.com`, which has a different page structure, so the in-page UI won't attach. iPad Safari defaults to the desktop site, so iPad has a better chance of working.
- **Site access:** Safari asks you to grant access to youtube.com. Choose "Always Allow on This Website". If you don't, comments won't load after a reload.
