import assert from 'node:assert';
import test from 'node:test';

import { applyFrameworkUpdatesToComment, generateCommentObjectFromFW } from '../src/source/utils/innertube';
import { extractJsonObjectFromHtml } from '../src/source/utils/innertube/core';

/**
 * Helper: Create minimal frameworkUpdate payload for testing
 */
const createMockFrameworkUpdate = (options: {
    commentId: string;
    sponsorBadgeUrl?: string;
    sponsorBadgeA11y?: string;
    heartActiveTooltip?: string;
}) => ({
    properties: {
        commentId: options.commentId,
        content: { content: 'Test comment content' }
    },
    author: {
        displayName: 'Test User',
        channelId: 'UCTestChannel123',
        ...(options.sponsorBadgeUrl && { sponsorBadgeUrl: options.sponsorBadgeUrl }),
        ...(options.sponsorBadgeA11y && { sponsorBadgeA11y: options.sponsorBadgeA11y })
    },
    toolbar: {
        ...(options.heartActiveTooltip && { heartActiveTooltip: options.heartActiveTooltip })
    }
});

/**
 * Helper: Create fwById lookup object
 */
const createFwById = (commentId: string, update: any) => ({
    [commentId]: update
});

/**
 * Helper: Create toolbar state for testing heart functionality
 */
const createMockToolbarState = (options: {
    heartState: 'TOOLBAR_HEART_STATE_HEARTED' | 'TOOLBAR_HEART_STATE_UNHEARTED';
    heartActiveTooltip?: string;
}) => ({
    heartState: options.heartState,
    likeState: 'TOOLBAR_LIKE_STATE_INDIFFERENT',
    ...(options.heartActiveTooltip && { toolbar: { heartActiveTooltip: options.heartActiveTooltip } })
});

test('applyFrameworkUpdatesToComment extracts sponsorBadgeA11y to tooltip', () => {
    // Setup: Create mock data with member badge
    const commentId = 'test-member-comment';
    const mockUpdate = createMockFrameworkUpdate({
        commentId,
        sponsorBadgeUrl: 'https://example.com/member-badge.png',
        sponsorBadgeA11y: '會員 (1 年 8 個月)'
    });

    const fwById = createFwById(commentId, mockUpdate);

    const commentObj: any = {
        commentRenderer: {
            commentId
        }
    };

    const vmSource = {
        commentViewModel: {
            commentId
        }
    };

    // Execute: Apply frameworkUpdates
    applyFrameworkUpdatesToComment(commentObj, vmSource, fwById);

    // Assert: Verify sponsorCommentBadge structure
    assert.ok(commentObj.commentRenderer?.sponsorCommentBadge, 'Expected sponsorCommentBadge to be created');

    const badge = commentObj.commentRenderer.sponsorCommentBadge.sponsorCommentBadgeRenderer;

    // Verify customBadge with URL
    assert.ok(badge?.customBadge?.thumbnails?.[0]?.url, 'Expected badge URL to be set');
    assert.equal(
        badge.customBadge.thumbnails[0].url,
        'https://example.com/member-badge.png',
        'Expected badge URL to match mock data'
    );

    // Verify tooltip is extracted from sponsorBadgeA11y
    assert.ok(badge?.tooltip, 'Expected tooltip to be set');
    assert.equal(badge.tooltip, '會員 (1 年 8 個月)', 'Expected tooltip to match sponsorBadgeA11y from mock data');
});

test('applyFrameworkUpdatesToComment handles comments without member badge', () => {
    // Setup: Create mock data for non-member comment
    const commentId = 'test-non-member-comment';
    const mockUpdate = createMockFrameworkUpdate({
        commentId
        // No sponsorBadgeUrl or sponsorBadgeA11y
    });

    const fwById = createFwById(commentId, mockUpdate);

    const commentObj: any = {
        commentRenderer: {
            commentId
        }
    };

    const vmSource = {
        commentViewModel: {
            commentId
        }
    };

    // Execute: Apply frameworkUpdates
    applyFrameworkUpdatesToComment(commentObj, vmSource, fwById);

    // Assert: Verify sponsorCommentBadge is not created
    assert.equal(
        commentObj.commentRenderer?.sponsorCommentBadge,
        undefined,
        'Expected sponsorCommentBadge to not be created for non-member'
    );
});

test('applyFrameworkUpdatesToComment preserves existing tooltip when A11y missing', () => {
    // Setup: Create comment object with existing tooltip
    const commentId = 'test-preserve-tooltip';
    const existingTooltip = '會員 (6 個月)';

    const commentObj: any = {
        commentRenderer: {
            commentId,
            sponsorCommentBadge: {
                sponsorCommentBadgeRenderer: {
                    customBadge: { thumbnails: [{ url: 'https://old-badge.png' }] },
                    tooltip: existingTooltip
                }
            }
        }
    };

    // Create mock update with URL but NO A11y
    const mockUpdate = createMockFrameworkUpdate({
        commentId,
        sponsorBadgeUrl: 'https://new-badge.png'
        // Note: No sponsorBadgeA11y provided
    });

    const fwById = createFwById(commentId, mockUpdate);

    const vmSource = {
        commentViewModel: {
            commentId
        }
    };

    // Execute: Apply frameworkUpdates
    applyFrameworkUpdatesToComment(commentObj, vmSource, fwById);

    // Assert: Verify tooltip is preserved
    const badge = commentObj.commentRenderer.sponsorCommentBadge.sponsorCommentBadgeRenderer;

    assert.ok(badge?.tooltip, 'Expected tooltip to exist');
    assert.equal(
        badge.tooltip,
        existingTooltip,
        'Expected existing tooltip to be preserved when frameworkUpdates lacks sponsorBadgeA11y'
    );

    // Verify URL is updated
    assert.equal(badge.customBadge.thumbnails[0].url, 'https://new-badge.png', 'Expected badge URL to be updated');
});

test('generateCommentObjectFromFW extracts sponsorBadgeA11y to tooltip', () => {
    // Setup: Create mock data with member badge
    const commentId = 'test-generate-member';
    const mockUpdate = createMockFrameworkUpdate({
        commentId,
        sponsorBadgeUrl: 'https://example.com/generated-badge.png',
        sponsorBadgeA11y: '會員 (2 年 3 個月)'
    });

    // Execute: Generate comment object from frameworkUpdates
    const comment = generateCommentObjectFromFW({
        update: mockUpdate,
        commentId
    });

    // Assert: Verify sponsorCommentBadge structure
    assert.ok(comment?.commentRenderer?.sponsorCommentBadge, 'Expected sponsorCommentBadge to be created');

    const badge = comment.commentRenderer.sponsorCommentBadge.sponsorCommentBadgeRenderer;

    // Verify customBadge with URL
    assert.ok(badge?.customBadge?.thumbnails?.[0]?.url, 'Expected badge URL to be set');
    assert.equal(
        badge.customBadge.thumbnails[0].url,
        'https://example.com/generated-badge.png',
        'Expected badge URL to match mock data'
    );

    // Verify tooltip is extracted from sponsorBadgeA11y
    assert.ok(badge?.tooltip, 'Expected tooltip to be set');
    assert.equal(badge.tooltip, '會員 (2 年 3 個月)', 'Expected tooltip to match sponsorBadgeA11y from mock data');
});

test('applyFrameworkUpdatesToComment extracts heartActiveTooltip to creatorHeart.tooltip', () => {
    // Setup: Create mock data with heart
    const commentId = 'test-hearted-comment';
    const toolbarStateKey = 'test-toolbar-state-key';

    const mockUpdate = createMockFrameworkUpdate({
        commentId,
        heartActiveTooltip: '@yuzu_zuyuzu給了 ❤'
    });

    const mockToolbarState = createMockToolbarState({
        heartState: 'TOOLBAR_HEART_STATE_HEARTED'
    });

    const fwById = {
        [commentId]: mockUpdate,
        [toolbarStateKey]: mockToolbarState
    };

    const commentObj: any = {
        commentRenderer: {
            commentId
        }
    };

    const vmSource = {
        commentViewModel: {
            commentId,
            toolbarStateKey
        }
    };

    // Execute: Apply frameworkUpdates
    applyFrameworkUpdatesToComment(commentObj, vmSource, fwById);

    // Assert: Verify creatorHeart structure
    assert.ok(commentObj.commentRenderer?.creatorHeart, 'Expected creatorHeart to be created');
    assert.ok(commentObj.commentRenderer.creatorHeart?.tooltip, 'Expected creatorHeart.tooltip to be set');
    assert.equal(
        commentObj.commentRenderer.creatorHeart.tooltip,
        '@yuzu_zuyuzu給了 ❤',
        'Expected tooltip to match heartActiveTooltip from mock data'
    );
});

test('applyFrameworkUpdatesToComment uses fallback when heartActiveTooltip missing', () => {
    // Setup: Create mock data with heartState but no heartActiveTooltip
    const commentId = 'test-hearted-no-tooltip';
    const toolbarStateKey = 'test-toolbar-state-key-2';

    const mockUpdate = createMockFrameworkUpdate({
        commentId
        // Note: No heartActiveTooltip provided
    });

    const mockToolbarState = createMockToolbarState({
        heartState: 'TOOLBAR_HEART_STATE_HEARTED'
    });

    const fwById = {
        [commentId]: mockUpdate,
        [toolbarStateKey]: mockToolbarState
    };

    const commentObj: any = {
        commentRenderer: {
            commentId
        }
    };

    const vmSource = {
        commentViewModel: {
            commentId,
            toolbarStateKey
        }
    };

    // Execute: Apply frameworkUpdates
    applyFrameworkUpdatesToComment(commentObj, vmSource, fwById);

    // Assert: Verify creatorHeart uses fallback value
    assert.ok(commentObj.commentRenderer?.creatorHeart, 'Expected creatorHeart to be created');
    assert.equal(
        commentObj.commentRenderer.creatorHeart.tooltip,
        'hearted',
        'Expected tooltip to use fallback value "hearted"'
    );
});

test('applyFrameworkUpdatesToComment creates creatorHeart when only toolbar update present', () => {
    const commentId = 'test-hearted-toolbar-only';
    const toolbarStateKey = 'test-toolbar-state-key-4';

    const mockToolbarState = createMockToolbarState({
        heartState: 'TOOLBAR_HEART_STATE_HEARTED'
    });

    const fwById = {
        [toolbarStateKey]: mockToolbarState
    };

    const commentObj: any = {
        commentRenderer: {
            commentId
        }
    };

    const vmSource = {
        commentViewModel: {
            commentId,
            toolbarStateKey
        }
    };

    applyFrameworkUpdatesToComment(commentObj, vmSource, fwById);

    assert.ok(commentObj.commentRenderer?.creatorHeart, 'Expected creatorHeart to be created');
    assert.equal(
        commentObj.commentRenderer.creatorHeart.tooltip,
        'hearted',
        'Expected tooltip to fall back to default when no tooltip provided'
    );
});

test('applyFrameworkUpdatesToComment creates creatorHeart when commentId missing but toolbar hearted', () => {
    const toolbarStateKey = 'test-toolbar-state-key-missing-comment-id';

    const mockToolbarState = createMockToolbarState({
        heartState: 'TOOLBAR_HEART_STATE_HEARTED',
        heartActiveTooltip: 'Autor hat ❤ vergeben'
    });

    const fwById = {
        [toolbarStateKey]: mockToolbarState
    };

    const commentObj: any = {
        commentRenderer: {}
    };

    const vmSource = {
        commentViewModel: {
            toolbarStateKey
        }
    };

    applyFrameworkUpdatesToComment(commentObj, vmSource, fwById);

    assert.ok(commentObj.commentRenderer?.creatorHeart, 'Expected creatorHeart to be created');
    assert.equal(
        commentObj.commentRenderer.creatorHeart.tooltip,
        'Autor hat ❤ vergeben',
        'Expected tooltip to use toolbar heartActiveTooltip when commentId missing'
    );
});

test('applyFrameworkUpdatesToComment does not create creatorHeart when not hearted', () => {
    // Setup: Create mock data with UNHEARTED state
    const commentId = 'test-unhearted-comment';
    const toolbarStateKey = 'test-toolbar-state-key-3';

    const mockUpdate = createMockFrameworkUpdate({
        commentId,
        heartActiveTooltip: '@author gave ❤'
    });

    const mockToolbarState = createMockToolbarState({
        heartState: 'TOOLBAR_HEART_STATE_UNHEARTED'
    });

    const fwById = {
        [commentId]: mockUpdate,
        [toolbarStateKey]: mockToolbarState
    };

    const commentObj: any = {
        commentRenderer: {
            commentId
        }
    };

    const vmSource = {
        commentViewModel: {
            commentId,
            toolbarStateKey
        }
    };

    // Execute: Apply frameworkUpdates
    applyFrameworkUpdatesToComment(commentObj, vmSource, fwById);

    // Assert: Verify creatorHeart is not created
    assert.equal(
        commentObj.commentRenderer?.creatorHeart,
        undefined,
        'Expected creatorHeart to not be created when not hearted'
    );
});

test('generateCommentObjectFromFW extracts heartActiveTooltip to creatorHeart.tooltip', () => {
    // Setup: Create mock data with heart
    const commentId = 'test-generate-heart';
    const toolbarStateKey = 'test-toolbar-state-key-4';

    const mockUpdate = createMockFrameworkUpdate({
        commentId,
        heartActiveTooltip: '@author gave ❤'
    });

    const mockToolbarState = createMockToolbarState({
        heartState: 'TOOLBAR_HEART_STATE_HEARTED'
    });

    const fwById = {
        [toolbarStateKey]: mockToolbarState
    };

    // Execute: Generate comment object from frameworkUpdates
    const comment = generateCommentObjectFromFW({
        update: mockUpdate,
        commentId,
        toolbarStateUpdate: mockToolbarState
    });

    // Assert: Verify creatorHeart structure
    assert.ok(comment?.commentRenderer?.creatorHeart, 'Expected creatorHeart to be created');
    assert.ok(comment.commentRenderer.creatorHeart?.tooltip, 'Expected creatorHeart.tooltip to be set');
    assert.equal(
        comment.commentRenderer.creatorHeart.tooltip,
        '@author gave ❤',
        'Expected tooltip to match heartActiveTooltip from mock data'
    );
});

test('generateCommentObjectFromFW does not create creatorHeart when not hearted', () => {
    // Setup: Create mock data with UNHEARTED state
    const commentId = 'test-generate-unhearted';
    const toolbarStateKey = 'test-toolbar-state-key-5';

    const mockUpdate = createMockFrameworkUpdate({
        commentId,
        heartActiveTooltip: '@author gave ❤'
    });

    const mockToolbarState = createMockToolbarState({
        heartState: 'TOOLBAR_HEART_STATE_UNHEARTED'
    });

    // Execute: Generate comment object from frameworkUpdates
    const comment = generateCommentObjectFromFW({
        update: mockUpdate,
        commentId,
        toolbarStateUpdate: mockToolbarState
    });

    // Assert: Verify creatorHeart is not created
    assert.equal(
        comment?.commentRenderer?.creatorHeart,
        undefined,
        'Expected creatorHeart to not be created when not hearted'
    );
});

// ============================================================================
// extractJsonObjectFromHtml Tests
// ============================================================================

test('extractJsonObjectFromHtml extracts simple object', () => {
    const html = 'var ytInitialData = {"foo": "bar"};';
    const result = extractJsonObjectFromHtml(html, 'var ytInitialData = ');

    assert.ok(result, 'Expected result to be defined');
    assert.deepEqual(result, { foo: 'bar' }, 'Expected extracted object to match');
});

test('extractJsonObjectFromHtml handles nested objects', () => {
    const html = 'var ytInitialData = {"a": {"b": {"c": 1}}};';
    const result = extractJsonObjectFromHtml(html, 'var ytInitialData = ');

    assert.ok(result, 'Expected result to be defined');
    assert.deepEqual(result, { a: { b: { c: 1 } } }, 'Expected nested object to be extracted correctly');
});

test('extractJsonObjectFromHtml handles strings containing braces', () => {
    const html = 'var ytInitialData = {"text": "Hello {world}"};';
    const result = extractJsonObjectFromHtml(html, 'var ytInitialData = ') as { text: string };

    assert.ok(result, 'Expected result to be defined');
    assert.equal(result.text, 'Hello {world}', 'Expected string with braces to be preserved');
});

test('extractJsonObjectFromHtml handles escaped quotes', () => {
    const html = 'var ytInitialData = {"text": "He said \\"hello\\""};';
    const result = extractJsonObjectFromHtml(html, 'var ytInitialData = ') as { text: string };

    assert.ok(result, 'Expected result to be defined');
    assert.equal(result.text, 'He said "hello"', 'Expected escaped quotes to be handled correctly');
});

test('extractJsonObjectFromHtml returns undefined when tag not found', () => {
    const html = '<html><body>No data here</body></html>';
    const result = extractJsonObjectFromHtml(html, 'var ytInitialData = ');

    assert.equal(result, undefined, 'Expected undefined when tag not found');
});

test('extractJsonObjectFromHtml extracts ytInitialPlayerResponse tag', () => {
    const html = 'var ytInitialPlayerResponse = {"videoDetails": {"videoId": "abc123"}};';
    const result = extractJsonObjectFromHtml(html, 'var ytInitialPlayerResponse = ') as {
        videoDetails: { videoId: string };
    };

    assert.ok(result, 'Expected result to be defined');
    assert.equal(result.videoDetails.videoId, 'abc123', 'Expected videoId to match');
});

test('extractJsonObjectFromHtml handles arrays in object', () => {
    const html = 'var ytInitialData = {"items": [1, 2, 3], "names": ["a", "b"]};';
    const result = extractJsonObjectFromHtml(html, 'var ytInitialData = ') as { items: number[]; names: string[] };

    assert.ok(result, 'Expected result to be defined');
    assert.deepEqual(result.items, [1, 2, 3], 'Expected array to be extracted correctly');
    assert.deepEqual(result.names, ['a', 'b'], 'Expected string array to be extracted correctly');
});

test('extractJsonObjectFromHtml handles complex real-world structure', () => {
    const html = `
        <script>var ytInitialPlayerResponse = {
            "microformat": {
                "playerMicroformatRenderer": {
                    "liveBroadcastDetails": {
                        "isLiveNow": true,
                        "startTimestamp": "2026-01-03T14:00:20+00:00"
                    }
                }
            }
        };</script>
    `;
    const result = extractJsonObjectFromHtml(html, 'var ytInitialPlayerResponse = ') as {
        microformat: {
            playerMicroformatRenderer: {
                liveBroadcastDetails: {
                    isLiveNow: boolean;
                    startTimestamp: string;
                };
            };
        };
    };

    assert.ok(result, 'Expected result to be defined');
    assert.equal(
        result.microformat.playerMicroformatRenderer.liveBroadcastDetails.startTimestamp,
        '2026-01-03T14:00:20+00:00',
        'Expected startTimestamp to match'
    );
    assert.equal(
        result.microformat.playerMicroformatRenderer.liveBroadcastDetails.isLiveNow,
        true,
        'Expected isLiveNow to be true'
    );
});

test('extractJsonObjectFromHtml returns undefined for malformed JSON', () => {
    const html = 'var ytInitialData = {invalid json here};';
    const result = extractJsonObjectFromHtml(html, 'var ytInitialData = ');

    assert.equal(result, undefined, 'Expected undefined for malformed JSON');
});
