# FilterButton and SearchTextInput Behavior Specification (Regression Baseline)

---

## 1. Purpose

Define observable behavior for `FilterButton` and `SearchTextInput` as a regression baseline for code review.  
If implementation deviates from this spec without an explicit requirement change, it should be flagged as a regression issue.

---

## 2. Scope and Components

### 2.1 Component Definitions

- `SearchTextInput`: `#ycs-input-search`
- `SearchClearTextButton` (input-side clear button): `#ycs_btn_search_clear_text`
- `FilterButton`: `#ycs_btn_*` (excluding clear)
- `FilterClearButton` (filter-area clear button): `#ycs_btn_clear`
- Active filter marker: `.ycs_btn_active`

### 2.2 FilterButton List

- Sortable (re-click can toggle `newest/oldest`): `timestamps`, `author`, `heart`, `verified`, `links`, `members`, `donated`, `sortFirst`, `quickChat`, `quickTranscript`
- Non-sortable: `timestampViz`, `likes`, `replied`, `random`

### 2.3 State Symbols

- `Q`: `SearchTextInput.value.trim()`
- `F`: current active filter (`none` if no active filter)
- `T`: selected search type (`comments/chat/video/all`)
- `R_total`: total search result count (comments + chat + transcript)

---

## 3. Global Rules (MUST)

1. Filter behavior is **single-select**: only one filter can be active at a time.
2. Clicking any `FilterButton` must trigger search and must reset search counts first.
3. Clicking a sortable filter:
   1. If it was not active, use current dataset sort order (default `newest`).
   2. If it was already active, toggle sort order `newest ↔ oldest`, then re-run search.
4. Clicking a non-sortable filter (including repeated clicks):
   1. Does not toggle off active state.
   2. Still re-runs search.
5. `Search` button and `Enter` key are equivalent: execute search with current `Q` + current active filter (if any).
6. `SearchTextInput` `input` events (including regular typing and Backspace) **must not auto-search**.

---

## 4. Clear Button Visibility Rules (MUST)

### 4.1 `SearchClearTextButton` (`#ycs_btn_search_clear_text`)

1. On initialization:
   - `Q` is non-empty -> `visible`
   - `Q` is empty -> `hidden`
2. After every `input` event:
   - `Q` is non-empty -> `visible`
   - `Q` is empty -> `hidden`
3. After click, it is immediately set to `hidden`.

### 4.2 `FilterClearButton` (`#ycs_btn_clear`)

1. Initially always `hidden`.
2. After each completed search, visibility follows this formula:
   - `visible` when: `hasActiveFilter === true` OR (`Q` is empty AND `R_total > 0`)
   - otherwise: `hidden`
3. Clicking `FilterClearButton` immediately sets it to `hidden`.
4. Clicking `SearchClearTextButton` also immediately sets it to `hidden` (it may become visible again after re-search based on the formula).

---

## 5. SearchTextInput Behavior Matrix

### 5.1 Edit Text (without Enter, without Search click)

1. Update input value `Q`
2. Only update `SearchClearTextButton` visibility
3. `F` remains unchanged
4. Result area remains unchanged (no search triggered)

### 5.2 Clear Input via Backspace (`Q = ""`)

1. `Q` becomes empty
2. `SearchClearTextButton` becomes `hidden`
3. **No search is triggered**
4. `F` remains unchanged (if a filter was active, it stays active)
5. Result area keeps previous search results

### 5.3 Clear Input via `SearchClearTextButton`

1. Clear `Q` first
2. Branch:
   - `F != none` (full-cache mode): keep current filter and trigger one Search via `requestAnimationFrame` (re-search with empty query)
   - `F != none` (instant mode — active instant session or instant browse mode): clear the filter **and** the search together; clear result area and set summary text to `Search cleared`. Re-running the filter with an empty query would mismatch the session query and re-degrade it into the upgrade modal (Section 12.4), which is not a meaningful outcome for a clear action — so the filter is dropped instead. **No upgrade modal may appear.**
   - `F == none`: do not search; clear result area and set summary text to `Search cleared`
3. `SearchClearTextButton` becomes `hidden` immediately
4. `FilterClearButton` becomes `hidden` immediately (if re-search runs, visibility is recalculated by formula)

### 5.4 Press Enter in SearchTextInput

1. Equivalent to clicking `Search`
2. Search with current `Q` and current `F`

---

## 6. FilterButton Behavior Matrix

### 6.1 Click a Different FilterButton (`F = A -> B`)

1. Remove `.ycs_btn_active` from all filters
2. New button becomes the only active filter
3. Reset search counts
4. Immediately search with `Q + B`
5. If `B` is sortable, sort order follows button dataset (default `newest`)

### 6.2 Click the Same FilterButton Again

1. Sortable button: toggle `newest/oldest`, then re-search
2. Non-sortable button: active state unchanged, re-search directly

### 6.3 Clear Filter (click `FilterClearButton`)

1. Remove all active filters (`F -> none`)
2. Reset search counts
3. Branch:
   - `Q` is non-empty: trigger Search via `requestAnimationFrame` (preserve query, remove filter)
   - `Q` is empty: do not search; clear result area and set summary text to `Search cleared`
4. `FilterClearButton` becomes `hidden` immediately

---

## 7. Full Definitions for Requested Scenarios (`Q` initially non-empty)

### 7.1 Click a Different FilterButton

1. `F` switches to the new filter
2. Run search immediately with "new filter + existing query"
3. Results and summary text update
4. `FilterClearButton` stays visible (`hasActiveFilter = true`)

### 7.2 Clear FilterButton (click `#ycs_btn_clear`)

1. `F -> none`
2. Keep `Q`
3. Re-search with "no filter + existing query" (triggered in next animation frame)
4. `FilterClearButton` hides first; after re-search it stays hidden because `Q` is non-empty and no filter is active

### 7.3 Without Changing FilterButton

#### (a) Modify SearchTextInput

1. Only `Q` and `SearchClearTextButton` visibility change
2. No auto-search
3. `F` remains unchanged

#### (b) Clear SearchTextInput via Backspace

1. `Q` becomes empty and `SearchClearTextButton` becomes hidden
2. No auto-search
3. `F` remains unchanged
4. Result area keeps previous results

#### (c) Clear SearchTextInput via `SearchClearTextButton`

1. `Q` becomes empty
2. Since `F` still exists, re-search runs with "same filter + empty query"
3. `SearchClearTextButton` and `FilterClearButton` hide first
4. After re-search, `FilterClearButton` becomes visible again because an active filter still exists

---

## 8. Search Type and Filter Compatibility Rules (MUST)

### 8.0 `timestampViz` Special Case

- If active filter is `timestampViz`, execution goes directly to timestamp visualization handler and does not enter normal `comments/chat/video/all` search branches.

### 8.1 `comments` mode

- All filter parameters can enter comments pipeline (no unsupported-filter guard).

### 8.2 `chat` mode

- Unsupported: `heart`, `likes`, `replied`, `random`, `quickTranscript`
- If any unsupported filter is active, chat result is always `Found: 0`

### 8.3 `video` (transcript) mode

- Unsupported: `heart`, `likes`, `replied`, `random`, `author`, `donated`, `members`, `verified`, `quickChat`
- If any unsupported filter is active, transcript result is always `Found: 0`

### 8.4 `all` mode

- Comments always run
- Chat section is skipped when active filter is chat-unsupported
- Transcript section is skipped when active filter is transcript-unsupported

---

## 9. Quick Filter Special Rules (MUST)

1. Clicking `quickChat` / `quickTranscript` forces search type to `chat` / `video` for that action only (dropdown display value is unchanged).
2. On subsequent `Search` button use, effective type follows current dropdown, not previous quick-filter forced type.

---

## 10. Regression Criteria

If any of the following occurs, mark it as a regression:

1. `SearchTextInput` `input` or Backspace triggers auto-search.
2. Re-clicking the same sortable filter does not toggle sort direction.
3. Clicking `FilterClearButton` with non-empty `Q` does not re-search while preserving query.
4. Clicking `SearchClearTextButton` with `F != none` does not re-run same filter with empty query.
5. `SearchClearTextButton` visibility condition is no longer `Q.trim().length > 0`.
6. `FilterClearButton` visibility formula deviates from Section 4.2.
7. Filter model is no longer single-select (multiple active filters at once).

---

## 11. Confirmed Product Decisions (Fixed Behavior)

The following behaviors are explicitly confirmed as fixed rules and must not change without product requirement updates:

1. Clearing input via Backspace does not auto-search; result update requires explicit search action (`Enter` / `Search` / filter action).
2. Re-clicking non-sortable filters (`likes/replied/random/timestampViz`) does not toggle-off; it only re-runs search.
3. Quick-filter forced type applies only to the click action itself; subsequent `Search` follows dropdown type.

---

## 12. Instant Search Mode (YouTube Data API)

When YouTube Data API instant search is enabled, search behavior before a full comment load differs from full-cache mode. These rules apply only while no loaded or cached comments exist for the current video.

### 12.1 Instant Mode Eligibility (MUST)

Instant search runs only when **all** of the following are true:

1. `hasYoutubeApiKey === true`
2. `youtubeApiInstantSearch === true` (default `true`)
3. No loaded or cached comments exist for the current video
4. `Q` is non-empty after trim
5. Search category is `comments`, or the comments segment of `all`
6. Page is a video-scoped context (watch, `/live/`, or Shorts), not a community post (`/post/<id>`) — `getVideoId()` returns undefined on post pages, so instant search cannot resolve a video to query

`youtubeApiEnabled` does **not** gate Instant Search. It only chooses Data API vs Innertube for **full comment load** (Load all / autoload full fetch). Instant can run with Enable OFF (Innertube full load + Data API `searchTerms`).

On community post pages, full-load already falls back to Innertube (post pages have no video-scoped Data API equivalent), and autoload is **not** suppressed — condition 6 failing makes instant ineligible, which restores normal autoload behavior (see §12.3).

When any Instant eligibility condition fails, search follows existing full-cache / local rules.

Cache hit always uses local search. The instant path is never used when full comment data already exists for the current video.

### 12.2 Empty-Query Behavior (MUST)

Empty-query semantics differ by data availability:

| Mode | Empty `Q` + Search / Enter |
| --- | --- |
| Full-cache (comments loaded) | Returns the full dataset (existing rule) |
| Instant (no loaded comments) | Shows hint copy only; **no API call** |

Instant-mode empty-query hint copy:

`Type something to search instantly, or click Load all to browse every comment.`

Typing and Backspace-to-empty must not trigger API calls. Search refresh requires explicit actions (`Enter` / `Search` / filter click), consistent with Section 3 rule 6.

### 12.3 Autoload Suppression (MUST)

When instant mode is eligible (`hasYoutubeApiKey` + Instant ON; Enable irrelevant) and the comment cache misses, autoload must not fire even when `autoload: true` is set in options.

| Autoload option | Instant search option | Cache | Behavior |
| --- | --- | --- | --- |
| ON | OFF | miss | Auto full load (current behavior; Data API or Innertube per Enable) |
| ON | ON | miss | No auto load; search-ready state (Enable does not matter) |
| OFF | any | miss | Manual load only |
| any | any | hit | Restore from IndexedDB unchanged |

### 12.4 Filter Degradation in Instant Mode (MUST)

In instant mode, plain text search is fully supported. Filters fall into two tiers:

**Always incompatible** (Data API responses lack the required fields — `creatorHeart`, `verifiedAuthor`, `sponsorCommentBadge`, `donatedChip`, `authorIsChannelOwner`): `heart`, `verified`, `members`, `donated`, `author`, `timestampViz`. Also always degraded: extended search, export/save, open-all-comments window (`#ycs_open_all_comments_window`).

**Conditionally unlocked** (work locally on the instant subset once the session is complete): `random`, `links`, `likes`, `replied`, `timestamp`, `sortFirst`.

A session is **complete** when all of: session active, ≥1 result, and no `nextPageToken` remaining (single-page result, or every API page fetched via show-more). Unlocked filters then run **locally** over the instant result set — no API call — and `sortFirst`, `links`, `timestamp` order by `publishedAt` date instead of load order (Data API results are relevance-ordered, not load-ordered). `timestamp` only takes this date-order path when `sortTimestamp=false` (default); with `sortTimestamp=true` it still orders by the in-comment video timestamp, unaffected by this fix. This date-order fix is scoped to the instant local pipeline only (`preferPublishedAtOrder` opt-in in `commentsSearch.ts`): a full "Enable" Data API archive load shares the same transform (so it also carries `publishedAtMs`) but goes through the general `runSearch` path, which never opts in — its ordering, like full-archive Innertube ordering, is unchanged. Clearing an active filter on the same query also re-renders locally instead of re-hitting the API.

Unlockable filters **re-degrade** (upgrade modal on click) when: the session is incomplete (unfetched pages remain), the query text no longer matches the session query, or the session is cleared/reset.

While degraded, in both active instant-result sessions and instant browse mode (eligible, no loaded comments yet), the first click opens the upgrade modal.

For each degraded control:

1. Apply class `ycs-btn-degraded` (dimmed to ~0.38 opacity; **not** `disabled`)
2. Tooltip: `Needs all comments loaded — click to load`
3. Click opens the existing `#ycs_confirm_modal`
4. Confirming triggers full comment load
5. The clicked filter is remembered and auto-applied after load completes and the current query re-runs locally
6. Open-all-comments window: after load completes, open the full-archive window (do not open on the instant subset)

### 12.5 Abort In-Flight Full Load (MUST)

If the user triggers instant Search while a full comment fetch is in progress:

1. Abort the in-flight full load via `AbortController`
2. Discard partial fetch data
3. Do not mix remote instant results with partial local datasets in one result list

### 12.6 Status Line States (MUST)

All instant-mode status copy is rendered via `#ycs-search-total-result`. No sticky banners.

| State | Condition | Copy / UI |
| --- | --- | --- |
| S1 Ready | Empty `Q`, instant eligible, no active search | Placeholder: `Search (instant via YouTube API)` |
| S2 Searching | Instant API request in flight | `Searching YouTube…` |
| S3 Results | Instant search returned matches | Instant chip + `N matches for … · ` load-all CTA (see below) |
| S4 Zero matches | Instant search returned zero items | Zero-match copy for current query |
| S5 Empty-query hint | Empty `Q` + explicit Search in instant mode | Hint copy from Section 12.2 |
| S6 Upgrading | Full load in progress after instant use | Progress copy for upgrade path |
| S7 Upgraded | Full load complete; same query re-run locally | Normal `(Comments) Found: M`; all filters unlocked |
| S8 All-mode combined | Search type `all`: instant comments + other sources (chat/transcript) rendered | Instant chip + combined `(All) Found: N` (or filter-specific label) + load-all CTA; the chip **must not** be overwritten by plain text |

Quota exceeded: show notify box `YouTube API quota exceeded. Instant search unavailable — you can still load comments normally.`

`Load all` remains visible in instant mode at all times. Its label has two states, driven by
`isInstantSessionComplete(state)` (all searchTerms pages fetched):

| Session state | CTA label | Tooltip |
| --- | --- | --- |
| Incomplete (more pages to fetch) | `Load all comments for filters & export` | *(none)* |
| Complete (all pages fetched; 6 filters unlocked locally) | `Load all comments` | `For export & remaining filters` |

The CTA click behavior is unchanged in both states — it always opens the full-archive load path
(export and the always-degraded filters — heart/verified/members/donated/author — still need it).
The status line never grows longer in either state; the label only shortens on completion.

### 12.7 Shorts (MUST)

On Shorts pages, instant Search / Enter counts as search intent.

1. Native comments stay hidden while search intent is active, including zero instant results
2. Existing restore rules are unchanged: native comments restore only after clearing search text and removing active filter (or when YCS is collapsed/cleaned up)

### 12.8 Fetch All Matches (MUST)

`#ycs_instant_fetch_all` renders directly below `#ycs_instant_show_more` (single-page fetch) and
auto-paginates the current session to completion in one click.

1. **Visibility**: identical to Show more — only while the session is active AND `pageToken` is
   present. Both blocks are created together (`renderInstantShowMore`) and removed together
   (`removeInstantShowMore`); both disappear on completion.
2. **Content**: the shared `.ycs-instant-chip` (SVG bolt + "Instant", never the ⚡ emoji) followed
   by the label `Fetch all matches`.
3. **Loop**: repeatedly calls the single-page fetch until `pageToken` is gone. Shares the
   `instantSearchGeneration` guard and `AbortController` with Show more — query change, STOP, or
   upgrade aborts the loop and no further UI update happens (silent stop). Clicking Show more
   while a fetch-all loop is running is blocked, and vice versa (both blocks carry
   `ycs-instant-fetching` during the loop).
4. **Status updates**: the status line (`#ycs-search-total-result`) updates once per fetched page;
   the comment result list itself is re-rendered **once**, after the loop ends — no per-page
   render churn.
5. **Quota exhaustion mid-loop**: shows the existing `InstantSearchQuotaError` notify copy; merged
   results from completed pages stay rendered and usable; if `pageToken` remains, both blocks are
   rebuilt (not removed) so the user can retry.
6. **Completion**: flows through the normal complete-session path
   (`syncInstantControlsFromState`) — unlockable filters un-dim exactly as with manual Show more.
7. **Tooltip**: `Fetch every remaining page (~N quota units)` when the Data API's
   `pageInfo.totalResults` is known (`N = max(1, ceil((totalResults - loadedCount) / 100))`, one
   `commentThreads.list` page = 1 quota unit / 100 results); otherwise
   `Fetch every remaining page (1 quota unit per 100 matches)`.

### 12.9 On-demand Reply Fetch (MUST)

Instant search requests `part=snippet,replies`, so each thread only carries up to 5 inline
replies while the parent's `renderer.replyCount` shows the true total. Clicking `+` on a thread
whose local replies fall short of that total triggers a background fetch instead of the
"no replies found" no-op.

1. **Local-first**: `handleOpenReply` always collects replies already present in
   `remoteSearch.results` first (`collectRepliesForComment`). Only when the collected count is
   less than the parent's `replyCount` AND an instant `fetchMissingReplies` dependency is wired
   does an API call happen.
2. **Full-cache mode is unaffected**: `registerCommentInteractions`'s `fetchMissingReplies` /
   `onReplyQuotaExceeded` dependencies are optional and only provided by the instant render path
   in `appController.ts`. Without them, reply expansion behaves exactly as before — local-only,
   no fetch, "no replies found" warning on a genuine miss.
3. **Fetch scope**: one click fetches **all** remaining pages of that single parent's replies in
   one round trip (`comments.list?parentId=`, 1 quota unit per page of up to 100 replies) — no
   reply-pagination UI. Replies-of-replies are out of scope (YouTube threads are 2 levels).
4. **Loading state**: the `+` button gets class `ycs-reply-loading` (shared `ycs-pulse`
   animation), text swaps to `…`, and title to `Loading replies…`. A second click while loading
   is a no-op (guarded by the loading class) — collapse (removing an already-rendered replies
   block) is unaffected and always available.
5. **Merge and cache-by-merge**: fetched replies are transformed to `CommentItem` (
   `transformReplyToCommentItem`, `originComment` set to the real parent) and merged into
   `remoteSearch.results`, deduped by reply `commentId` against the already-inlined subset. The
   merge reads `remoteSearch` fresh right after the fetch resolves (not a pre-fetch snapshot), so
   two concurrent reply fetches on different threads never clobber each other. On the normal path,
   re-expanding the same thread afterward is served entirely from local state — no second API call
   for that parent during the session.
   - **Known accepted limitation**: Show more / Fetch all (§12.8, Task 17) still merge onto a
     session snapshot captured *before* their own API call. If a reply fetch resolves and merges
     while a Show more / Fetch all page fetch is also in flight, and that page fetch finishes
     later, its stale-snapshot write can silently drop the reply merge from `remoteSearch.results`.
     Blast radius is narrow and self-healing: it requires overlapping in-flight requests from two
     separate user actions; a Show more / Fetch all render already rebuilds the entire comments
     subtree regardless (so the stale write causes no additional DOM breakage beyond that existing
     subtree rebuild); and re-expanding the affected thread afterward just re-fetches its replies
     (extra quota, no permanent data loss or crash).
     Fixing this fully would require changing `fetchNextInstantSearchPage` in
     `instantCommentsSearch.ts` (Task 17, out of scope for Task 18) to also merge against fresh
     state instead of its pre-fetch snapshot.
6. **Quota exceeded**: the button restores to `+` and the existing upgrade modal opens
   (`UPGRADE_OPEN_REPLIES_MODAL_MESSAGE`, same modal used by degraded filters / export). No
   pending intent is attached — after the full archive loads, clicking `+` again resolves
   locally.
7. **Abort / other errors**: an `AbortError` restores the button silently; any other error
   restores the button and logs via `console.error`. Neither renders a replies block.
