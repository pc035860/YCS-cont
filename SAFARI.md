# YCS (Cont.) for Safari

Safari runs standard WebExtensions, so YCS builds for it from the same source as Chrome and Firefox. Only the manifest differs (`app/manifest.safari.json`).

## Build

```bash
cd app && npm ci && cd ..
make build-safari VERSION=1.10.2
```

Output:

- `packing/safari-1.10.2.zip` (`manifest.json` at the root)
- `packing/YCS-cont/safari-1.10.2/` (the same files, unzipped)

## Option A: quick test, no Xcode (Safari 26+)

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
| `YCS_BUNDLE_ID` | your bundle identifier | `local.ycs-cont.safari` |
| `YCS_PLATFORMS` | `macos`, `ios`, `both` | `macos` |
| `YCS_OPEN` | `0` to skip opening Xcode | `1` |

## What changed for Safari

- **Background:** the Safari build uses a non-persistent background page (`scripts` + `persistent: false`) instead of a service worker. Safari supports this form better, and Safari's debugger can attach to it at Develop > Web Extension Background Content.
- **Page script injection:** Safari applies YouTube's Content Security Policy to `<script src="safari-web-extension://…">` tags, while Chrome and Firefox exempt them. On Safari, `web-resources/wresources.js` is therefore injected by the background script with `scripting.executeScript({ world: "MAIN" })`, falling back to the script tag if that fails. The lazily loaded XLSX chunk hits the same CSP block, so `.xlsx` export falls back to injecting `web-resources/xlsx-global.js` the same way.
- **Injected-script lookup:** this lookup used a hardcoded `chrome-extension://` URL. It now uses `runtime.getURL()`. Safari's URLs are `safari-web-extension://<uuid>/…`.
- **Messaging:** content-script messages no longer pass `runtime.id` as the target. In Safari that id looks like `com.x.Extension (TEAMID)`.
- **Storage:** `storage.local.get()` is now `get(null)`, the form defined by the spec.
- **Re-injection into open tabs:** promise rejections from re-injecting into already-open tabs are caught. Safari rejects these until you grant site access.
- **Storage estimate:** the background script now checks that `navigator.storage.estimate()` exists before calling it.

All of these changes also work in Chrome and Firefox.

## Known limitations

- **iPhone:** Safari loads `m.youtube.com`, which has a different page structure, so the in-page UI won't attach. iPad Safari defaults to the desktop site, so iPad has a better chance of working.
- **Site access:** Safari asks you to grant access to youtube.com. Choose "Always Allow on This Website". If you don't, comments won't load after a reload.
