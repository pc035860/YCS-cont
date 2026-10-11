# Safari

`smoke.py`'s `Safari` backend speaks to Apple's MCP server `safaridriver --mcp` (Safari 27+) over stdio; each run is a fresh, isolated automation session. YCS is installed as an ad-hoc signed macOS **app extension** built with Xcode.

## Build

```bash
bash .claude/skills/run-ycs/safari-install.sh      # ~20 s; done when it prints "✅ Installed:"
```

Output in `packing/safari-e2e/`. A code change reaches Safari on the next install — no Safari restart, no re-enable, as long as the setup below was done in the user's normal Safari.

**One-time human setup** (new machine), in the user's **normal** Safari — not the orange-address-bar automation window: Settings → Extensions → enable "YCS (Cont.)", then on a YouTube page click the YCS toolbar icon → "Always Allow on This Website"; Settings → Developer → "Allow remote automation and external agents" on. Both the enable and the youtube.com grant are needed: either one alone leaves `mounted.apps: 0` with no error. A grant given inside the automation window works only until the next `safari-install.sh`. If `ERROR` names `initialize`, `create_tab`, or `safaridriver`, or `FAIL` has `mounted.apps: 0`, stop and ask the user to confirm this setup — do not retry. Once they confirm it is done, a repeat `mounted.apps: 0` is a real YCS failure.

## Gotchas

- **App extensions only.** The installed app extension appears in automation sessions automatically; a Temporary Extension ("Add Temporary Extension…") does not.
- `mounted.apps: 2` = duplicate install: a Temporary Extension, or a stale registration left by a failed `xcodebuild` (rerun `safari-install.sh`; it removes stale registrations).
- **No extension reload from the page.** The main world has no `chrome.runtime` and the extension URL is masked; reinstall instead.
- **Every MCP session launches its own `Safari --automation` instance** that survives `safaridriver` exiting; `smoke.py` terminates the ones it started. After driving the MCP by other means, clean up with `for p in $(pgrep -f 'MacOS/Safari .*--automation'); do kill "$p"; done` (the user's normal Safari has no `--automation` flag).
- **Screenshots** from the MCP come back blank while the automation window is hidden (`visibilityState: "hidden"`); assert on DOM values.
- Xcode 27 prints CoreDevice/CoreSimulator version-mismatch noise on stderr; it does not affect the macOS build (`safari-install.sh` keeps it in `packing/safari-e2e/xcodebuild.log`).
- For interactive debugging, the `mcp__safari__*` tools (server `safari` in the local `.mcp.json`; new servers load only in a new session) expose the same session type.
