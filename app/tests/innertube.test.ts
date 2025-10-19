import assert from 'node:assert';
import test from 'node:test';

import { applyFrameworkUpdatesToComment, generateCommentObjectFromFW } from '../src/source/utils/innertube';

/**
 * Helper: Create minimal frameworkUpdate payload for testing
 */
const createMockFrameworkUpdate = (options: {
    commentId: string;
    sponsorBadgeUrl?: string;
    sponsorBadgeA11y?: string;
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
    }
});

/**
 * Helper: Create fwById lookup object
 */
const createFwById = (commentId: string, update: any) => ({
    [commentId]: update
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
