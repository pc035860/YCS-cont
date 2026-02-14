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

Canonical behavior baseline doc:
- `app/docs/filter-search-behavior-regression-spec.md`

---

## Innertube/Data Gotchas

1. Access restriction status is unified  
   Use consolidated status update flow (member-only + age-restricted), not split ad-hoc calls.

2. Logged-out chat replay has fallback handling  
   Do not remove fallback paths without verifying logged-out scenarios.

3. Transcript loading has multiple paths  
   Recent changes improved Player API handling; preserve fallback behavior.

4. Empty query search should still return full dataset  
   This is expected behavior, not a bug.

---

## Recent Significant Changes (Keep in Mind)

1. Search/filter UX hardening (`#139`)
- Button visibility behavior refined
- Clear/autoload timing stabilized in app controller flow

2. Shorts UX update
- Comment sort order selector is hidden on Shorts pages

3. Transcript loading improvements (`#137`)
- Innertube Player API path improved with safer loading flow

4. Options capability expansion (`#132`)
- Added `maxComments` option to cap autoload comment count

5. Innertube reliability for logged-out users (`#130`)
- Chat replay loading improved with HTML fallback path

6. Comment loading mode selection (`#129`)
- Added selectable loading behavior for comments pipeline

7. Access restriction refactor (`#126`) + age-restricted support (`#125`)
- Consolidated status update strategy
- Stabilized authorization decisions for restricted content

8. Search behavior fix
- Empty query now returns all results in comments search

---

## Testing Guidance

Run automated checks from `app/`:

```bash
npm run typecheck
npm test
npm run lint
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
