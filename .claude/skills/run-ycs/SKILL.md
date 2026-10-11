---
name: run-ycs
description: Builds, loads, and drives the YCS browser extension on a real YouTube page in Chrome or Safari. Use when asked to run or launch YCS, verify or e2e-test a change in the browser, smoke-test the extension, or screenshot its UI.
---

YCS is a browser extension, so "running" it means building `app/dist`, loading it into a browser, and driving the YCS panel on a YouTube watch page. The driver is `.claude/skills/run-ycs/smoke.py`; it opens a video and checks mount → Load all → search. Run every command from the repo root.

## Pick the browser

Always run **Chrome**. Also run **Safari** when the change touches Safari-specific code (`manifest.safari.json`, MAIN-world injection, Safari-only build branches, `scripts/safari-xcode.sh`) or the user asks for Safari. Safari needs a checkout with Safari build support (`app/manifest.safari.json`); without it `safari-install.sh` stops with an explanation. Before running a browser, read its file — it holds that browser's build step and session gotchas:

- Chrome → `.claude/skills/run-ycs/chrome.md`
- Safari → `.claude/skills/run-ycs/safari.md`

## Run (agent path)

1. Build per the browser file.
2. `python3 .claude/skills/run-ycs/smoke.py --browser chrome` (or `safari`). Flags: `--video ID`, `--query WORD`, `--min-comments N` (default 200).
3. Read the JSON. `PASS` (exit 0) is done. `FAIL` (exit 1): the first entry in `checks` with `ok: false` is the broken step — `mounted` needs exactly one `.ycs-app`, `load_comments` needs `--min-comments` comments, `search` needs `Found: N > 0` with rendered items. `ERROR` (exit 2) is a harness problem; `error` says which, and the browser file lists the known ones.

For behaviour the smoke test does not cover, reuse its backends in a scratch script (run with `PYTHONPATH=<repo>/.claude/skills/run-ycs PYTHONDONTWRITEBYTECODE=1`):

```python
from smoke import Chrome, Safari, wait_for   # same interface: open(url), js(body), close()
page = Chrome()
page.open('https://www.youtube.com/watch?v=jNQXAC9IVRw')
print(wait_for(lambda: page.js("document.querySelector('video')?.pause(); const n = document.querySelectorAll('.ycs-app').length; return JSON.stringify({ ok: n > 0, apps: n });"), timeout=30, interval=2))
page.js("document.querySelector('.ycs-app').scrollIntoView(); return JSON.stringify({ ok: true });")
page.screenshot('/tmp/ycs.png')   # Chrome only; captures the viewport, so scroll the panel in first
page.close()
```

`js(body)` takes a function body and decodes a returned `JSON.stringify(...)`. YCS mounts a few seconds after load, so poll with `wait_for` (retries until `ok: true`; on timeout it returns the last result, so check `ok`). Screenshots: Chrome via `page.screenshot(path)`; Safari's come back blank (see `safari.md`). YCS element ids live in `app/src/source/web-resources/appController.ts` (`#ycs-load-all`, `#ycs_load_stop`, `#ycs_cmnts`, `#ycs-input-search`, `#ycs_btn_search`, `#ycs-search-total-result`, `.ycs-render-comment`).

## Shared gotchas

- **Pause the video first.** Autoplay SPA-navigates the tab to another video mid-test.
- **Logged out.** Both backends use a fresh profile/session, so only logged-out flows are testable (no members-only videos, no account-bound features).
- **One `app/dist`.** Chrome and Safari builds overwrite the same directory; rebuild for the browser you are about to test. `smoke.py --browser chrome` refuses a non-Chrome `app/dist`.
- Search highlighting marks only a prefix of the query (`the` → `th`, `elephant` → `eleph`) in both browsers; that is existing behaviour, not a browser regression.
