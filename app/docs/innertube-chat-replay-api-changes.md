# YouTube Innertube Chat Replay API Changes

**Document Version:** 2.1
**Last Updated:** 2026-11-17
**Document Type:** API Migration Guide & Design Reference

> **📌 Note**: This document focuses on design decisions and API migration strategies. For implementation details, please refer to the source code in `app/src/source/utils/innertube/chat.ts`.

---

## Overview

YouTube has migrated its Chat Replay API from a **legacy playerOffsetMs-based pagination mechanism** to a **modern dynamic continuation token system**. This document describes the key differences, implementation changes in YCS, and migration strategies.

### Key Changes Summary

#### Version 1.0 (2025-10-17)

- **Pagination Method**: Changed from fixed continuation + dynamic `playerOffsetMs` to dynamic continuation tokens
- **API Endpoint**: Removed `key` parameter requirement for new API
- **Request Structure**: Simplified request body (removed `currentPlayerState`)
- **Termination Logic**: Changed from timestamp comparison to continuation token existence check
- **Continuation Source**: New path in API response structure

#### Version 2.0 (2025-10-24) - PlayerSeek Enhancement

- **PlayerSeek Support**: New API now supports `playerSeekContinuationData` + `playerOffsetMs` mechanism
- **Start Position Guarantee**: Ensures chat replay always starts from video beginning (offset=0)
- **Dual Continuation Types**: Uses both `liveChatReplayContinuationData` and `playerSeekContinuationData`
- **Two-Stage Initialization**: Fetches playerSeekContinuationData from initial response, then iterates with playerOffsetMs
- **Graceful Fallback**: Automatically switches to v1 logic if playerSeekContinuationData is unavailable

#### Version 2.1 (2026-11-17) - Seek for the start position only

- **Pagination Source**: `liveChatReplayContinuationData` paginates every page; the seek token is used once, for `playerOffsetMs=0`
- **Termination Logic**: Back to token existence (v1.0), because the offset comparison stopped long replays early
- **Why**: `get_live_chat_replay` answers a _range_ of `playerOffsetMs` values with the same page, so an
  offset-driven loop stalls mid-stream and reads the stall as the end of the chat (see below)
- **Replay detection**: `liveChatRenderer.isReplay` lets callers skip the `get_live_chat` probe, which
  rejects replay continuations with HTTP 400

---

## PlayerSeekContinuationData Enhancement (v2.0)

> **⚠️ Superseded by v2.1.** The start-position guarantee described here is still required and is
> still provided by `playerOffsetMs=0`. What changed is that the offset no longer drives pagination —
> see [v2.1: Seek for the start position only](#v21-seek-for-the-start-position-only).

### Problem Statement

The v1.0 implementation of the new Chat Replay API had a critical limitation: it could not guarantee that chat replay would start from the video beginning. The initial continuation token (`reloadContinuationData`) might be influenced by the user's video entry point, potentially missing early chat messages.

The legacy API solved this problem using `playerOffsetMs=0`, which explicitly instructs YouTube's API to start from timestamp 0, regardless of where the user entered the video.

### Solution Overview

Version 2.0 brings the robustness of legacy API's start position guarantee to the new API by:

1. **Using playerSeekContinuationData**: A different type of continuation token designed for player seeking
2. **Adding playerOffsetMs parameter**: Similar to legacy API, initialized to 0
3. **Two-stage initialization**: Fetching playerSeekContinuationData before starting iteration
4. **Graceful fallback**: Reverting to v1 logic if playerSeekContinuationData is unavailable

### Why playerSeekContinuationData?

YouTube's Chat Replay API response contains **two types of continuation tokens**:

| Continuation Type                  | Purpose                          | Used In                                            |
| ---------------------------------- | -------------------------------- | -------------------------------------------------- |
| **liveChatReplayContinuationData** | Time-based sequential pagination | v1.0 (simple token-based iteration)                |
| **playerSeekContinuationData**     | Player position-based seeking    | v2.0 (offset-based iteration with start guarantee) |

The key insight: `playerSeekContinuationData` works with `playerOffsetMs` parameter, allowing precise control over the starting position.

### Implementation Flow

#### Stage 1: Two-Stage Initialization

```typescript
// Extract playerSeekContinuationData from initial response
const playerSeekData = continuations.find((c) => c.playerSeekContinuationData)?.playerSeekContinuationData;

if (playerSeekData?.continuation) {
    usePlayerSeekMode = true;
} else {
    // Fallback: use liveChatReplayContinuationData (v1 logic)
    usePlayerSeekMode = false;
}
```

#### Stage 2: Iteration Modes

**PlayerSeek Mode** (preferred):

```typescript
let currentOffsetMs = 0; // Start from video beginning

while (next) {
    params = getParamsForChat(
        window,
        playerSeekToken,
        signal,
        false, // useLegacyApi = false
        currentOffsetMs, // playerOffsetMs
        true // usePlayerSeek = true
    );

    // Termination: same offset means no more messages
    if (currentOffsetMs === lastOffsetMs) break;

    // Update both states
    currentOffsetMs = lastOffsetMs;
    playerSeekToken = extractPlayerSeekToken(response);
}
```

**Fallback Mode** (v1 logic):

```typescript
while (nextContinuation) {
    params = getParamsForChat(window, nextContinuation, signal, false);
    nextContinuation = extractLiveChatReplayContinuation(response);
    if (!nextContinuation) break;
}
```

### Key Differences from Legacy API

| Feature                | Legacy API                 | New API v2 (PlayerSeek)          |
| ---------------------- | -------------------------- | -------------------------------- |
| **Continuation Token** | Fixed `reloadContinuation` | Dynamic `playerSeekContinuation` |
| **Token Updates**      | ❌ Never updates           | ✅ Updates every response        |
| **playerOffsetMs**     | ✅ From 0, increments      | ✅ From 0, increments            |
| **Termination**        | offset comparison          | offset comparison                |
| **Start Guarantee**    | ✅ Always from 0           | ✅ Always from 0                 |

**Hybrid Approach**: Combines the best of both worlds

- Dynamic continuation tokens (modern API feature)
- playerOffsetMs control (proven legacy mechanism)

---

## v2.1: Seek for the start position only

### Problem

The v2.0 loop advanced `playerOffsetMs` to the last message of each batch and stopped when the
next response ended at the same offset:

```typescript
if (currentOffsetTimeMsec === lastOffsetTimeInCmnts) break; // "no more messages"
```

That assumption does not hold. `get_live_chat_replay` answers a **range** of `playerOffsetMs`
values with the **same page**, so once the cursor lands on such a page the loop re-requests it
forever and the equality check fires as if the chat had ended.

Measured on `Vthypqd1Ni0` (9h39m VOD), using the seek token from the initial response:

```
seek(351353) → 37 messages, offsets 305039..351974
seek(351974) → 37 messages, offsets 305039..351974   ← identical page, identical replay token
seek(351975) → 37 messages, offsets 305039..351974   ← still the same page
seek(352100) → 44 messages, offsets 305039..355816   ← next page
```

The loop set `playerOffsetMs = 351974`, got the same page back, and stopped at **5.9 min / 687
messages**. The `liveChatReplayContinuationData` token carried by that same response pointed at
`352109`, and following it reaches the end of the stream (**69,906 messages**, 1816 requests).

The stall is not specific to that video — it is a page boundary. On a 3h22m VOD the same loop
stalled at 202.40 min of a 202.48 min stream, i.e. at the real end, which is why most videos look
fine and only long replays lose data.

### Solution

Split the two jobs the seek token was doing:

1. **Start position** — one request with the seek token and `playerOffsetMs=0`. This is what keeps
   the replay anchored at the video beginning when the page was opened with `&t=` (the
   `reloadContinuationData` token is entry-point dependent: with `&t=3600s` it returns offset 0 and
   then jumps straight to 3596243).
2. **Pagination** — follow `liveChatReplayContinuationData` from that response until the server
   stops offering one. This is the token YouTube's own client paginates with, and it always
   advances.

```typescript
const initialPage = await fetchReplayPage(continuationData, signal); // reload token
const seekToken = findPlayerSeekToken(initialPage);

let nextContinuation = null;
if (seekToken) {
    const firstPage = await fetchReplayPage({ continuation: seekToken }, signal, 0); // start at 0
    if (firstPage?.actions?.length) {
        processReplayBatch(firstPage.actions, context);
        nextContinuation = extractReplayContinuation(firstPage);
    }
}

if (!nextContinuation) {
    // No playerSeek support, or the seek page was unusable: the initial response is the first batch
    processReplayBatch(initialPage.actions, context);
    nextContinuation = extractReplayContinuation(initialPage);
}

while (nextContinuation) {
    const page = await fetchReplayPage({ continuation: nextContinuation }, signal);
    if (!page) break;
    processReplayBatch(page.actions, context);
    const following = extractReplayContinuation(page);
    if (!following || following === nextContinuation) break;
    nextContinuation = following;
}
```

There is no offset tracking and no offset comparison left in the replay path. Duplicate messages
across pages are dropped by `processReplayBatch` (keyed on `timestampUsec`), so the overlap the seek
endpoint returns is harmless.

### Cost

Roughly the same number of requests as before: the seek endpoint returns ~80-100 messages per page
with a large lookback overlap, the replay token returns ~40 new messages per page. Both measured at
~38 new messages per request on the 9h39m VOD.

---

## API Version Comparison

### Request Structure

#### Legacy API (Old)

```http
POST /youtubei/v1/live_chat/get_live_chat_replay?key=${apiKey}
Content-Type: application/json

{
  "context": {...},
  "continuation": "fixed_continuation_token",
  "currentPlayerState": {
    "playerOffsetMs": "11425842"
  }
}
```

#### New API v1

```http
POST /youtubei/v1/live_chat/get_live_chat_replay
Content-Type: application/json

{
  "context": {...},
  "continuation": "dynamic_continuation_token"
}
```

#### New API v2 (with playerSeek)

```http
POST /youtubei/v1/live_chat/get_live_chat_replay
Content-Type: application/json

{
  "context": {...},
  "continuation": "playerSeek_continuation_token",
  "currentPlayerState": {
    "playerOffsetMs": "0"
  }
}
```

**Key Feature**: The `currentPlayerState` with `playerOffsetMs` ensures chat replay starts from video beginning (0ms), similar to legacy API.

### API Version Comparison Table

| Feature                | Legacy API                 | New API v1                           | New API v2 (Current)             |
| ---------------------- | -------------------------- | ------------------------------------ | -------------------------------- |
| **Continuation Type**  | reloadContinuation (fixed) | liveChatReplayContinuation (dynamic) | playerSeekContinuation (dynamic) |
| **playerOffsetMs**     | ✅ Yes (from 0)            | ❌ No                                | ✅ Yes (from 0)                  |
| **Token Update**       | ❌ Fixed token             | ✅ Updates each response             | ✅ Updates each response         |
| **Start Position**     | ✅ Guaranteed from 0       | ❌ Depends on entry point            | ✅ Guaranteed from 0             |
| **Termination**        | Offset comparison          | Token existence                      | Offset comparison                |
| **Request Complexity** | Medium                     | Low                                  | Medium                           |
| **Reliability**        | High                       | Medium                               | High                             |

### Response Structure

#### Legacy API

- **Continuation Location**: `header.liveChatHeaderRenderer.viewSelector.sortFilterSubMenuRenderer.subMenuItems[1].continuation.reloadContinuationData`
- **Continuation Count**: 1 token (fixed)
- **Termination**: Compare `videoOffsetTimeMsec` values

#### New API

- **Continuation Location**: `continuations[0].reloadContinuationData` (initial) or `continuations[0].liveChatReplayContinuationData` (subsequent)
- **Continuation Count**: 2 tokens (replay + seek)
- **Termination**: `continuation` is null or missing

> **Live streams only:** `continuations[0]` selects the "Top chat" mode
> (`liveChatCurrentFilter: LIVE_CHAT_FILTER_MODE_DEFAULT`), which drops messages YouTube considers
> spam. Live chat fetching upgrades to the "Live chat" mode
> (`LIVE_CHAT_FILTER_MODE_UNFILTERED`) using the sub-menu continuation carried by the first
> `get_live_chat` response. See `docs/live-recording.md` → "Chat Mode (Top chat vs Live chat)".

```json
{
  "continuationContents": {
    "liveChatContinuation": {
      "continuations": [
        {
          "liveChatReplayContinuationData": {
            "timeUntilLastMessageMsec": 5000,
            "continuation": "token_for_next_batch"
          }
        },
        {
          "playerSeekContinuationData": {
            "continuation": "token_for_seeking"
          }
        }
      ],
      "actions": [...]
    }
  }
}
```

---

## Implementation Changes

### Modified Files

**Type Definitions** (`interfaces/i_types.ts`):

- `PlayerSeekContinuationData` - Type definition for playerSeek continuation structure
- `LiveChatReplayContinuationData` - Type definition for liveChatReplay continuation structure
- `LiveChatContinuationItem` - Unified continuation item type supporting both continuation types

**Core Implementation** (`innertube/chat.ts`):

- `getCDChat()` - Three-tier fallback mechanism for continuation token extraction (new API → legacy API → deep search)
- `getParamsForChat()` - Request builder with conditional `playerOffsetMs` support (legacy API + playerSeek mode)
- `getChatComments()` - seek(0) for the start position, then `liveChatReplayContinuationData` pagination

### Key Implementation Patterns

**Start position** (v2.1):

1. Fetch the initial response to extract `playerSeekContinuationData`
2. Request it once with `playerOffsetMs=0` — this is the only use of the offset
3. Take `liveChatReplayContinuationData` from that response as the pagination token

**Pagination** (v2.1):

- Follow `liveChatReplayContinuationData` until the server stops offering one
- No offset tracking, no offset comparison — see [v2.1](#v21-seek-for-the-start-position-only)

**Graceful Fallback**:

```typescript
if (!seekToken || seekPageUnusable) {
    // No playerSeek support: the initial response is the first batch
    processReplayBatch(initialPage.actions, context);
    nextContinuation = extractReplayContinuation(initialPage);
}
```

This ensures the extension remains functional even if YouTube modifies the API response structure.

---

## Continuation Token Flow

### Legacy API Flow

```
Initial Token (from getCDChat) + playerOffsetMs = 0
  ↓
Request 1 → Response 1 (messages with videoOffsetTimeMsec: 11425842 - 11914642)
  ↓ Same token + playerOffsetMs = 11914642
Request 2 → Response 2 (messages with videoOffsetTimeMsec: 11934546 - 12461579)
  ↓ Same token + playerOffsetMs = 12461579
Request 3 → Response 3 (messages with videoOffsetTimeMsec: 12462618 - 12652191)
  ↓ Same token + playerOffsetMs = 12652191
Request N → Response N (last message videoOffsetTimeMsec = 12652191, same as request)
  ↓ Termination: currentOffsetTimeMsec === lastOffsetTimeInCmnts
End (no more messages)
```

> **Note:** this branch (`apiVersion === 'old'`) is effectively unreachable today. `getCDChat()` reads
> the token from `ytData[3].response…`, the legacy PBJ _array_ shape, but `getInitYtData()` only ever
> returns the modern object shape (`isValidPbjResponse` requires a top-level `response`) or the
> `{ response, playerResponse? }` object from `getInitYtDataFromHtml()`. So `ytData[3]` is always
> undefined and the offset comparison above cannot fire. It is left in place rather than removed so
> this change stays scoped to the reachable path.

### New API v1 Flow

```
Initial Token (from getCDChat)
  ↓
Request 1 → Response 1 (49 messages)
  ↓ continuations[0].liveChatReplayContinuationData.continuation
Request 2 → Response 2 (48 messages)
  ↓ continuations[0].liveChatReplayContinuationData.continuation
Request 3 → Response 3 (46 messages)
  ↓ continuations[0].liveChatReplayContinuationData.continuation
Request N → ...continues until continuation is null
  ↓ continuations[0].liveChatReplayContinuationData.continuation = null
End (no more messages)
```

### New API v2 Flow (v2.1: seek once, then replay tokens)

```
Initial Token (reloadContinuationData from getCDChat)
  ↓
Stage 1: Initial Request → Extract playerSeekContinuationData
  ↓
Stage 2: Request with playerSeekContinuationData + playerOffsetMs = 0
  ↓ Response 1 (messages from videoOffsetTimeMsec 0) + liveChatReplayContinuationData
Request 2 → Response 2 (next page)
  ↓ Update: liveChatReplayContinuationData (new)
Request 3 → Response 3 (next page)
  ↓ Update: liveChatReplayContinuationData (new)
Request N → Response N (no liveChatReplayContinuationData)
  ↓ Termination: continuation token missing
End (no more messages)
```

**Key Differences from v2.0**:

- **Offset usage**: `playerOffsetMs` is sent once, with value `0`; it never advances
- **Pagination**: `liveChatReplayContinuationData`, the same token type v1 used
- **Termination**: Token existence, not offset comparison
- **Start Guarantee**: Still `playerOffsetMs=0`

**Why the offset cannot drive pagination**: `get_live_chat_replay` returns the same page for a range
of `playerOffsetMs` values. Setting the offset to the last message of the previous page can land
inside such a range, and the loop then re-reads the same page forever. See
[v2.1](#v21-seek-for-the-start-position-only).

---

## Migration Patterns & Best Practices

### 1. Backward Compatibility Strategy

✅ **Dual-Track Implementation**

- Maintain complete legacy API support
- Implement parallel new API support
- Automatic version detection at runtime
- Zero breaking changes to existing functionality

### 2. Error Handling

✅ **Three-Tier Fallback** in `getCDChat()`

1. Try new API path (`continuations[0].reloadContinuationData`)
2. Fallback to legacy API path (`header.viewSelector.sortFilterSubMenuRenderer.subMenuItems[1].continuation`)
3. Deep search for `reloadContinuationData` across entire response

For live streams the new API path starts in "Top chat" mode; `getLiveChatUnfiltered()` upgrades it to
"Live chat" (all messages) after the first response. The legacy path already points at
`subMenuItems[1]` ("Live chat").

✅ **Graceful Degradation**

```typescript
if (!result.continuationData) {
    console.log('STOP CHAT CD!!!! No continuation data available');
    return;
}
```

### 3. PlayerSeek Enhancement Pattern (V2.1)

✅ **Seek Once, Then Token Pagination**

- Extract `playerSeekContinuationData` from the initial response
- Request it once with `playerOffsetMs=0` to pin the start position
- Paginate with the `liveChatReplayContinuationData` carried by that response
- No offset tracking, no offset comparison

✅ **Start Position Guarantee**

- `playerOffsetMs=0` on the single seek request
- Ensures chat replay starts from video beginning
- Independent of user's video entry point (`&t=` makes `reloadContinuationData` start mid-stream)

✅ **Graceful Fallback**

```typescript
if (!seekToken || seekPageUnusable) {
    // No playerSeek support: the initial response is the first batch
    processReplayBatch(initialPage.actions, context);
    nextContinuation = extractReplayContinuation(initialPage);
}
```

### 4. Termination Logic

| API Version  | Termination Condition                             | Implementation                                    |
| ------------ | ------------------------------------------------- | ------------------------------------------------- |
| **Legacy**   | `currentOffsetTimeMsec === lastOffsetTimeInCmnts` | Timestamp comparison                              |
| **New v1**   | `nextContinuation === null`                       | Token existence check                             |
| **New v2.0** | `currentOffsetTimeMsec === lastOffsetTimeInCmnts` | Timestamp comparison — **stalls on long replays** |
| **New v2.1** | `nextContinuation === null`                       | Token existence check                             |

---

## Verification Checklist

Implementation verification checklist:

- [ ] Initial continuation token extracted correctly from both API versions
- [ ] API request URL constructed correctly (with/without `key` parameter)
- [ ] Request body structure matches API version (with/without `currentPlayerState`)
- [ ] First request uses initial continuation from `getCDChat()`
- [ ] `playerOffsetMs=0` is sent exactly once, with the seek token
- [ ] Subsequent requests follow `liveChatReplayContinuationData`
- [ ] Loop terminates when the continuation token is missing
- [ ] All messages parsed with `timestampUsec`, `authorName`, and `message` content
- [ ] No message loss (last batch messages are processed before termination)
- [ ] A long replay (>1h) reaches the end of the video, not a mid-stream page boundary

---

## Testing Commands

### JQ Commands for Response Analysis

Extract continuation token:

```bash
jq '.continuationContents.liveChatContinuation.continuations[0].liveChatReplayContinuationData.continuation' response.json
```

Count messages:

```bash
jq '.continuationContents.liveChatContinuation.actions | length' response.json
```

Extract time range (using videoOffsetTimeMsec):

```bash
jq '[.continuationContents.liveChatContinuation.actions[].replayChatItemAction.videoOffsetTimeMsec | tonumber] | [min, max]' response.json
```

Check continuation types:

```bash
jq '.continuationContents.liveChatContinuation.continuations[] | keys' response.json
```

### Test Data

Test API responses are available in:

- `specs/005-chat-replay-fix/` - Latest chat replay API implementation test data
- `specs/004-refactor-innertube/` - Comment API refactoring test data
- `specs/003-sponsor-filter/` - Sponsor message filtering test data

---

## Conclusion

### Version 1.0 (2025-10-17): Initial Migration

The migration to the new Chat Replay API demonstrates a robust approach to API version changes:

- **MVP-First**: Only modified critical functions with minimal changes
- **Backward Compatible**: Full support for legacy API maintained
- **Fault Tolerant**: Three-tier fallback mechanism ensures stability
- **Zero Breaking Changes**: Existing message processing logic untouched

### Version 2.0 (2025-10-24): PlayerSeek Enhancement

The playerSeekContinuationData enhancement brings the robustness of legacy API's start position guarantee to the new API:

- **Start Position Guarantee**: New API now supports playerOffsetMs=0 initialization
- **Hybrid Approach**: Combines dynamic token updates with offset-based iteration
- **Graceful Fallback**: Automatically switches to v1 logic if playerSeek is unavailable
- **Zero Breaking Changes**: V1 fallback ensures compatibility
- **Simplified Logic**: Unified offset handling between legacy and new API
- **Type Safety**: Complete TypeScript interface coverage for all continuation types

**Key Insight**: This enhancement demonstrates the importance of maintaining proven mechanisms (playerOffsetMs) while adopting new technologies (dynamic continuation tokens). The hybrid approach achieves the best of both worlds: modern API features + reliable start position control.

### Version 2.1 (2026-11-17): Seek for the start position only

v2.0 assumed the seek endpoint advances one page per `playerOffsetMs` value. It does not: a range of
offsets maps to the same page, so the offset-equality termination fired mid-stream and truncated
long replays (a 9h39m VOD stopped at 5.9 min with 687 of 69,906 messages).

- **Offset usage**: `playerOffsetMs=0` once, for the start position only
- **Pagination**: `liveChatReplayContinuationData`, the token YouTube's own client follows
- **Termination**: Token existence, not offset comparison
- **Replay detection**: `liveChatRenderer.isReplay` skips the `get_live_chat` probe (HTTP 400 on replays)

**Key Insight**: A mechanism that works on short inputs can hide a wrong assumption. The offset
comparison was correct only when the stall happened to coincide with the end of the video — which is
exactly what a short replay does.

This implementation serves as a reference pattern for handling YouTube API migrations in the YCS codebase.
