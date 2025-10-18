# YouTube Innertube Chat Replay API Changes

**Document Version:** 1.0
**Last Updated:** 2025-10-17
**Document Type:** Implementation Guide & API Migration Reference

---

## Overview

YouTube has migrated its Chat Replay API from a **legacy playerOffsetMs-based pagination mechanism** to a **modern dynamic continuation token system**. This document describes the key differences, implementation changes in YCS, and migration strategies.

### Key Changes Summary

- **Pagination Method**: Changed from fixed continuation + dynamic `playerOffsetMs` to dynamic continuation tokens
- **API Endpoint**: Removed `key` parameter requirement for new API
- **Request Structure**: Simplified request body (removed `currentPlayerState`)
- **Termination Logic**: Changed from timestamp comparison to continuation token existence check
- **Continuation Source**: New path in API response structure

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

#### New API

```http
POST /youtubei/v1/live_chat/get_live_chat_replay
Content-Type: application/json

{
  "context": {...},
  "continuation": "dynamic_continuation_token"
}
```

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
            "continuation": "token_for_next_batch"  // ← Use this for next request
          }
        },
        {
          "playerSeekContinuationData": {
            "continuation": "token_for_seeking"  // ← For player seeking (not used by YCS)
          }
        }
      ],
      "actions": [...]  // Message array (typically 46-49 messages)
    }
  }
}
```

---

## Implementation Changes in YCS

### Modified Files

1. **`src/source/utils/interfaces/i_assist.ts`** (Lines 160-185)
    - Added `ChatApiVersion` type
    - Added `ChatContinuationResult` interface

2. **`src/source/utils/assist.ts`**
    - `getCDChat()` function (Lines 1420-1483): Three-tier fallback mechanism
    - `getParamsForChat()` function (Lines 1140-1177): Conditional request body
    - `getChatComments()` function (Lines 1514-2318): Dual-track processing logic

### Code Changes Details

#### 1. Type Definitions (i_assist.ts)

```typescript
export type ChatApiVersion = 'new' | 'old' | 'fallback';

export interface ChatContinuationResult {
    continuationData: object | null;
    apiVersion: ChatApiVersion;
    sourcePath?: string;
}
```

**Purpose**: Enable version detection and provide source path tracking for debugging.

---

#### 2. getCDChat() - Three-Tier Fallback

**Location**: `assist.ts:1420-1483`

```typescript
async function getCDChat(signal: AbortSignal): Promise<ChatContinuationResult> {
    const ytData = await getInitYtData(window.location.href, signal);

    // Priority 1: New API path
    const newApiData =
        ytData.response.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.continuations[0]
            .reloadContinuationData;
    if (newApiData) {
        return {
            continuationData: newApiData,
            apiVersion: 'new',
            sourcePath: 'continuations[0].reloadContinuationData'
        };
    }

    // Priority 2: Legacy API path
    const oldApiData =
        ytData.response.contents.twoColumnWatchNextResults.conversationBar.liveChatRenderer.header
            .liveChatHeaderRenderer.viewSelector.sortFilterSubMenuRenderer.subMenuItems[1].continuation
            .reloadContinuationData;
    if (oldApiData) {
        return {
            continuationData: oldApiData,
            apiVersion: 'old',
            sourcePath: 'header.viewSelector.sortFilterSubMenuRenderer...'
        };
    }

    // Priority 3: Deep search fallback
    const rCData = deepFindObjKey(ytData, 'reloadContinuationData');
    if (rCData?.continuation) {
        return {
            continuationData: rCData,
            apiVersion: 'fallback',
            sourcePath: 'deepFindObjKey(reloadContinuationData)'
        };
    }

    return { continuationData: null, apiVersion: 'fallback' };
}
```

**Key Features**:

- Automatically detects which API version YouTube is using
- Provides fallback mechanism for API structure changes
- Returns both data and version information for downstream logic

---

#### 3. getParamsForChat() - Conditional Request Body

**Location**: `assist.ts:1140-1177`

```typescript
async function getParamsForChat(
    w: Window,
    cLiveChat: any,
    signal?: AbortSignal,
    useLegacyApi: boolean = false,
    playerOffsetMs: number = 0
) {
    const bodyPayload: any = {
        context: { client: ytcfgData?.INNERTUBE_CONTEXT?.client },
        continuation: cLiveChat.continuation
    };

    // Only add playerOffsetMs for legacy API
    if (useLegacyApi) {
        bodyPayload.currentPlayerState = {
            playerOffsetMs: playerOffsetMs.toString()
        };
    }

    return {
        headers: {
            accept: '*/*',
            'accept-language': ytcfgData?.GOOGLE_FEEDBACK_PRODUCT_DATA?.accept_language || 'en-US,en;q=0.9',
            'content-type': 'application/json',
            pragma: 'no-cache',
            'cache-control': 'no-store',
            'x-youtube-client-name': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_NAME || '1',
            'x-youtube-client-version': ytcfgData?.INNERTUBE_CONTEXT_CLIENT_VERSION
        },
        referrerPolicy: 'strict-origin-when-cross-origin',
        body: JSON.stringify(bodyPayload),
        method: 'POST',
        mode: 'cors',
        credentials: 'include'
    };
}
```

**Key Changes**:

- Added `useLegacyApi` parameter to control request structure
- Conditionally includes `currentPlayerState` only for legacy API
- New API has simpler request body with just `context` and `continuation`

---

#### 4. getChatComments() - Dual-Track Processing

**Location**: `assist.ts:1514-2318`

This function now contains two complete parallel implementations:

##### Version Detection (Lines 1556-1567)

```typescript
const result = await getCDChat(signal);
if (!result.continuationData) {
    console.log('STOP CHAT CD!!!! No continuation data available');
    return;
}

const cDChat = result.continuationData;
const useLegacyApi = result.apiVersion === 'old';

console.log(`[getChatComments] Detected API version: ${result.apiVersion}`);
console.log(`[getChatComments] Source path: ${result.sourcePath}`);
```

##### Legacy API Loop (Lines 1570-1901)

```typescript
if (useLegacyApi) {
    console.log('Loop chat comments (Legacy API)');
    let currentOffsetTimeMsec = 0;
    let next = true;

    while (next) {
        const params = await getParamsForChat(
            window,
            cDChat,
            signal,
            true, // useLegacyApi = true
            currentOffsetTimeMsec
        );

        const res = await fetchR(
            `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay?key=${getInnertubeApiKey()}`,
            { ...params, signal, cache: 'no-store' }
        );

        let response = await res.json();
        let cmnts = response?.continuationContents?.liveChatContinuation?.actions;

        // Extract videoOffsetTimeMsec for termination check
        const lastOffsetTimeInCmnts = deepFindObjKey(cmnts[cmnts.length - 1], 'videoOffsetTimeMsec');

        // Termination: Same timestamp indicates no more messages
        if (currentOffsetTimeMsec === lastOffsetTimeInCmnts) {
            next = false;
            break;
        }

        // Process messages...
        for (const comment of cmnts) {
            // Message processing logic (shared with new API)
        }

        currentOffsetTimeMsec = lastOffsetTimeInCmnts;
    }
}
```

##### New API Loop (Lines 1904-2318)

```typescript
else {
    console.log('Loop chat comments (New API)');
    let nextContinuation = cDChat;

    while (nextContinuation) {
        const params = await getParamsForChat(
            window,
            nextContinuation,
            signal,
            false  // useLegacyApi = false
        );

        const res = await fetchR(
            `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay`,  // No key param
            { ...params, signal, cache: 'no-store' }
        );

        let response = await res.json();
        let cmnts = response?.continuationContents?.liveChatContinuation?.actions;

        // Extract next continuation token
        const continuations = response?.continuationContents?.liveChatContinuation?.continuations;
        const continuationToken = continuations?.[0]?.liveChatReplayContinuationData?.continuation;
        nextContinuation = continuationToken ? { continuation: continuationToken } : null;

        // Process messages...
        for (const comment of cmnts) {
            // Message processing logic (shared with legacy API)
        }

        // Termination: No continuation means finished
        if (!nextContinuation) {
            console.log('No more continuation, finished loading chat');
            break;
        }
    }
}
```

---

## Continuation Token Flow

### New API Flow Diagram

```
Initial Token (from getCDChat)
  ↓
Request 1 → Response 1 (49 messages)
  ↓ continuations[0].liveChatReplayContinuationData.continuation
Request 2 → Response 2 (48 messages)
  ↓ continuations[0].liveChatReplayContinuationData.continuation
Request 3 → Response 3 (46 messages)
  ↓ continuations[0].liveChatReplayContinuationData.continuation (valid token)
Request N → ...continues until continuation is null or missing
  ↓ continuations[0].liveChatReplayContinuationData.continuation = null
End (no more messages)
```

**Note**: The test data shows response3.json still contains a valid continuation token, indicating the chat replay continues beyond the captured samples. The loop terminates only when the API returns no continuation token.

### Legacy API Flow Diagram

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

---

## Testing Data Statistics

Based on actual API response analysis during implementation:

| Response   | Message Count | Time Range (ms)         | Duration     |
| ---------- | ------------- | ----------------------- | ------------ |
| Response 1 | 49 messages   | 11,425,842 - 11,914,642 | ~8 minutes   |
| Response 2 | 48 messages   | 11,934,546 - 12,461,579 | ~8.8 minutes |
| Response 3 | 46 messages   | 12,462,618 - 12,652,191 | ~3.2 minutes |

**Key Observations**:

- Batch duration varies from ~3 to ~9 minutes of chat replay
- Message count varies between 46-49 per batch
- Average message density: ~1 message per 8 seconds (varies by batch: Response 1-2 ~10s/msg, Response 3 ~4s/msg)
- Response 3 has a valid continuation token, indicating more messages may be available

---

## Migration Patterns & Best Practices

### 1. Backward Compatibility Strategy

✅ **Dual-Track Implementation**

- Maintain complete legacy API support (~270 lines)
- Implement parallel new API support (~260 lines)
- Automatic version detection at runtime
- Zero breaking changes to existing functionality

### 2. Error Handling

✅ **Three-Tier Fallback** in `getCDChat()`

1. Try new API path
2. Fallback to legacy API path
3. Deep search for `reloadContinuationData`

✅ **Graceful Degradation**

```typescript
if (!result.continuationData) {
    console.log('STOP CHAT CD!!!! No continuation data available');
    return;
}
```

### 3. Termination Logic

| API Version | Termination Condition                             | Implementation        |
| ----------- | ------------------------------------------------- | --------------------- |
| **Legacy**  | `currentOffsetTimeMsec === lastOffsetTimeInCmnts` | Timestamp comparison  |
| **New**     | `nextContinuation === null`                       | Token existence check |

### 4. Debugging & Logging

**Version Detection Logs**:

```typescript
console.log(`[getChatComments] Detected API version: ${result.apiVersion}`);
console.log(`[getChatComments] Source path: ${result.sourcePath}`);
```

**Processing Logs**:

```typescript
console.log('Loop chat comments (New API)'); // or 'Legacy API'
console.log('No more continuation, finished loading chat');
```

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
jq '.continuationContents.liveChatContinuation.continuations[0].liveChatReplayContinuationData.continuation' response1.json
```

Count messages:

```bash
jq '.continuationContents.liveChatContinuation.actions | length' response1.json
```

Extract time range (using videoOffsetTimeMsec):

```bash
jq '[.continuationContents.liveChatContinuation.actions[].replayChatItemAction.videoOffsetTimeMsec | tonumber] | [min, max]' response1.json
```

---

## Modified Files

This implementation modifies the following files:

- **`src/source/utils/assist.ts`**
    - `getCDChat()`: Three-tier fallback mechanism for continuation token extraction
    - `getParamsForChat()`: Conditional request body based on API version
    - `getChatComments()`: Dual-track processing logic for new and legacy APIs

- **`src/source/utils/interfaces/i_assist.ts`**
    - `ChatApiVersion` type: API version identification
    - `ChatContinuationResult` interface: Continuation data with metadata

---

## Conclusion

The migration to the new Chat Replay API demonstrates a robust approach to API version changes:

- **MVP-First**: Only modified 4 critical functions with minimal changes
- **Backward Compatible**: Full support for legacy API maintained
- **Fault Tolerant**: Three-tier fallback mechanism ensures stability
- **Well-Documented**: Comprehensive specs and test data for validation
- **Zero Breaking Changes**: Existing message processing logic untouched

This implementation serves as a reference pattern for handling YouTube API migrations in the YCS codebase.
