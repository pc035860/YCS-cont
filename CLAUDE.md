# CLAUDE.md

This file provides practical guidance for contributors working on YCS.

## Project Overview

YCS (YouTube Comment Search) is a browser extension for Chrome/Firefox that loads, searches, filters, and exports:
- YouTube comments/replies
- chat replay
- video transcript

Core stack:
- MV3 extension
- TypeScript + Parcel 2
- Node.js 22+

Default development branch: `v2-source`

---

## Working Directories

- Repo root: release scripts, docs, packaging
- `app/`: extension source, tests, build outputs
- `app/src/source/web-resources/`: main UI + search behavior
- `app/src/source/web-resources/features/`: reusable UI behavior modules (Shorts, transcript, recorder, intent state)
- `app/src/source/utils/innertube/`: data loading from YouTube internals
- `app/docs/`: technical docs and behavior specs

---

## Essential Commands

Run from `app/` unless noted.

```bash
# Dev/build
npm run dev
npm run build
npm run rebuild

# Quality
npm run lint
npm run typecheck
npm test
npm run format
npm run format:check

# Clean
npm run rm
```

From repo root:

```bash
make release TYPE=patch
make release TYPE=minor
make release TYPE=major
```

Manual release scripts (root):

```bash
./scripts/bump-version.sh patch
./scripts/build-extension.sh chrome
./scripts/build-extension.sh firefox
./scripts/package-extension.sh chrome
```

---

## Commit/Hook Reality

- Husky pre-commit is configured at `app/.husky/pre-commit`.
- Current pre-commit pipeline runs:
  1. `npm run typecheck`
  2. `npm test`
  3. `npx lint-staged`
- Keep staged changes minimal before committing, because tests run pre-commit.

---

## Architecture Snapshot

Three-layer message flow:

1. Web page layer (`web-resources`)  
2. Content script bridge (`content-scripts`)  
3. Service worker (`background.ts`)

Main state container:
- `app/src/source/web-resources/state.ts`
- Holds loaded datasets, search counters, selected sort settings, and abort controller

Search entry point:
- `app/src/source/web-resources/appController.ts`

Search engines:
- `app/src/source/web-resources/search/commentsSearch.ts`
- `app/src/source/web-resources/search/chatSearch.ts`
- `app/src/source/web-resources/search/transcriptSearch.ts`

---

## Philosophy and Conventions

1. Behavior stability over clever refactors  
   If a UX behavior is already established, treat changes as product decisions, not refactor side effects.

2. Regression-first review mindset  
   If behavior changes without explicit requirement, flag it as regression.

3. Explicit user action for search refresh  
   Text input changes alone should not silently alter result lists.

4. Keep search/filter logic centralized  
   Prefer changing behavior in `appController.ts` / search modules, not ad-hoc UI patches.

5. Documentation is part of the feature  
   New recurring behavior rules belong in `app/docs/` so reviewers can enforce them.

6. Write docs/comments in English  
   Keep technical docs concise and state-focused.

7. Shorts integration should be state-driven, not result-driven  
   On Shorts pages, UI visibility decisions should follow user intent state and explicit actions.

8. Keep Shorts layout changes local to YCS  
   Avoid modifying non-YCS YouTube panel sizing unless explicitly required.

---

## High-Value Gotchas (Frequent Regression Sources)

### 1) Search text clear vs filter clear are different operations

- `#ycs_btn_search_clear_text` (input-side clear):
  - Clears text
  - If a filter is active, re-runs search with empty query + same filter
  - If no filter is active, clears rendered results and shows "Search cleared"

- `#ycs_btn_clear` (filter clear):
  - Clears active filter
  - If query exists, re-runs search with query preserved and no filter
  - If query is empty, clears rendered results and shows "Search cleared"

Do not merge these semantics.

### 2) Backspace-to-empty does not auto-search

- Input events only update clear-text button visibility.
- Search refresh happens on explicit actions (Enter/Search/filter clicks).

### 3) Filter model is single-select

- Only one `.ycs_btn_active` at a time.
- Re-clicking sortable filters toggles `newest/oldest`.
- Re-clicking non-sortable filters re-runs search but does not toggle-off.

### 4) Quick filters are force-type actions, not type selector changes

- `quickChat` and `quickTranscript` force search type only for that click action.
- They do not permanently change dropdown search type.

### 5) Unsupported filter matrix differs by data source

- Some filters intentionally return no results for chat/transcript modes.
- In `all` mode, unsupported sources are skipped by design.
- Validate compatibility before changing filter behavior.

### 6) Shorts panel DOM is volatile during navigation and panel switches

- Shorts panel children/order/visibility can be re-rendered after user actions.
- Keep Shorts UI state sync idempotent and re-apply after user actions when needed.
- Mount target for Shorts should be comments panel content, not generic top-level panel insertion.
- Shorts DOM selectors are centralized in `shortsSupport.ts` with fallback list. Do not duplicate selectors in other modules.

### 7) Shorts native comments visibility follows search intent

- Search button/Enter/filter actions represent search intent, even when result count is `0`.
- Native comments should remain hidden while intent is active.
- Only restore when search text is cleared and no filter remains active (or YCS is collapsed/cleaned up).

Canonical behavior baseline doc:
- `app/docs/filter-search-behavior-regression-spec.md`

---

## Innertube/Data Gotchas

1. Access restriction status is unified
   Use consolidated status update flow (member-only + age-restricted), not split ad-hoc calls.

2. Logged-out chat replay has fallback handling
   Do not remove fallback paths without verifying logged-out scenarios.

3. Transcript loading has multiple paths
   Player API call uses ANDROID → WEB client fallback; preserve both paths.

4. Empty query search should still return full dataset
   This is expected behavior, not a bug.

5. Innertube client type and auth header must be consistent
   ANDROID client + browser SAPISIDHASH authorization = HTTP 400. Only send auth headers with WEB client requests.

---

## Recent Significant Changes

1. Shorts mounting behavior was refactored around comments panel scope
- YCS mount target is the Shorts comments panel content area
- Shorts DOM selectors are centralized in `shortsSupport.ts` with fallback; `appController.ts` imports from there
- Current strategy is synchronous mount/retry without pre-mount mutation waiting

2. Shorts native comments visibility now follows search intent state
- Any executed search/filter intent hides native comments even with `0` results
- Native comments restore only after clearing search text and removing active filter (or when YCS is collapsed/cleaned up)
- Shorts UI state re-sync is applied after actions to handle panel re-render timing

3. Shorts layout logic is now isolated to YCS-owned elements
- Removed legacy engagement/description panel-wide height manipulation
- Height adjustments now stay scoped to YCS container/search area and respect native footer overlap

4. Transcript Player API now uses two-stage client fallback for age-restricted videos
- Primary: ANDROID client (no auth, works for most videos)
- Fallback: WEB client with SAPISIDHASH auth + racyCheckOk/contentCheckOk (for age-restricted)
- AbortError is rethrown in both stages to respect cancellation

---

## Testing Guidance

Run automated checks from `app/`:

```bash
npm run typecheck
npm test
npm run lint

# Focused regression checks
npm test -- tests/searchIntentState.test.ts
```

Manual smoke checklist:
1. Load extension in browser (`app/dist`)
2. Verify comments/chat/transcript load flows
3. Verify search + filter + clear-button interactions
4. Verify export still works
5. Verify Shorts page behavior

---

## Documentation Map

- `app/docs/innertube-migration-guide.md`
- `app/docs/innertube-comments-integration.md`
- `app/docs/innertube-chat-replay-api-changes.md`
- `app/docs/innertube-nested-comments.md`
- `app/docs/sap-sid-authorization.md`
- `app/docs/adaptive-authorization-headers.md`
- `app/docs/youtube-data-api-messaging.md`
- `app/docs/filter-search-behavior-regression-spec.md`

When behavior rules change, update the relevant doc in the same PR.
