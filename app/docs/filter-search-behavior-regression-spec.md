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
   - `F != none`: keep current filter and trigger one Search via `requestAnimationFrame` (re-search with empty query)
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

`youtubeApiEnabled` does **not** gate Instant Search. It only chooses Data API vs Innertube for **full comment load** (Load all / autoload full fetch). Instant can run with Enable OFF (Innertube full load + Data API `searchTerms`).

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

A session is **complete** when all of: session active, ≥1 result, and no `nextPageToken` remaining (single-page result, or every API page fetched via show-more). Unlocked filters then run **locally** over the instant result set — no API call — and `sortFirst` orders by `publishedAt` date (Data API results are relevance-ordered; full-archive Innertube ordering is unchanged). Clearing an active filter on the same query also re-renders locally instead of re-hitting the API.

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
| S3 Results | Instant search returned matches | Instant chip + `N matches for … · Load all comments for filters & export` |
| S4 Zero matches | Instant search returned zero items | Zero-match copy for current query |
| S5 Empty-query hint | Empty `Q` + explicit Search in instant mode | Hint copy from Section 12.2 |
| S6 Upgrading | Full load in progress after instant use | Progress copy for upgrade path |
| S7 Upgraded | Full load complete; same query re-run locally | Normal `(Comments) Found: M`; all filters unlocked |
| S8 All-mode combined | Search type `all`: instant comments + other sources (chat/transcript) rendered | Instant chip + combined `(All) Found: N` (or filter-specific label) + load-all CTA; the chip **must not** be overwritten by plain text |

Quota exceeded: show notify box `YouTube API quota exceeded. Instant search unavailable — you can still load comments normally.`

`Load all` remains visible in instant mode at all times.

### 12.7 Shorts (MUST)

On Shorts pages, instant Search / Enter counts as search intent.

1. Native comments stay hidden while search intent is active, including zero instant results
2. Existing restore rules are unchanged: native comments restore only after clearing search text and removing active filter (or when YCS is collapsed/cleaned up)
