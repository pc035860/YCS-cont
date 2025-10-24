# YouTube Innertube Chat Replay API Changes

**Document Version:** 2.0
**Last Updated:** 2025-10-24
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

---

## PlayerSeekContinuationData Enhancement (v2.0)

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

| Continuation Type | Purpose | Used In |
|------------------|---------|---------|
| **liveChatReplayContinuationData** | Time-based sequential pagination | v1.0 (simple token-based iteration) |
| **playerSeekContinuationData** | Player position-based seeking | v2.0 (offset-based iteration with start guarantee) |

The key insight: `playerSeekContinuationData` works with `playerOffsetMs` parameter, allowing precise control over the starting position.

### Implementation Flow

#### Stage 1: Two-Stage Initialization

```typescript
// Extract playerSeekContinuationData from initial response
const playerSeekData = continuations.find(
    c => c.playerSeekContinuationData
)?.playerSeekContinuationData;

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
let currentOffsetMs = 0;  // Start from video beginning

while (next) {
    params = getParamsForChat(
        window, playerSeekToken, signal,
        false,           // useLegacyApi = false
        currentOffsetMs, // playerOffsetMs
        true             // usePlayerSeek = true
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

| Feature | Legacy API | New API v2 (PlayerSeek) |
|---------|-----------|------------------------|
| **Continuation Token** | Fixed `reloadContinuation` | Dynamic `playerSeekContinuation` |
| **Token Updates** | ❌ Never updates | ✅ Updates every response |
| **playerOffsetMs** | ✅ From 0, increments | ✅ From 0, increments |
| **Termination** | offset comparison | offset comparison |
| **Start Guarantee** | ✅ Always from 0 | ✅ Always from 0 |

**Hybrid Approach**: Combines the best of both worlds
- Dynamic continuation tokens (modern API feature)
- playerOffsetMs control (proven legacy mechanism)

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

| Feature | Legacy API | New API v1 | New API v2 (Current) |
|---------|-----------|-----------|---------------------|
| **Continuation Type** | reloadContinuation (fixed) | liveChatReplayContinuation (dynamic) | playerSeekContinuation (dynamic) |
| **playerOffsetMs** | ✅ Yes (from 0) | ❌ No | ✅ Yes (from 0) |
| **Token Update** | ❌ Fixed token | ✅ Updates each response | ✅ Updates each response |
| **Start Position** | ✅ Guaranteed from 0 | ❌ Depends on entry point | ✅ Guaranteed from 0 |
| **Termination** | Offset comparison | Token existence | Offset comparison |
| **Request Complexity** | Medium | Low | Medium |
| **Reliability** | High | Medium | High |

### Response Structure

#### Legacy API

- **Continuation Location**: `header.liveChatHeaderRenderer.viewSelector.sortFilterSubMenuRenderer.subMenuItems[1].continuation.reloadContinuationData`
- **Continuation Count**: 1 token (fixed)
- **Termination**: Compare `videoOffsetTimeMsec` values

#### New API

- **Continuation Location**: `continuations[0].reloadContinuationData` (initial) or `continuations[0].liveChatReplayContinuationData` (subsequent)
- **Continuation Count**: 2 tokens (replay + seek)
- **Termination**: `continuation` is null or missing

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
- `getChatComments()` - Two-stage initialization + dual-mode iteration (playerSeek vs fallback)

### Key Implementation Patterns

**Two-Stage Initialization**:
1. Fetch initial response to extract `playerSeekContinuationData`
2. Fallback to `liveChatReplayContinuationData` if playerSeek unavailable
3. Set `usePlayerSeekMode` flag for downstream iteration logic

**Dual-Mode Iteration**:
- **PlayerSeek mode**: Updates both `playerSeekToken` and `playerOffsetMs` each iteration, terminates on offset match
- **Fallback mode**: Uses `liveChatReplayContinuationData` without offset tracking, terminates when continuation is null

**Graceful Fallback**:
```typescript
if (!playerSeekData?.continuation) {
    console.warn('No playerSeekContinuationData found, falling back to liveChatReplayContinuationData mode');
    usePlayerSeekMode = false;
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

### New API v2 Flow (with playerSeek)

```
Initial Token (reloadContinuationData from getCDChat)
  ↓
Stage 1: Initial Request → Extract playerSeekContinuationData
  ↓
playerSeekToken + playerOffsetMs = 0
  ↓
Request 1 → Response 1 (messages with videoOffsetTimeMsec: 201922 - 206091)
  ↓ Update: playerSeekToken (new) + playerOffsetMs = 206091
Request 2 → Response 2 (messages with videoOffsetTimeMsec: 207130 - 212199)
  ↓ Update: playerSeekToken (new) + playerOffsetMs = 212199
Request 3 → Response 3 (messages with videoOffsetTimeMsec: 213238 - 218307)
  ↓ Update: playerSeekToken (new) + playerOffsetMs = 218307
Request N → Response N (last message videoOffsetTimeMsec = 293376, same as request)
  ↓ Termination: currentOffsetTimeMsec === lastOffsetTimeInCmnts
End (no more messages)
```

**Key Differences from Legacy API**:
- **Token Updates**: `playerSeekToken` updates every response (dynamic)
- **Offset Updates**: `playerOffsetMs` updates like legacy API (from `videoOffsetTimeMsec`)
- **Hybrid Mechanism**: Combines dynamic tokens + offset-based pagination
- **Start Guarantee**: `playerOffsetMs=0` ensures start from beginning

**Key Differences from New API v1**:
- **Uses playerSeekContinuationData**: Not liveChatReplayContinuationData
- **Includes playerOffsetMs**: v1 doesn't use this parameter
- **Termination**: Offset comparison (not token existence)
- **Start Guarantee**: Always from 0 (v1 depends on entry point)

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

✅ **Graceful Degradation**

```typescript
if (!result.continuationData) {
    console.log('STOP CHAT CD!!!! No continuation data available');
    return;
}
```

### 3. PlayerSeek Enhancement Pattern (V2.0)

✅ **Two-Stage Initialization**

- Extract `playerSeekContinuationData` from initial response
- Fallback to `liveChatReplayContinuationData` if unavailable
- Automatic mode selection based on available continuation type

✅ **Dual State Tracking** (PlayerSeek mode)

- Track both `playerSeekToken` (updates every response)
- Track `currentOffsetMs` (from `videoOffsetTimeMsec`)
- Similar to legacy API offset mechanism

✅ **Start Position Guarantee**

- Initialize `playerOffsetMs=0`
- Ensures chat replay starts from video beginning
- Independent of user's video entry point

✅ **Graceful Mode Switching**

```typescript
if (playerSeekData?.continuation) {
    usePlayerSeekMode = true; // Preferred: playerSeek + offset
} else {
    usePlayerSeekMode = false; // Fallback: v1 token-based
}
```

### 4. Termination Logic

| API Version | Termination Condition | Implementation |
|-------------|----------------------|----------------|
| **Legacy** | `currentOffsetTimeMsec === lastOffsetTimeInCmnts` | Timestamp comparison |
| **New v1** | `nextContinuation === null` | Token existence check |
| **New v2** | `currentOffsetTimeMsec === lastOffsetTimeInCmnts` | Timestamp comparison |

---

## Verification Checklist

Implementation verification checklist:

- [ ] Initial continuation token extracted correctly from both API versions
- [ ] API request URL constructed correctly (with/without `key` parameter)
- [ ] Request body structure matches API version (with/without `currentPlayerState`)
- [ ] First request uses initial continuation from `getCDChat()`
- [ ] Subsequent requests use continuation from previous response
- [ ] Loop terminates correctly for both API versions
- [ ] All messages parsed with `timestampUsec`, `authorName`, and `message` content
- [ ] No message loss (last batch messages are processed before termination)

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

This implementation serves as a reference pattern for handling YouTube API migrations in the YCS codebase.
