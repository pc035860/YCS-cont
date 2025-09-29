# 4c15768 Alignment: processComments vs migrateContinuationItems (Differences and Mapping)

## Goals

- Clarify the responsibilities and data flow of `processComments` and `migrateContinuationItems` in the JS (new) implementation.
- Map them to the TS (origin) implementation.
- Summarize differences between legacy and new Innertube responses and provide unification guidance.

---

## New (JS) flow overview

- Core functions:
    - `processComments(continuationItems, state)`
        - Iterate continuation blocks:
            - If `commentThreadRenderer.comment` → collect and annotate (verified, heart)
            - If `continuationItemRenderer` → extract token/tracking and fetch next
            - After response, read `appendContinuationItemsAction.continuationItems`, normalize via `migrateContinuationSubItems()` and recurse
        - Replies pagination is supported via `replies.commentRepliesRenderer.continuations[0].nextContinuationData`
    - `migrateContinuationItems(...)` / `migrateContinuationSubItems(...)`
        - Normalize payloads (`reload...` / `append...`) into a unified item shape
        - Use `frameworkUpdates` (via `getFrameworkUpdatesById(response)`) to enrich item attributes (e.g., heart)
    - Utilities: widely use `objectScan` to extract tokens, clickTrackingParams, sort params, etc.

- Pagination strategy:
    - First page: find the initial `continuation` token from `ytInitialData` or initial `details` response
    - Next pages: read `reloadContinuationItemsCommand.continuationItems` then `appendContinuationItemsAction.continuationItems`
    - Detect end: check the last item's `continuationItemRenderer.button.buttonRenderer.command.continuationCommand`

---

## Current (TS) mapping (aligned with new)

- Where and how:
    - Main: `utils/assist.ts`
        - Top‑level loading (now fully aligned with the new model):
            - Initial token: same as new JS
            - Continuation items: read from `onResponseReceivedEndpoints`
            - Normalize: `migrateContinuationItemsWithFW(items, getFrameworkUpdatesById(response))`
                - For `commentThreadRenderer.commentViewModel` / `commentViewModel`, build standard `commentRenderer` via `generateCommentObjectFromFW(...)`
                - Also reconstruct replies `commentRepliesRenderer.continuations` structure
            - Before/after pushing, call `applyFrameworkUpdatesToComment(...)` to map heart/verified/owner/sponsor
        - Replies:
            - Parse token via `extractReplyContinuationFromItem(...)`
            - Normalize each batch via `migrateContinuationItemsWithFW(...)`
        - Fields/flags:
            - `generateCommentObjectFromFW(...)` outputs `contentText.runs/fullText`, `likeCount/replyCount`, heart/verified/sponsor, publishedTime

### Mapping (JS → TS)

- `processComments(...)` (JS)
    - Maps to TS: `getAllCommentsModeV2(...)` looping through continuationItems and pagination, plus `_getAllRepliesComment(...)` for replies
- `migrateContinuationItems(...)` / `migrateContinuationSubItems(...)` (JS)
    - TS provides equivalent behavior via the FW‑driven normalizers described above

---

## Innertube response and usage (current)

- Response paths to support:
    - Top-level:
        - First page: `...reloadContinuationItemsCommand.continuationItems`
        - Next pages: `...appendContinuationItemsAction.continuationItems`
    - Replies:
        - Entry: `replies.commentRepliesRenderer.continuations[0].nextContinuationData`

- Normalization strategy:
    - Both JS/TS are frameworkUpdates‑driven: `getFrameworkUpdatesById` → `generateCommentObject*` → `migrateContinuation*`

- Attributes (heart/verified/owner/sponsor):
    - Use `frameworkUpdates` as source of truth; fallback to existing fields only when absent

---

## Notes

- Token parsing helpers are extracted as `extractNextContinuation(...)` and `extractReplyContinuationFromItem(...)`.

---

## References (quick index)

- JS reference: `web-resources/wresources.js`
    - `processComments(...)`
    - `migrateContinuationItems(...)`
    - `migrateContinuationSubItems(...)`
    - `getFrameworkUpdatesById(...)`

- TS implementation: `src/source/utils/assist.ts`
    - Top-level: `getAllCommentsModeV2(...)`
    - Replies: `_getAllRepliesComment(...)`
    - Field cleanup: `_prepareFieldsComment(...)` and `renderFullText` assembly
