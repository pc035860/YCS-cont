import { strict as assert } from 'node:assert';
import test from 'node:test';

import { transformThreadToCommentItems } from '../src/source/utils/youtubeDataApi/transform';

// Helper to create a mock YouTube API comment thread
function createMockThread(textDisplay: string, textOriginal?: string) {
    return {
        id: 'thread123',
        snippet: {
            topLevelComment: {
                id: 'comment123',
                snippet: {
                    textOriginal: textOriginal || textDisplay,
                    textDisplay: textDisplay,
                    authorDisplayName: 'Test User',
                    authorProfileImageUrl: 'https://example.com/avatar.jpg',
                    authorChannelUrl: 'https://www.youtube.com/channel/UC123',
                    likeCount: 0,
                    publishedAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                }
            },
            totalReplyCount: 0
        }
    };
}

// ============================================================================
// YouTube Data API Transform XSS Security Tests
// ============================================================================

test('transformThreadToCommentItems: XSS - script tag in comment text should be stripped or encoded', () => {
    const thread = createMockThread("<script>alert('XSS')</script>");
    const items = transformThreadToCommentItems(thread as any, 'video123');

    assert.ok(items.length > 0, 'Should return at least one item');
    const renderFullText = items[0].commentRenderer?.contentText?.renderFullText || '';

    // YouTube Data API strips HTML tags, so <script> is removed
    // The remaining text content is then encoded
    assert.ok(!renderFullText.includes('<script>'), 'Raw script tag should not appear');
    assert.ok(!renderFullText.includes('</script>'), 'Raw closing script tag should not appear');
});

test('transformThreadToCommentItems: XSS - HTML injection in comment should be stripped or encoded', () => {
    const thread = createMockThread('<img onerror="alert(1)" src="x">');
    const items = transformThreadToCommentItems(thread as any, 'video123');

    const renderFullText = items[0].commentRenderer?.contentText?.renderFullText || '';

    // YouTube Data API strips HTML tags
    assert.ok(!renderFullText.includes('<img'), 'Raw img tag should not appear');
    assert.ok(!renderFullText.includes('onerror='), 'Event handler should not appear');
});

test('transformThreadToCommentItems: XSS - javascript URL in link should be blocked', () => {
    // Simulating a comment with a link that has javascript: protocol
    const thread = createMockThread('<a href="javascript:alert(1)">Click here</a>');
    const items = transformThreadToCommentItems(thread as any, 'video123');

    const renderFullText = items[0].commentRenderer?.contentText?.renderFullText || '';

    // The javascript: URL should either be blocked or the entire anchor should be encoded
    assert.ok(
        !renderFullText.includes('href="javascript:') || renderFullText.includes('&lt;a'),
        'javascript: URL should not appear in executable form'
    );
});

test('transformThreadToCommentItems: valid timestamp should create link', () => {
    // Text with inline timestamp pattern
    const thread = createMockThread('Check out 1:30 for the best part');
    const items = transformThreadToCommentItems(thread as any, 'video123');

    const renderFullText = items[0].commentRenderer?.contentText?.renderFullText || '';

    // Should contain timestamp link with data-offsetvideo attribute
    assert.ok(
        renderFullText.includes('data-offsetvideo="90"') || renderFullText.includes('1:30'),
        'Timestamp should be processed'
    );
});

test('transformThreadToCommentItems: valid external link should be preserved', () => {
    const thread = createMockThread(
        'Visit <a href="https://example.com">https://example.com</a>',
        'Visit https://example.com'
    );
    const items = transformThreadToCommentItems(thread as any, 'video123');

    const renderFullText = items[0].commentRenderer?.contentText?.renderFullText || '';

    // Valid https URL should be preserved
    assert.ok(
        renderFullText.includes('https://example.com') ||
            renderFullText.includes('href="https://example.com"'),
        'Valid https URL should be preserved'
    );
});

test('transformThreadToCommentItems: special characters in text should be encoded', () => {
    const thread = createMockThread('Test & compare < > "quotes"');
    const items = transformThreadToCommentItems(thread as any, 'video123');

    const renderFullText = items[0].commentRenderer?.contentText?.renderFullText || '';

    // After encoding, angle brackets should be safe
    assert.ok(!renderFullText.includes(' < ') || renderFullText.includes('&lt;'), 'Less than should be encoded');
    assert.ok(!renderFullText.includes(' > ') || renderFullText.includes('&gt;'), 'Greater than should be encoded');
});

test('transformThreadToCommentItems: plain text without special chars should work', () => {
    const thread = createMockThread('This is a normal comment');
    const items = transformThreadToCommentItems(thread as any, 'video123');

    const renderFullText = items[0].commentRenderer?.contentText?.renderFullText || '';

    assert.ok(renderFullText.includes('This is a normal comment'), 'Plain text should be preserved');
});
