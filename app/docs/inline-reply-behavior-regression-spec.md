# Inline Reply Behavior Specification (Regression Baseline)

---

## 1. Purpose

Define observable behavior for the inline reply feature as a regression baseline for code review.
If implementation deviates from this spec without an explicit requirement change, it should be flagged as a regression issue.

---

## 2. Scope and Components

### 2.1 Component Definitions

- `ReplyButton`: `.ycs-reply-btn` — rendered per comment when `createReplyParams` is present
- `ReplyForm`: `.ycs-reply-form` — inline form containing textarea, action buttons, and status area
- `ReplyTextarea`: `.ycs-reply-textarea`
- `CancelButton`: `.ycs-reply-cancel`
- `SendButton`: `.ycs-reply-send`
- `StatusArea`: `.ycs-reply-status`
- `SyntheticReply`: `.ycs-synthetic-reply` — DOM-only preview inserted after successful send
- `SyntheticRepliesWrap`: `.ycs-synthetic-replies-wrap` — container for synthetic reply elements

### 2.2 State Symbols

- `P`: `createReplyParams` token (present only in authenticated responses)
- `T`: `ReplyTextarea.value.trim()`
- `S`: form sending state (`form.dataset.sending`)
- `C`: countdown active flag (rate limit timer running)
- `R`: rate limit interval (30 seconds, `RATE_LIMIT_INTERVAL_MS`)

---

## 3. Preconditions (MUST)

1. `enableInlineReply` must be `true` in extension settings.
2. When `enableInlineReply` is `true`, `shouldDisableAuth()` always returns `false`, forcing authenticated comment loading regardless of member-only or age-restricted status.
3. `createReplyParams` is only present in authenticated Innertube responses. Logged-out mode returns a sign-in modal instead — no reply button is rendered.
4. Not compatible with YouTube Data API mode. Data API responses do not contain `createReplyParams`.

---

## 4. Reply Button Visibility Rules (MUST)

1. `ReplyButton` is rendered per comment element only when the comment's `createReplyParams` is non-empty. The rendering path does not check `enableInlineReply` directly — visibility is determined solely by presence of the token.
2. `ReplyButton` carries `data-create-reply-params` attribute. `data-comment-id` is set conditionally when the comment has a `commentId`.
3. When `enableInlineReply` is `false`, auth may be disabled for normal videos, so `createReplyParams` is absent from responses and no button renders. Exception: member-only or age-restricted videos always send auth regardless of `enableInlineReply`, so `createReplyParams` may be present and the button may render even with the setting off.

---

## 5. Reply Form Toggle Behavior (MUST)

### 5.1 Open Form (click `ReplyButton`, no existing form)

1. Create `ReplyForm` inside the comment's `.ycs-comment-block`.
2. `SendButton` starts as `disabled`.
3. `ReplyTextarea` receives focus.

### 5.2 Close Form (click `ReplyButton`, form already exists)

1. If `S === 'true'` (sending in progress): **do nothing**, ignore click.
2. If `S !== 'true'`: remove the form immediately.

### 5.3 Cancel Button

1. Remove the form immediately, regardless of state.

---

## 6. Send Button State Rules (MUST)

1. `SendButton` is `disabled` when `T` is empty.
2. `SendButton` is `disabled` during sending (`S === 'true'`).
3. `SendButton` is `disabled` during active countdown (`C === true`), regardless of `T`.
4. `SendButton` is enabled only when `T` is non-empty AND `S !== 'true'` AND `C === false`.
5. `ReplyTextarea` `input` events update `SendButton` disabled state (unless countdown is active).

---

## 7. Rate Limiting Rules (MUST)

### 7.1 Client-Side Rate Limit

1. Global cooldown of 30 seconds (`RATE_LIMIT_INTERVAL_MS = 30_000`).
2. `lastReplyTimestamp` is set at **attempt time** (when send is clicked), not on success.
3. `canSendReply()` checks elapsed time since last attempt.

### 7.2 Countdown Timer Behavior

1. When rate limited, `StatusArea` shows `Please wait Ns` with class `ycs-reply-countdown`.
2. Countdown decrements every 1 second.
3. During countdown: `SendButton` is disabled, `ReplyTextarea` and `CancelButton` are re-enabled.
4. `form.dataset.sending` is cleared (form is not in sending state during countdown).
5. When countdown reaches 0: status is cleared, `C` resets to `false`, `SendButton` follows normal `T`-based enable logic.

### 7.3 Countdown Cleanup

1. A `MutationObserver` watches the form's parent for `childList` changes.
2. If the form is removed from the DOM during countdown, the interval is cleared and observer is disconnected.

### 7.4 Server-Side Rate Limit (HTTP 429)

1. Returns `rateLimited: true` with error message.
2. Displayed as error status; does not trigger client countdown.

---

## 8. Sending State Machine (MUST)

### 8.1 Sending Phase

1. All controls disabled (`SendButton`, `ReplyTextarea`, `CancelButton`).
2. `form.dataset.sending = 'true'`.
3. `StatusArea` shows "Sending..." with class `ycs-reply-sending`.

### 8.2 Success

1. Synthetic reply element is inserted (see Section 9).
2. `ycs-reply-success` CustomEvent is dispatched on `document` with raw `responseData` (see Section 14).
3. `StatusArea` shows "Reply sent!" with class `ycs-reply-success`.
4. `ReplyTextarea` is cleared, `SendButton` disabled.
5. Form auto-removes after 1500ms.

### 8.3 Error (non-rate-limit)

1. `StatusArea` shows error message with class `ycs-reply-error`.
2. Special case: if error contains "expired", display "Token expired — please reload comments and retry".
3. `ReplyTextarea` and `CancelButton` are re-enabled.
4. `SendButton` follows normal `T`-based enable logic.

### 8.4 Unexpected Error (catch)

1. Same recovery as 8.3; status shows "Unexpected error".

### 8.5 Finally

1. `form.dataset.sending` is always cleared in `finally` block.

---

## 9. Synthetic Reply Lifecycle (MUST)

### 9.1 Insertion

1. On successful reply, a `SyntheticReply` element is created with:
   - User avatar from `#avatar-btn img`
   - Author text: "You"
   - Timestamp text: "Just now"
   - Reply text as plain text (not HTML)
2. Insertion target priority:
   1. Existing real replies container (`.ycs-com-replies-{safeId}`)
   2. Existing `.ycs-synthetic-replies-wrap`
   3. New `.ycs-synthetic-replies-wrap` appended to `commentContainer`

### 9.2 Cleanup

1. When `handleOpenReply` loads real replies for a comment, any existing `.ycs-synthetic-replies-wrap` is removed first.
2. When comments are reloaded (new search or data fetch), the entire rendered area is replaced, removing all synthetic elements.

---

## 10. API and Auth Rules (MUST)

1. Reply endpoint: `POST /youtubei/v1/comment/create_comment_reply`.
2. Auth is always enabled (`disableAuth: false`). Never apply `shouldDisableAuth()` to write endpoints.
3. `credentials: 'include'` and `mode: 'cors'` are required.
4. Success is determined by `actionResult.status === 'STATUS_SUCCEEDED'` in response body. On success, full response JSON is returned as `responseData` in `ReplyResult` for state injection (Section 14).

### 10.1 Error Status Handling

| HTTP Status | Error Message | `rateLimited` |
|---|---|---|
| 401, 403 | Authentication failed. Please sign in to YouTube. | omitted |
| 429 | Rate limited by YouTube. Please wait. | `true` |
| 400 | Reply params expired. Please reload comments. | omitted |
| Other | Request failed ({status}) | omitted |
| AbortError | Request cancelled | omitted |
| Network error | Network error | omitted |

---

## 11. Token Extraction Rules (MUST)

### 11.1 FW Pipeline Path (primary)

1. `getFrameworkUpdatesById()` indexes `engagementToolbarSurfaceEntityPayload` by its `key`.
2. `generateCommentObjectFromFW` extracts `createReplyParams` from `toolbarSurfaceUpdate.replyCommand.innertubeCommand.createCommentReplyDialogEndpoint.dialog.commentReplyDialogRenderer.replyButton.buttonRenderer.serviceEndpoint.createCommentReplyEndpoint.createReplyParams`.
3. All 3 call sites of `generateCommentObjectFromFW` (parent comments, reply ViewModels, sub-threads) must pass `toolbarSurfaceUpdate`.

### 11.2 Legacy Path (fallback)

1. `prepareFieldsComment()` extracts `createReplyParams` from `actionButtons.commentActionButtonsRenderer.replyButton.buttonRenderer.navigationEndpoint.createCommentReplyDialogEndpoint.dialog.commentReplyDialogRenderer.replyButton.buttonRenderer.serviceEndpoint.createCommentReplyEndpoint.createReplyParams`.
2. This path handles responses that use the classic comment renderer format rather than FW mutations.

---

## 12. Regression Criteria

If any of the following occurs, mark it as a regression:

1. Reply form opens or sends when `enableInlineReply` is `false`.
2. `ReplyButton` is rendered for a comment without `createReplyParams`.
3. `SendButton` becomes enabled while `T` is empty or during countdown.
4. Reply is sent without `disableAuth: false`.
5. `shouldDisableAuth()` returns `true` when `enableInlineReply` is `true`.
6. Clicking `ReplyButton` during active sending (`S === 'true'`) removes or modifies the form.
7. Countdown timer continues running after form is removed from DOM.
8. Synthetic reply is inserted on failed send.
9. `handleOpenReply` does not clean up `.ycs-synthetic-replies-wrap` before loading real replies.
10. `lastReplyTimestamp` is set on success instead of attempt time.
11. Rate limit interval deviates from 30 seconds without explicit requirement change.
12. Any `generateCommentObjectFromFW` call site does not pass `toolbarSurfaceUpdate`.
13. Reply success does not dispatch `ycs-reply-success` event when `responseData` is present.
14. State injection silently drops the new reply without updating `state.comments`.
15. Thread root `replyCount` is not incremented when replying to a nested comment (`replyToCommentId !== parentCommentId`).
16. Duplicate reply is injected into state (same `commentId` already exists in `state.comments`).

---

## 13. Confirmed Design Decisions (Fixed Behavior)

The following behaviors are explicitly confirmed as fixed rules and must not change without product requirement updates:

1. Inline reply is opt-in only. Default is `false`.
2. Enabling inline reply forces authenticated comment loading for all videos, overriding the normal member-only/age-restricted conditional auth logic.
3. Rate limit cooldown starts at attempt time, not success time. Failed attempts still consume the cooldown window.
4. Synthetic replies are DOM-only visual feedback for immediate display. Real reply data is injected into state and cache via event pipeline (Section 14) and is searchable after the next search execution.
5. The reply form is a toggle: clicking `ReplyButton` again closes the form (unless sending is in progress).
6. The feature is not compatible with YouTube Data API mode. This is by design — Data API responses lack `createReplyParams` tokens.

---

## 14. Reply State Injection (MUST)

### 14.1 Event Flow

1. On successful reply, `commentInteractions.ts` dispatches `CustomEvent('ycs-reply-success')` on `document` with `detail.responseData` containing the full API response JSON.
2. Event is dispatched **after** synthetic DOM insertion (Section 9.1), not before.
3. `appController.ts` listens for `ycs-reply-success` and processes the response.

### 14.2 Response Processing

1. `createCommentReplyAction` is extracted from `responseData.actions` to obtain `parentCommentId` (thread root) and `replyToCommentId` (direct parent).
2. `originComment` is found in `state.comments` by scanning for `commentRenderer.commentId` matching `replyToCommentId` first, then `parentCommentId` as fallback.
3. `buildReplyCommentFromResponse()` in `pipeline.ts` converts the response via existing FW pipeline: `getFrameworkUpdatesById` → `generateCommentObjectFromFW` → `enrichCommentRenderer`.
4. The `commentViewModel` entity keys from the response's `createCommentReplyAction.contents` are used to look up the correct FW mutations.
5. `replyLevel` is extracted from FW data; fallback is `(originComment.replyLevel ?? 0) + 1`.

### 14.3 State Update Rules

1. Dedup guard: if a comment with the same `commentId` already exists in `state.comments`, injection is skipped.
2. New reply is appended to `state.comments` with `_index = comments.length`.
3. `originComment.commentRenderer.replyCount` is incremented by 1 (direct parent).
4. If `replyToCommentId !== parentCommentId`, the thread root's `commentRenderer.replyCount` is also incremented by 1.
5. `replyCount` coercion uses `Number()` to handle both `number` and `string` types.
6. `state.count.comments` is updated via `setCount`.
7. Badge is updated via `updateBadge`.

### 14.4 Cache Persistence

1. After state update, `saveToCache()` is called with the updated `state.comments`.
2. `saveToCache` internally calls `stripReplyTokens` which recursively strips `createReplyParams` from the entire `originComment` chain via `stripOriginChain`. The in-memory state retains tokens for chain replying.

### 14.5 Failure Handling

1. If `responseData` is absent, `createCommentReplyAction` is not found, `originComment` is not in state, or `buildReplyCommentFromResponse` returns `undefined` — injection is silently skipped. The synthetic DOM preview remains as visual feedback.
2. All processing is wrapped in try-catch; errors are logged to console.
