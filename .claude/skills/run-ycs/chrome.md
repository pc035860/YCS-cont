# Chrome

`smoke.py`'s `Chrome` backend launches **Chrome for Testing 131** headless through `agent-browser` (session `ycs-smoke`) with `app/dist` loaded as an unpacked extension.

## Build

```bash
./scripts/build-extension.sh chrome
```

The backend finds CfT at `~/.cache/puppeteer/chrome/mac_arm-131.*/…/Google Chrome for Testing`; if it is missing, smoke returns `ERROR` naming it.

## Gotchas

- **Branded Chrome ignores `--load-extension`** (137+, silently: extension listed, nothing injected). Use CfT 131 only.
- The backend handles agent-browser's launch quirks (relaunch race after `close`, stale daemon flags, first page via `tab new`, `eval` taking an expression). Read the `Chrome` class in `smoke.py` before driving agent-browser directly.
- The manual CfT + `AGENT_BROWSER_CDP` attach in the root `CLAUDE.md` is obsolete; the backend's `--executable-path` self-launch works.
- Instant Search needs a YouTube Data API key in the options page (see `CLAUDE.local.md`); the smoke test does not cover it.
