# CLAUDE.md

This file provides practical guidance for contributors working on YCS.

## Project Overview

YCS (YouTube Comment Search) is an MV3 browser extension (Chrome/Firefox/Safari) that loads, searches, filters, and exports YouTube comments/replies, chat replay, and video transcript. TypeScript + Parcel 2, Node.js 22+.

Default development branch: `v2-source`

---

## Essential Commands

Run from `app/` unless noted.

- Dev/build: `npm run dev`, `npm run build`, `npm run rebuild` (outputs to `app/dist/`)
- Quality: `npm run lint`, `npm run typecheck`, `npm test`, `npm run format`, `npm run format:check`
- Clean: `npm run rm`

`npm run dev` is a Parcel watch build (serves on `localhost:1234`); it does not produce a loadable extension. Run `npm run build` and load `app/dist/` to test end to end.

From repo root: `make release TYPE=patch|minor|major` (bumps all three manifests, commits, tags, builds and packages every platform).

Safari-only code is gated on a module-local `IS_SAFARI_BUILD = process.env.YCS_PLATFORM === 'safari'`, inlined at build time. Manifest: `app/manifest.safari.json`; guide: `SAFARI.md`.

Husky pre-commit (`app/.husky/pre-commit`) runs `typecheck` → `test` → `lint-staged`, so keep staged changes minimal.

---

## Architecture Snapshot

Three-layer message flow: web page (`web-resources`) → content script bridge (`content-scripts`) → service worker (`background.ts`). The service worker is a non-persistent background page in the Firefox and Safari builds, so avoid service-worker-only globals there.

- State container: `web-resources/state.ts` (loaded datasets, search counters, sort settings, abort controller)
- Search entry point: `web-resources/appController.ts`; engines in `web-resources/search/{comments,chat,transcript}Search.ts`
- `web-resources/features/` holds reusable UI behavior modules (Shorts, transcript, live recorder, search intent, sort selector, timestamp viz)

Origin chain (parent-comment context for replies): `ui/originChain.ts` is the sole owner of `expandOriginChainFor` / `autoExpandAllRepliesIn`; callers are `commentInteractions.ts:handleOpenCommentAll` and `render.ts:renderCommentsResult`. Its wrappers use document-wide ids (`ycs-com-all-*`), which is safe while only one comment-result subtree is active. If two persistent result roots can share a reply key, scope existence/removal per container.

---

## Philosophy and Conventions

1. Behavior stability over clever refactors. If a UX behavior is already established, treat changes as product decisions, not refactor side effects.
2. Regression-first review mindset. If behavior changes without an explicit requirement, flag it as regression.
3. Explicit user action for search refresh. Text input changes alone must not silently alter result lists.
4. Keep search/filter logic centralized in `appController.ts` / search modules, not ad-hoc UI patches.
5. Documentation is part of the feature. New recurring behavior rules belong in `app/docs/` so reviewers can enforce them.
6. Write docs/comments in English, concise and state-focused.
7. Shorts integration is state-driven, not result-driven. UI visibility follows user intent state and explicit actions.
8. Keep Shorts layout changes local to YCS. Do not modify non-YCS YouTube panel sizing unless explicitly required.

---

## High-Value Gotchas (Frequent Regression Sources)

### 1) Search text clear vs filter clear are different operations

- `#ycs_btn_search_clear_text` (input-side clear): clears text; with an active filter it re-runs search with empty query + same filter; with no filter it clears rendered results and shows "Search cleared". Instant-mode exception: with an active filter it clears filter **and** search together, with no re-run (an empty query would re-degrade the filter into the upgrade modal; see spec §5.3).
- `#ycs_btn_clear` (filter clear): clears the active filter; with a query it re-runs search with the query preserved and no filter; with no query it clears rendered results and shows "Search cleared".

Do not merge these semantics.

### 2) Backspace-to-empty does not auto-search

Input events only update clear-text button visibility. Search refresh happens on explicit actions (Enter/Search/filter clicks).

### 3) Filter model is single-select

Only one `.ycs_btn_active` at a time. Re-clicking sortable filters toggles `newest/oldest`; re-clicking non-sortable filters re-runs search but does not toggle-off.

### 4) Quick filters are force-type actions, not type selector changes

`quickChat` and `quickTranscript` force the search type only for that click action; they do not permanently change the dropdown search type.

### 5) Unsupported filter matrix differs by data source

Some filters intentionally return no results for chat/transcript modes, and in `all` mode unsupported sources are skipped by design. Validate compatibility before changing filter behavior.

### 6) Shorts panel DOM is volatile during navigation and panel switches

Children/order/visibility can be re-rendered after user actions, so keep Shorts UI state sync idempotent and re-apply it after user actions. The mount target is the comments panel content, not a generic top-level panel insertion. Shorts DOM selectors are centralized in `shortsSupport.ts` with a fallback list; do not duplicate them in other modules.

### 7) Shorts native comments visibility follows search intent

Search button/Enter/filter actions represent search intent, even when the result count is `0`, and native comments stay hidden while intent is active. Only restore them when search text is cleared and no filter remains active (or YCS is collapsed/cleaned up).

### 8) `renderComment` post-batch work goes through `postBatchHook`

`renderComment` paginates results into batches (200 per batch) with a `Show more` button. Any per-batch post-processing (highlights, auto-expand, decorations) MUST be wired through the `postBatchHook?: (batchRoot: HTMLElement) => void` option, NOT called once on the static target: a hook on the parent only covers the initial 200 items, and later show-more clicks silently skip post-processing.

Post-batch work that touches many DOM nodes MUST chunk itself AND defer the entire loop. Even a synchronous "first chunk for first paint" blocks the filter click's paint. Use `requestAnimationFrame` for every chunk, keep the chunk size small (≈5), and always stale-guard with `element.isConnected` because users can re-filter while chunks are queued. `originChain.ts:autoExpandAllRepliesIn` is the reference example.

### 9) `--experimental-strip-types` rejects mixed value + type imports

The test loader (`tests/ts-loader.mjs` + Node `--experimental-strip-types`) cannot strip type-only names from a regular `import { foo, FooType }` statement. New TS files MUST split it: `import { foo } from './x'; import type { FooType } from './x';`. Symptom: `SyntaxError: The requested module './x' does not provide an export named 'FooType'` when running `npm test`.

### 10) Instant Search gates Autoload; does not replace it

Do NOT remove Autoload globally. When instant-eligible (API key + Instant ON; **Enable irrelevant**), suppress autoload on cache miss via `shouldSkipAutoload` at all four triggers. Autoload ON + instant OFF still auto-loads full comments. Instant ≠ Enable: Instant uses Data API `searchTerms`; Enable only chooses Data API vs Innertube for **full** Load all.

### 11) Instant empty query makes no API call

Instant mode: an empty Search/Enter shows a hint and does **not** call the API, unlike full-cache empty query which returns the full dataset. Instant search still requires explicit Search/Enter, not input-only.

### 12) Instant degraded filters need stable capture delegation

Incompatible filters use `ycs-btn-degraded` + confirm modal → Load all → pending filter re-apply. Capture handlers must use event delegation on the stable `.ycs-app`, not per-button listeners, because `loadFilterButtons()` rebuilds `#ycs-btn-panel` and wipes per-button captures.

Canonical behavior baseline doc: `app/docs/filter-search-behavior-regression-spec.md` (incl. §12 Instant Search).

---

## Innertube/Data Gotchas

1. Access restriction status is unified. Use the consolidated status update flow (member-only + age-restricted), not split ad-hoc calls.
2. Logged-out chat replay has fallback handling. Do not remove fallback paths without verifying logged-out scenarios.
3. Transcript loading has multiple paths. The player API call uses an ANDROID → WEB client fallback; preserve both.
4. Empty query search should still return the full dataset (full-cache / Innertube path). That is expected, not a bug. Instant Search empty query differs, see Gotcha 11.
5. Innertube client type and auth header must be consistent. ANDROID client + browser SAPISIDHASH authorization = HTTP 400; only send auth headers with WEB client requests.
6. Live chat starts in "Top chat" mode. `conversationBar.liveChatRenderer.continuations[0]` selects the filtered mode, so live chat fetching must upgrade to the "Live chat" continuation carried by the first `get_live_chat` response (`getLiveChatUnfiltered()`); the watch page's own sub-menu tokens are rejected with HTTP 400. Details: `app/docs/live-recording.md`
7. Chat replay paginates with `liveChatReplayContinuationData`, not `playerOffsetMs`. `playerOffsetMs` is sent once with value `0` to pin the replay start (the `reloadContinuationData` token is entry-point dependent) and must NOT advance the cursor: `get_live_chat_replay` answers a range of offsets with the same page, so an offset-driven loop stalls mid-stream and reads the stall as the end of the chat. Follow the replay token until it is missing. Details: `app/docs/innertube-chat-replay-api-changes.md` → v2.1
8. `liveChatRenderer.isReplay` gates the live chat probe. A replay continuation is rejected by `get_live_chat` with HTTP 400, so `getCDChat()` reports `isReplay` and `getChatComments` / `checkIsLiveStream` skip that probe instead of logging a console error on every VOD.

---

## Recent Significant Changes

1. Shorts: mount in comments panel, selectors in `shortsSupport.ts`, native comments follow search intent.
2. Transcript: player API → timedtext → `get_panel`; `get_transcript` removed (400). See `docs/transcript-loading.md`.
3. Reply origin chain auto-expand via `autoExpandReplyContext` + `postBatchHook` (`ui/originChain.ts`); default off.
4. Instant Search: Data API `searchTerms`; results in `remoteSearch`, never overwrite `state.comments` (spec §12).

---

## Testing Guidance

Run from `app/`: `npm run typecheck`, `npm test`, `npm run lint`.

`npm test` prints `--experimental-loader` deprecation warnings; they are expected and harmless.

Browser E2E uses the `run-ycs` project skill (`.claude/skills/run-ycs/`). Its `smoke.py --browser chrome|safari` expects the extension already built and installed, drives it on a YouTube page (mount → Load all → search), and reports PASS/FAIL as JSON. Per-browser setup lives in its `chrome.md` / `safari.md`.

- System Chrome 137+ silently ignores `--load-extension` (the extension shows as enabled but `chrome.runtime` is undefined in the page). Use Chrome for Testing 131 from `~/.cache/puppeteer/chrome/mac_arm-131.*/`, launched with `agent-browser --executable-path <CfT> --extension app/dist`; open the first page with `tab new <url>`, not `open`.
- Do not use `~/.e2e-dev-loop-profile` (reserved for other web-app testing, and agent-browser cannot attach to it). Create a throwaway profile per run.
- Instant-search E2E needs a YouTube Data API key entered through the extension options page; never echo it into logs or screenshots.
- `syncInstantDegradedControls` fixtures MUST include the pre-options `syncInstantDegradedControls(false)` call fired from `initFilterButtons` before `hasYoutubeApiKey` propagates, or the test passes even against a broken snapshot. See `instantSearchUi.test.ts`.

---

## Documentation Map

Technical docs and behavior specs live in `app/docs/`. When behavior rules change, update the relevant doc in the same PR.
