import { strict as assert } from 'node:assert';
import test from 'node:test';

import { fetchCommentThreadsSearch, YouTubeDataApiError } from '../src/source/utils/youtubeDataApi/client';
import { fetchCommentSearchPage } from '../src/source/utils/youtubeDataApi/search';

function createMockThread(id: string, textDisplay: string, replyCount = 0) {
    const thread: Record<string, unknown> = {
        id,
        snippet: {
            topLevelComment: {
                id: `comment-${id}`,
                snippet: {
                    textOriginal: textDisplay,
                    textDisplay: textDisplay,
                    authorDisplayName: 'Test User',
                    authorProfileImageUrl: 'https://example.com/avatar.jpg',
                    authorChannelUrl: 'https://www.youtube.com/channel/UC123',
                    likeCount: 0,
                    publishedAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                }
            },
            totalReplyCount: replyCount
        }
    };

    if (replyCount > 0) {
        thread.replies = {
            comments: [
                {
                    id: `reply-${id}`,
                    snippet: {
                        textOriginal: `reply to ${textDisplay}`,
                        textDisplay: `reply to ${textDisplay}`,
                        authorDisplayName: 'Reply User',
                        authorProfileImageUrl: 'https://example.com/avatar2.jpg',
                        authorChannelUrl: 'https://www.youtube.com/channel/UC456',
                        likeCount: 0,
                        publishedAt: '2024-01-02T00:00:00Z',
                        updatedAt: '2024-01-02T00:00:00Z'
                    }
                }
            ]
        };
    }

    return thread;
}

test('fetchCommentThreadsSearch: builds correct URL params including searchTerms and pageToken', async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = '';

    globalThis.fetch = async (input) => {
        capturedUrl = String(input);
        return {
            ok: true,
            json: async () => ({ items: [] })
        } as Response;
    };

    try {
        await fetchCommentThreadsSearch({
            videoId: 'video123',
            searchTerms: 'hello world',
            apiKey: 'test-key',
            pageToken: 'next-page-token'
        });

        const url = new URL(capturedUrl);
        assert.equal(url.pathname, '/youtube/v3/commentThreads');
        assert.equal(url.searchParams.get('part'), 'snippet,replies');
        assert.equal(url.searchParams.get('videoId'), 'video123');
        assert.equal(url.searchParams.get('searchTerms'), 'hello world');
        assert.equal(url.searchParams.get('maxResults'), '100');
        assert.equal(url.searchParams.get('textFormat'), 'html');
        assert.equal(url.searchParams.get('key'), 'test-key');
        assert.equal(url.searchParams.get('pageToken'), 'next-page-token');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('fetchCommentThreadsSearch: quota 403 throws YouTubeDataApiError with isQuotaExceeded true', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () =>
        ({
            ok: false,
            json: async () => ({
                error: {
                    code: 403,
                    message: 'The request cannot be completed because you have exceeded your quota.',
                    errors: [{ reason: 'quotaExceeded', message: 'Quota exceeded' }]
                }
            })
        }) as Response;

    try {
        await assert.rejects(
            () =>
                fetchCommentThreadsSearch({
                    videoId: 'video123',
                    searchTerms: 'test',
                    apiKey: 'test-key'
                }),
            (error: unknown) => {
                assert.ok(error instanceof YouTubeDataApiError);
                assert.equal(error.isQuotaExceeded, true);
                return true;
            }
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('fetchCommentSearchPage: transforms 2-thread response and passes through pagination metadata', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () =>
        ({
            ok: true,
            json: async () => ({
                items: [createMockThread('thread1', 'first comment'), createMockThread('thread2', 'second comment', 1)],
                nextPageToken: 'page2',
                pageInfo: { totalResults: 42 }
            })
        }) as Response;

    try {
        const result = await fetchCommentSearchPage({
            videoId: 'video123',
            searchTerms: 'comment',
            apiKey: 'test-key'
        });

        assert.equal(result.items.length, 3);
        assert.equal(result.items[0].typeComment, 'C');
        assert.equal(result.items[1].typeComment, 'C');
        assert.equal(result.items[2].typeComment, 'R');
        assert.equal(result.items[2].originComment, result.items[1]);
        assert.equal(result.nextPageToken, 'page2');
        assert.equal(result.totalResults, 42);
        for (const item of result.items) {
            assert.equal(item._index, undefined);
        }
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('fetchCommentSearchPage: transform sets publishedAtMs from a parseable snippet.publishedAt', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () =>
        ({
            ok: true,
            json: async () => ({
                items: [createMockThread('thread1', 'first comment')]
            })
        }) as Response;

    try {
        const result = await fetchCommentSearchPage({
            videoId: 'video123',
            searchTerms: 'comment',
            apiKey: 'test-key'
        });

        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].commentRenderer.publishedAtMs, Date.parse('2024-01-01T00:00:00Z'));
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('fetchCommentSearchPage: transform omits publishedAtMs when snippet.publishedAt is unparseable', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () =>
        ({
            ok: true,
            json: async () => ({
                items: [
                    {
                        id: 'thread-bad-date',
                        snippet: {
                            topLevelComment: {
                                id: 'comment-bad-date',
                                snippet: {
                                    textOriginal: 'no date',
                                    textDisplay: 'no date',
                                    authorDisplayName: 'Test User',
                                    authorProfileImageUrl: 'https://example.com/avatar.jpg',
                                    authorChannelUrl: 'https://www.youtube.com/channel/UC123',
                                    likeCount: 0,
                                    publishedAt: 'not-a-real-date',
                                    updatedAt: 'not-a-real-date'
                                }
                            },
                            totalReplyCount: 0
                        }
                    }
                ]
            })
        }) as Response;

    try {
        const result = await fetchCommentSearchPage({
            videoId: 'video123',
            searchTerms: 'comment',
            apiKey: 'test-key'
        });

        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].commentRenderer.publishedAtMs, undefined);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('fetchCommentSearchPage: final page (no nextPageToken) leaves pageToken undefined', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () =>
        ({
            ok: true,
            json: async () => ({
                items: [createMockThread('thread1', 'only comment')]
                // No nextPageToken: this is the final page.
            })
        }) as Response;

    try {
        const result = await fetchCommentSearchPage({
            videoId: 'video123',
            searchTerms: 'comment',
            apiKey: 'test-key'
        });

        assert.equal(result.nextPageToken, undefined);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
