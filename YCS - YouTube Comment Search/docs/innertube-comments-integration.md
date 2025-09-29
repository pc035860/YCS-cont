# Innertube Comments Integration & Continuation Processing Guide

Unifies and streamlines the guidance from the previous two documents:

- continuation-processing.md
- innertube-migration-guide.md

This guide explains how YCS consumes YouTube's Innertube responses for comments using the new frameworkUpdates-driven model, how pagination/continuations are processed, and how the JS (compiled) and TS (origin) implementations map to each other.

---

## TL;DR Checklist

- Build `frameworkUpdatesById` from `response.frameworkUpdates.entityBatchUpdate.mutations`.
- Normalize `continuationItems` via FW-aware helpers to produce items with a standard `commentRenderer`.
- For pagination: prefer `reloadContinuationItemsCommand.continuationItems`, then `appendContinuationItemsAction.continuationItems`.
- Extract next tokens via helpers and loop until no continuation.
- For replies, derive token from `replies.commentRepliesRenderer.continuations[0].nextContinuationData` (or equivalent VM keys), then normalize.
- Always enrich attributes (heart/verified/owner/sponsor) using `frameworkUpdates` as source of truth.

---

## Why this migration

- Legacy model exposed comment text directly in `commentRenderer.contentText.runs`.
- New model renders `commentViewModel` containers in `continuationItems`, while actual content and states live in `frameworkUpdates.entityBatchUpdate.mutations`.
- Reading `runs` only often yields correct counts but empty content; joining with FW is required.

---

## Legacy vs New: Structure Overview

- Continuation containers to support
    - Top-level pages
        - First page: `onResponseReceivedEndpoints[1].reloadContinuationItemsCommand.continuationItems`
        - Next pages: `onResponseReceivedEndpoints[0].appendContinuationItemsAction.continuationItems`
    - Replies
        - Entry token from `replies.commentRepliesRenderer.continuations[0].nextContinuationData`

- Key difference
    - Legacy: `...commentThreadRenderer.comment.commentRenderer.contentText.runs`
    - New: `...commentThreadRenderer.commentViewModel.commentViewModel` (or `commentViewModel`)
        - Real content reconstructed using FW mutations

---

## Core Concepts in the New Model

- Build `frameworkUpdatesById`
    - Source: `frameworkUpdates.entityBatchUpdate.mutations`
    - Useful keys
        - `commentEntityPayload.properties.commentId` (content/author/toolbar)
        - `commentSurfaceEntityPayload.key` (published time, chips)
        - `engagementToolbarStateEntityPayload.key` (heart state)

- Index → Generate pipeline
    1. Locate `commentViewModel` in `continuationItems`
    2. Resolve IDs/keys to FW entities (`commentId`, surface key, toolbar key)
    3. Convert `commandRuns/attachmentRuns` into legacy-like `runs`
    4. Assemble a standard `commentRenderer` with `contentText.runs/fullText`, counts, badges, timestamps

---

## Data Flow and Pagination Strategy

- Top-level pages
    - First page: find initial continuation token from `ytInitialData` or the initial details response
    - Process `reloadContinuationItemsCommand.continuationItems`
    - Subsequent pages: process `appendContinuationItemsAction.continuationItems`
    - Detect the end: absence of a valid `continuationItemRenderer.button.buttonRenderer.command.continuationCommand`

- Replies
    - Derive token from `replies.commentRepliesRenderer.continuations[0].nextContinuationData` on a thread item
    - Fetch and normalize using the same FW pipeline
    - Loop via the same next-token extraction until no more replies

---

## Implemented Helpers (TypeScript, `src/source/utils/assist.ts`)

- `getFrameworkUpdatesById(response)`
    - Builds a dual-index map by `commentId` and by entity `key` for fast lookups

- `migrateRuns(baseText, rawRuns)`
    - Converts `commandRuns/attachmentRuns` into legacy-like `runs`, preserving links, timestamps, images

- `generateCommentObjectFromFW({ commentId, update, surfaceUpdate, toolbarStateUpdate })`
    - Produces a standard `commentRenderer` including `contentText.runs/fullText`, `likeCount/replyCount`, heart, verified/owner/sponsor, published time

- `migrateContinuationItemsWithFW(continuationItems, frameworkUpdatesById)`
    - Normalizes `commentViewModel` / `commentThreadRenderer.commentViewModel` into items containing `commentRenderer`
    - Reconstructs replies `commentRepliesRenderer.continuations` structure

- `extractNextContinuation(response)` / `extractReplyContinuationFromItem(item)`
    - Parses the next-page/replies continuation token and click tracking params

- `applyFrameworkUpdatesToComment(commentObj, vmSource, fwById)`
    - Safety pass to enrich heart/verified/owner/sponsor when needed

---

## JS (compiled) vs TS (origin) Mapping

- JS core functions (reference: `web-resources/wresources.js`)
    - `processComments(continuationItems, state)`
        - Iterates items, collects comment objects, follows `continuationItemRenderer` to fetch next pages
        - After each response, reads `appendContinuationItemsAction.continuationItems`, normalizes via a migration helper, and recurses
        - Supports replies pagination via `replies.commentRepliesRenderer.continuations[0].nextContinuationData`
    - `migrateContinuationItems(...)` / `migrateContinuationSubItems(...)`
        - Normalizes payloads (`reload...` / `append...`) into a unified shape
        - Uses FW (`getFrameworkUpdatesById`) to enrich attributes (e.g., heart)

- TS equivalents (reference: `src/source/utils/assist.ts`)
    - Top-level loading: `getAllCommentsModeV2(...)`
        - Initial token resolution aligns with the JS flow
        - Reads continuation items from `onResponseReceivedEndpoints`
        - Normalizes via `migrateContinuationItemsWithFW(items, getFrameworkUpdatesById(response))`
        - Applies `applyFrameworkUpdatesToComment(...)` before/after pushing to ensure badges/flags
    - Replies: `_getAllRepliesComment(...)`
        - Parses tokens via `extractReplyContinuationFromItem(...)`
        - Normalizes each batch via FW-driven helpers
    - Field preparation: `_prepareFieldsComment(...)` and full-text assembly for rendering

---

## Recommended Flows

### Top-level

1. Read `continuationItems` (prefer `reload`, then `append`).
2. Build `byId` via `getFrameworkUpdatesById(response)`.
3. Normalize with `migrateContinuationItemsWithFW(items, byId)`.
4. Push into the local list; optionally call `applyFrameworkUpdatesToComment(...)` for extra safety.
5. Use `extractNextContinuation(response)` to paginate until no more pages.

### Replies

1. Use `extractReplyContinuationFromItem(item)` to get the replies token.
2. Request and normalize with the same FW pipeline (`getFrameworkUpdatesById` + `migrateContinuationItemsWithFW`).
3. Loop using `extractNextContinuation(response)` until all replies are loaded.

---

## Attributes and Badges

- Treat `frameworkUpdates` as the source of truth for:
    - heart, verified, owner, sponsor
- Fallback to legacy fields only if FW data is absent.

---

## Common Pitfalls

- Seeing empty content despite correct counts
    - Cause: reading `runs` only; fix: always join via FW

- Indexing by entity `key` only
    - Use both `commentId` and `key` since responses vary

- Missing links/attachments in texts
    - Convert `commandRuns/attachmentRuns` via `migrateRuns`

---

## Verification Matrix

- Normal videos, Shorts, Live replays
- Sort orders: Top comments, Newest first
- Large sets (> 5k) and deep pagination
- Threads with replies (load all replies)
- Visual confirmation of heart/verified/owner/sponsor

---

## References

- JS reference: `web-resources/wresources.js`
    - `processComments(...)`
    - `migrateContinuationItems(...)`
    - `migrateContinuationSubItems(...)`
    - `getFrameworkUpdatesById(...)`

- TS implementation: `src/source/utils/assist.ts`
    - Top-level: `getAllCommentsModeV2(...)`
    - Replies: `_getAllRepliesComment(...)`
    - Field cleanup: `_prepareFieldsComment(...)` and render full text assembly
