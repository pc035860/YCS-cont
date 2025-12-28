import assert from 'node:assert';
import test from 'node:test';
import objectScan from 'object-scan';
import {
    dedupeParentComments,
    processParentComment,
    scheduleReplyFetches,
    fetchContinuationBatch,
    fetchInitialCommentBatch,
    generateCommentObjectFromFW,
    prepareFieldsComment,
    extractSubThreads,
    type ReplyContinuation,
    type SubThreadContinuation
} from '../src/source/utils/innertube/comments/pipeline';
import { setFetchImplementation } from '../src/source/utils/libs';
import { GlobalStore } from '../src/source/utils/common';

const createStubQueue = () => {
    const pending: Promise<unknown>[] = [];
    return {
        add<T>(fn: () => Promise<T>): Promise<T> {
            const task = fn();
            pending.push(task);
            return task;
        },
        async onIdle(): Promise<void> {
            await Promise.all(pending);
        }
    } as any;
};

const createParentThread = (overrides: Partial<any> = {}) => ({
    commentThreadRenderer: {
        comment: {
            commentRenderer: {
                commentId: 'parent-1',
                contentText: { runs: [{ text: 'Parent comment' }] },
                publishedTimeText: { runs: [{ text: '1 day ago' }] },
                ...overrides
            }
        }
    }
});

test('objectScan finds continuation token through wrapper objects', () => {
    const testData = {
        response: {
            contents: {
                continuationItemRenderer: {
                    continuationEndpoint: {
                        continuationCommand: { token: 'test-token' }
                    }
                }
            }
        }
    };

    const token = objectScan(['**.continuationItemRenderer.continuationEndpoint.continuationCommand.token'], {
        joined: true,
        rtn: 'value',
        abort: true
    })(testData) as string | undefined;

    assert.strictEqual(token, 'test-token');
});

test('generateCommentObjectFromFW populates author metadata and counts', () => {
    const update = {
        properties: {
            content: {
                content: 'Hello world',
                commandRuns: [
                    {
                        startIndex: 0,
                        length: 5,
                        onTap: {
                            innertubeCommand: {
                                watchEndpoint: { videoId: 'video-1', startTimeSeconds: 12 }
                            }
                        }
                    }
                ]
            },
            publishedTime: '1 day ago'
        },
        author: {
            displayName: 'Test Author',
            avatarThumbnailUrl: 'https://example.com/avatar.jpg',
            channelCommand: { innertubeCommand: { browseEndpoint: { browseId: 'UC123' } } },
            sponsorBadgeUrl: 'https://example.com/badge.png',
            sponsorBadgeA11y: 'Supporter badge',
            isVerified: true,
            isCreator: true
        },
        toolbar: {
            likeCountLiked: '5',
            replyCount: '3',
            heartActiveTooltip: 'Creator heart'
        }
    };

    const surfaceUpdate = {
        publishedTimeCommand: { innertubeCommand: { browseEndpoint: { browseId: 'UC123' } } },
        pdgCommentChip: { chipText: 'donated' },
        engagementToolbar: { some: 'toolbar' }
    };

    const toolbarStateUpdate = {
        heartState: 'TOOLBAR_HEART_STATE_HEARTED',
        toolbar: { heartActiveTooltip: 'Creator heart' }
    };

    const comment = generateCommentObjectFromFW({
        commentId: 'comment-1',
        update,
        surfaceUpdate,
        toolbarStateUpdate
    });

    assert.ok(comment);
    const renderer: any = (comment as any).commentRenderer;
    assert.strictEqual(renderer.commentId, 'comment-1');
    assert.strictEqual(renderer.likeCount, 4);
    assert.strictEqual(renderer.replyCount, 3);
    assert.strictEqual(renderer.contentText.fullText, 'Hello world');
    assert.strictEqual(renderer.authorThumbnail.thumbnails[0].url, 'https://example.com/avatar.jpg');
    assert.strictEqual(renderer.authorEndpoint.browseEndpoint.browseId, 'UC123');
    assert.strictEqual(renderer.authorIsChannelOwner, true);
    assert.strictEqual(renderer.verifiedAuthor, true);
    assert.strictEqual(
        renderer.sponsorCommentBadge.sponsorCommentBadgeRenderer.customBadge.thumbnails[0].url,
        'https://example.com/badge.png'
    );
    assert.strictEqual(renderer.creatorHeart.tooltip, 'Creator heart');
    assert.deepStrictEqual(renderer.donatedChip, surfaceUpdate.pdgCommentChip);
    assert.deepStrictEqual(renderer.engagementToolbar, surfaceUpdate.engagementToolbar);
    assert.strictEqual(renderer.publishedTimeText.runs[0].text, '1 day ago');
    assert.deepStrictEqual(
        renderer.publishedTimeText.runs[0].navigationEndpoint,
        surfaceUpdate.publishedTimeCommand.innertubeCommand
    );
});

test('processParentComment builds parent without continuations', () => {
    const thread = createParentThread();

    const result = processParentComment({ item: thread, frameworkUpdates: {}, currentVideoId: 'video-1' });

    assert.strictEqual(result.comments.length, 1);
    const parent: any = result.comments[0];
    assert.strictEqual(parent.typeComment, 'C');
    assert.strictEqual(parent.commentRenderer.contentText.fullText, 'Parent comment');
    assert.strictEqual(parent.commentRenderer.contentText.renderFullText, 'Parent comment');
    assert.deepStrictEqual(result.replyContinuations, []);
});

test('processParentComment collects replies and reply continuations', () => {
    const thread = createParentThread();
    thread.commentThreadRenderer.replies = {
        commentRepliesRenderer: {
            contents: [
                {
                    commentRenderer: {
                        commentId: 'reply-1',
                        contentText: { runs: [{ text: 'First reply' }] },
                        publishedTimeText: { runs: [{ text: '1 hour ago' }] }
                    }
                }
            ],
            continuations: [
                {
                    nextContinuationData: {
                        continuation: 'reply-token-1',
                        clickTrackingParams: 'tracking-1'
                    }
                }
            ]
        }
    };

    const result = processParentComment({ item: thread, frameworkUpdates: {}, currentVideoId: 'video-1' });

    assert.strictEqual(result.comments.length, 2);
    const parent: any = result.comments[0];
    const reply: any = result.comments[1];
    assert.strictEqual(reply.typeComment, 'R');
    assert.strictEqual(reply.commentRenderer.contentText.fullText, 'First reply');
    assert.strictEqual(reply.originComment, parent);
    assert.strictEqual(result.replyContinuations.length, 1);
    assert.deepStrictEqual(result.replyContinuations[0], {
        token: 'reply-token-1',
        clickTrackingParams: 'tracking-1',
        originComment: parent
    });
});

test('processParentComment formats timeline links, external links, emojis, and attachments consistently', () => {
    const runs = [
        { text: 'See ' },
        {
            text: '1:23',
            navigationEndpoint: {
                watchEndpoint: {
                    startTimeSeconds: 83,
                    videoId: 'video-1'
                }
            }
        },
        { text: ' example ' },
        {
            text: 'docs',
            navigationEndpoint: {
                urlEndpoint: {
                    url: 'https://example.com'
                }
            }
        },
        {
            text: ' :smile:',
            emoji: {
                image: {
                    thumbnails: [
                        { url: 'https://example.com/smile-small.png' },
                        { url: 'https://example.com/smile.png' }
                    ]
                },
                shortcuts: [':smile:']
            }
        },
        {
            text: ' [img]',
            attachment: {
                image: {
                    url: 'https://example.com/image.png',
                    width: 48,
                    height: 48,
                    margin: { left: 1, right: 2 }
                }
            }
        }
    ];
    const parentRuns = JSON.parse(JSON.stringify(runs));
    const replyRuns = JSON.parse(JSON.stringify(runs));
    const thread = createParentThread({
        commentId: 'parent-format',
        contentText: { runs: parentRuns }
    });
    thread.commentThreadRenderer.replies = {
        commentRepliesRenderer: {
            contents: [
                {
                    commentRenderer: {
                        commentId: 'reply-format',
                        contentText: { runs: replyRuns },
                        publishedTimeText: { runs: [{ text: 'just now' }] }
                    }
                }
            ]
        }
    };

    const result = processParentComment({ item: thread, frameworkUpdates: {}, currentVideoId: 'video-1' });

    const parent = result.comments.find((c: any) => c.typeComment === 'C') as any;
    const reply = result.comments.find((c: any) => c.typeComment === 'R') as any;

    assert.ok(parent);
    assert.ok(reply);
    assert.strictEqual(parent.commentRenderer.contentText.fullText, 'See 1:23 example docs :smile: [img]');
    assert.strictEqual(parent.commentRenderer.contentText.fullText, reply.commentRenderer.contentText.fullText);
    assert.strictEqual(
        parent.commentRenderer.contentText.renderFullText,
        reply.commentRenderer.contentText.renderFullText
    );

    const rendered = parent.commentRenderer.contentText.renderFullText;
    assert.ok(rendered.includes('ycs-goto-comment-time'));
    assert.ok(rendered.includes('href="https://www.youtube.com/watch?v=video-1&t=83s"'));
    assert.ok(rendered.includes('data-video-id="video-1"'));
    assert.ok(rendered.includes('ycs-comment-link'));
    assert.ok(rendered.includes('href="https://example.com"'));
    const attachmentMatches = rendered.match(/class="ycs-attachment"/g) || [];
    assert.strictEqual(attachmentMatches.length, 2);
    assert.strictEqual(parent.commentRenderer.isTimeLine, 'timeline');
    assert.strictEqual(reply.commentRenderer.isTimeLine, 'timeline');
});

test('processParentComment applies framework updates for creator flag', () => {
    const thread = createParentThread();
    const frameworkUpdates = {
        'parent-1': {
            author: { isCreator: true }
        }
    };

    const result = processParentComment({ item: thread, frameworkUpdates, currentVideoId: 'video-1' });

    const parent: any = result.comments[0];
    assert.strictEqual(parent.commentRenderer.authorIsChannelOwner, true);
});

test('prepareFieldsComment retains metadata required for exports and caching', () => {
    const originalComment = {
        commentRenderer: {
            authorText: {
                simpleText: 'Author Name',
                runs: [
                    {
                        text: 'Author Name',
                        navigationEndpoint: {
                            browseEndpoint: { browseId: 'UC12345', canonicalBaseUrl: '/@author' },
                            commandMetadata: {
                                webCommandMetadata: {
                                    url: '/channel/UC12345',
                                    apiUrl: '/youtubei/v1/browse',
                                    rootVe: 123,
                                    webPageType: 'WEB_PAGE_TYPE_BROWSE'
                                }
                            }
                        }
                    }
                ]
            },
            authorEndpoint: {
                commandMetadata: {
                    webCommandMetadata: {
                        url: '/channel/UC12345',
                        apiUrl: '/youtubei/v1/browse',
                        rootVe: 456,
                        webPageType: 'WEB_PAGE_TYPE_BROWSE'
                    }
                },
                browseEndpoint: {
                    browseId: 'UC12345',
                    canonicalBaseUrl: '/@author',
                    params: 'extra'
                },
                clickTrackingParams: 'tracking'
            },
            publishedTimeText: {
                runs: [
                    {
                        text: '2 hours ago',
                        navigationEndpoint: {
                            commandMetadata: {
                                webCommandMetadata: {
                                    webPageType: 'WEB_PAGE_TYPE_BROWSE'
                                }
                            },
                            watchEndpoint: { params: 'detail' },
                            clickTrackingParams: 'time-tracking'
                        }
                    }
                ]
            },
            contentText: {
                runs: [
                    {
                        text: 'with link',
                        navigationEndpoint: {
                            browseEndpoint: { browseId: 'UC12345', canonicalBaseUrl: '/@author' },
                            commandMetadata: {
                                webCommandMetadata: {
                                    apiUrl: '/youtubei/v1/browse',
                                    rootVe: 789,
                                    webPageType: 'WEB_PAGE_TYPE_BROWSE'
                                }
                            },
                            clickTrackingParams: 'run-1'
                        }
                    },
                    { text: 'just text' }
                ]
            },
            voteCount: {
                simpleText: '42',
                runs: [
                    {
                        text: '42'
                    }
                ],
                extraData: 'remove me'
            },
            likeCount: 41
        }
    };

    const prepared = prepareFieldsComment(JSON.parse(JSON.stringify(originalComment)));
    const renderer: any = prepared.commentRenderer;

    assert.strictEqual(renderer.authorText.simpleText, 'Author Name');
    assert.ok(renderer.authorText.runs[0].navigationEndpoint);
    assert.strictEqual(renderer.authorText.runs[0].navigationEndpoint.browseEndpoint.browseId, 'UC12345');
    assert.strictEqual(renderer.authorEndpoint.commandMetadata.webCommandMetadata.url, '/channel/UC12345');
    assert.strictEqual(renderer.authorEndpoint.browseEndpoint.browseId, 'UC12345');
    assert.strictEqual(renderer.authorEndpoint.browseEndpoint.canonicalBaseUrl, '/@author');
    assert.strictEqual(renderer.publishedTimeText.runs[0].text, '2 hours ago');
    assert.strictEqual(renderer.contentText.runs[0].text, 'with link');
    assert.strictEqual(renderer.contentText.runs[1].text, 'just text');
    assert.strictEqual(renderer.voteCount.simpleText, '42');
    assert.strictEqual(renderer.voteCount.runs[0].text, '42');
    assert.strictEqual(renderer.likeCount, 41);

    const serialized = JSON.parse(JSON.stringify(prepared));
    assert.strictEqual(
        serialized.commentRenderer.authorEndpoint.commandMetadata.webCommandMetadata.url,
        '/channel/UC12345'
    );
    assert.strictEqual(serialized.commentRenderer.authorEndpoint.browseEndpoint.browseId, 'UC12345');
    assert.strictEqual(serialized.commentRenderer.contentText.runs[0].text, 'with link');
    assert.strictEqual(serialized.commentRenderer.voteCount.simpleText, '42');
});

test('scheduleReplyFetches returns without scheduling when no continuations', async () => {
    const queue = createStubQueue();
    const collected: any[] = [];

    scheduleReplyFetches({
        continuations: [],
        queue,
        currentVideoId: 'video-1',
        fetchContinuation: async () => undefined,
        onReply: (reply) => collected.push(reply)
    });

    await queue.onIdle();

    assert.deepStrictEqual(collected, []);
});

test('scheduleReplyFetches processes reply continuations', async () => {
    const parentThread = createParentThread();
    const parentResult = processParentComment({ item: parentThread, frameworkUpdates: {}, currentVideoId: 'video-1' });
    const parent: any = parentResult.comments[0];

    const replyContinuation: ReplyContinuation = {
        token: 'token-1',
        originComment: parent
    };

    const queue = createStubQueue();
    const collected: any[] = [];

    scheduleReplyFetches({
        continuations: [replyContinuation],
        queue,
        currentVideoId: 'video-1',
        fetchContinuation: async () => ({
            comments: [
                {
                    commentRenderer: {
                        commentId: 'child-1',
                        contentText: { runs: [{ text: 'Nested reply' }] },
                        publishedTimeText: { runs: [{ text: 'just now' }] }
                    }
                }
            ],
            continuations: [],
            frameworkUpdates: {}
        }),
        onReply: (reply) => collected.push(reply)
    });

    await queue.onIdle();

    assert.strictEqual(collected.length, 1);
    const reply: any = collected[0];
    assert.strictEqual(reply.typeComment, 'R');
    assert.strictEqual(reply.originComment, parent);
    assert.strictEqual(reply.commentRenderer.contentText.fullText, 'Nested reply');
});

test('scheduleReplyFetches unwraps commentThreadRenderer and extracts subThreads', async () => {
    const parentThread = createParentThread();
    const parentResult = processParentComment({ item: parentThread, frameworkUpdates: {}, currentVideoId: 'video-1' });
    const parent: any = parentResult.comments[0];

    const replyContinuation: ReplyContinuation = {
        token: 'token-nested',
        originComment: parent
    };

    const queue = createStubQueue();
    const collected: any[] = [];

    const frameworkUpdates = {
        'reply-1': {
            properties: { content: { content: 'Direct Reply' }, replyLevel: 1 },
            author: { displayName: 'User 1' },
            toolbar: {}
        },
        'nested-1': {
            properties: { content: { content: 'Nested Reply' }, replyLevel: 2 },
            author: { displayName: 'User 2' },
            toolbar: {}
        }
    };

    scheduleReplyFetches({
        continuations: [replyContinuation],
        queue,
        currentVideoId: 'video-1',
        fetchContinuation: async () => ({
            comments: [
                {
                    commentThreadRenderer: {
                        comment: {
                            commentRenderer: {
                                commentId: 'reply-1',
                                contentText: { runs: [{ text: 'Direct Reply' }] }
                            }
                        },
                        replies: {
                            commentRepliesRenderer: {
                                subThreads: [
                                    {
                                        commentThreadRenderer: {
                                            commentViewModel: {
                                                commentViewModel: {
                                                    commentId: 'nested-1'
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            ],
            continuations: [],
            frameworkUpdates
        }),
        onReply: (reply) => collected.push(reply)
    });

    await queue.onIdle();

    assert.strictEqual(collected.length, 2);
    
    const directReply = collected.find((c: any) => c.commentRenderer.commentId === 'reply-1');
    const nestedReply = collected.find((c: any) => c.commentRenderer.commentId === 'nested-1');

    assert.ok(directReply);
    assert.ok(nestedReply);

    assert.strictEqual(directReply.replyLevel, 1);
    assert.strictEqual(nestedReply.replyLevel, 2);
    
    assert.strictEqual(directReply.originComment, parent);
    // Nested reply's origin should be the direct reply (since it's a subThread of it)
    assert.strictEqual(nestedReply.originComment, directReply);
});

test('dedupeParentComments keeps first parent and rewires replies', () => {
    const parentThread = createParentThread();
    const processed = processParentComment({ item: parentThread, frameworkUpdates: {}, currentVideoId: 'video-1' });
    const parentA: any = processed.comments[0];
    const parentB: any = { ...parentA, _copy: true };
    parentB.commentRenderer = { ...parentA.commentRenderer };

    const reply: any = {
        typeComment: 'R',
        commentRenderer: {
            commentId: 'reply-duplicate'
        },
        originComment: parentB
    };

    const deduped = dedupeParentComments([parentA, parentB, reply]);

    assert.strictEqual(deduped.length, 2);
    assert.strictEqual(deduped[0], parentA);
    assert.strictEqual((deduped[1] as any).originComment, parentA);
});

test('fetchInitialCommentBatch prefers API continuation token', async () => {
    const windowRef: any = {
        location: { href: 'https://www.youtube.com/watch?v=videoB' },
        ytcfg: {
            data_: {
                INNERTUBE_CONTEXT_CLIENT_NAME: '1',
                INNERTUBE_CONTEXT_CLIENT_VERSION: '1.20240101',
                INNERTUBE_CONTEXT: { client: { clientName: 'WEB', clientVersion: '1.20240101' } },
                GOOGLE_FEEDBACK_PRODUCT_DATA: { accept_language: 'en-US' },
                INNERTUBE_API_KEY: 'test-key'
            }
        },
        ytInitialData: {
            sortMenu: {
                sortFilterSubMenuRenderer: {
                    subMenuItems: [
                        {
                            serviceEndpoint: {
                                continuationCommand: { token: 'legacy-token' },
                                clickTrackingParams: 'legacy-click'
                            }
                        }
                    ]
                }
            }
        }
    };

    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = windowRef;

    // Pre-set GlobalStore.getInitYtData to prevent additional getInitYtData call
    const originalGetInitYtData = (GlobalStore as any).getInitYtData;
    (GlobalStore as any).getInitYtData = {
        playerResponse: {
            videoDetails: {
                videoId: 'videoB'
            }
        }
    };

    // Save GlobalStore.isMemberOnly to restore in cleanup
    const originalIsMemberOnly = (GlobalStore as any).isMemberOnly;

    const capturedRequests: Array<{ url: unknown; init: RequestInit | undefined }> = [];
    const originalFetch = globalThis.fetch;

    let callCount = 0;
    const stubFetch = async (url: any, init?: RequestInit) => {
        callCount++;
        capturedRequests.push({ url, init });
        if (callCount === 1) {
            return new Response(
                JSON.stringify({
                    contents: {
                        twoColumnWatchNextResults: {
                            results: {
                                results: {
                                    contents: [
                                        {
                                            itemSectionRenderer: {
                                                contents: [
                                                    {
                                                        continuationItemRenderer: {
                                                            continuationEndpoint: {
                                                                continuationCommand: { token: 'seed-token' }
                                                            }
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }),
                { status: 200 }
            );
        }

        if (callCount === 2) {
            return new Response(
                JSON.stringify({
                    sortMenu: {
                        sortFilterSubMenuRenderer: {
                            subMenuItems: [
                                {
                                    serviceEndpoint: {
                                        continuationCommand: { token: 'api-token' },
                                        clickTrackingParams: 'api-click'
                                    }
                                }
                            ]
                        }
                    }
                }),
                { status: 200 }
            );
        }

        return new Response(
            JSON.stringify({
                onResponseReceivedEndpoints: [
                    { appendContinuationItemsAction: { continuationItems: [] } },
                    { reloadContinuationItemsCommand: { continuationItems: [] } }
                ]
            }),
            { status: 200 }
        );
    };

    globalThis.fetch = stubFetch as typeof fetch;
    setFetchImplementation(stubFetch as typeof fetch);

    try {
        const batch = await fetchInitialCommentBatch({ windowRef: windowRef as any, signal: undefined });
        assert.ok(batch);
        assert.strictEqual(capturedRequests.length, 3);
        const body = JSON.parse(String(capturedRequests[2].init?.body));
        assert.strictEqual(body.continuation, 'api-token');
        assert.strictEqual(body.clickTracking.clickTrackingParams, 'api-click');
    } finally {
        setFetchImplementation(originalFetch as typeof fetch);
        globalThis.fetch = originalFetch;
        // Restore GlobalStore.getInitYtData
        if (originalGetInitYtData === undefined) {
            delete (GlobalStore as any).getInitYtData;
        } else {
            (GlobalStore as any).getInitYtData = originalGetInitYtData;
        }
        // Restore GlobalStore.isMemberOnly
        if (originalIsMemberOnly === undefined) {
            delete (GlobalStore as any).isMemberOnly;
        } else {
            (GlobalStore as any).isMemberOnly = originalIsMemberOnly;
        }
        if (originalWindow === undefined) {
            delete (globalThis as any).window;
        } else {
            (globalThis as any).window = originalWindow;
        }
    }
});

test('fetchContinuationBatch includes continuation token and tracking params', async () => {
    const windowRef: any = {
        location: { href: 'https://www.youtube.com/watch?v=abc123' },
        ytcfg: {
            data_: {
                INNERTUBE_CONTEXT_CLIENT_NAME: '1',
                INNERTUBE_CONTEXT_CLIENT_VERSION: '1.20240101',
                INNERTUBE_CONTEXT: { client: { clientName: 'WEB', clientVersion: '1.20240101' } },
                GOOGLE_FEEDBACK_PRODUCT_DATA: { accept_language: 'en-US' },
                INNERTUBE_API_KEY: 'test-key'
            }
        }
    };

    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = windowRef;

    // Save GlobalStore.isMemberOnly to restore in cleanup
    const originalIsMemberOnly = (GlobalStore as any).isMemberOnly;
    // Pre-set isMemberOnly to prevent ensureMemberOnlyStatus from triggering additional fetch
    (GlobalStore as any).isMemberOnly = false;

    const capturedRequests: Array<{ url: unknown; init: RequestInit | undefined }> = [];
    const originalFetch = globalThis.fetch;

    const stubFetch = async (url: any, init?: RequestInit) => {
        capturedRequests.push({ url, init });
        return new Response(
            JSON.stringify({
                onResponseReceivedEndpoints: [
                    { appendContinuationItemsAction: { continuationItems: [] } },
                    { reloadContinuationItemsCommand: { continuationItems: [] } }
                ]
            }),
            { status: 200 }
        );
    };

    globalThis.fetch = stubFetch as typeof fetch;
    setFetchImplementation(stubFetch as typeof fetch);

    try {
        const batch = await fetchContinuationBatch({
            windowRef: windowRef as any,
            signal: undefined,
            continuation: { token: 'token-123', clickTrackingParams: 'tracking-xyz' }
        });

        assert.ok(batch);
        assert.strictEqual(capturedRequests.length, 1);
        const body = JSON.parse(String(capturedRequests[0].init?.body));
        assert.strictEqual(body.continuation, 'token-123');
        assert.strictEqual(body.clickTracking.clickTrackingParams, 'tracking-xyz');
    } finally {
        setFetchImplementation(originalFetch as typeof fetch);
        globalThis.fetch = originalFetch;
        // Restore GlobalStore.isMemberOnly
        if (originalIsMemberOnly === undefined) {
            delete (GlobalStore as any).isMemberOnly;
        } else {
            (GlobalStore as any).isMemberOnly = originalIsMemberOnly;
        }
        if (originalWindow === undefined) {
            delete (globalThis as any).window;
        } else {
            (globalThis as any).window = originalWindow;
        }
    }
});

// =============================================================================
// Nested Comments (subThreads) Tests
// =============================================================================

test('extractSubThreads returns empty result when no subThreads', () => {
    const repliesRenderer = {
        contents: [{ commentRenderer: { commentId: 'reply-1' } }]
    };
    const result = extractSubThreads(repliesRenderer, {}, {}, 1);

    assert.deepStrictEqual(result.comments, []);
    assert.deepStrictEqual(result.continuations, []);
});

test('extractSubThreads extracts nested comments from subThreads', () => {
    const repliesRenderer = {
        subThreads: [
            {
                commentThreadRenderer: {
                    commentViewModel: {
                        commentViewModel: {
                            commentId: 'nested-reply-1',
                            commentSurfaceKey: 'surface-1',
                            toolbarStateKey: 'toolbar-1'
                        }
                    }
                }
            }
        ]
    };

    const frameworkUpdatesById = {
        'nested-reply-1': {
            properties: {
                content: { content: 'Nested reply content' },
                publishedTime: '1 hour ago',
                replyLevel: 1
            },
            author: {
                displayName: 'Test User'
            },
            toolbar: {
                likeCountLiked: '2',
                replyCount: '0'
            }
        }
    };

    const parentComment = { commentRenderer: { commentId: 'parent-1' } };
    const result = extractSubThreads(repliesRenderer, frameworkUpdatesById, parentComment, 1);

    assert.strictEqual(result.comments.length, 1);
    assert.strictEqual(result.comments[0].commentRenderer.commentId, 'nested-reply-1');
    assert.strictEqual(result.comments[0].originComment, parentComment);
    assert.strictEqual(result.comments[0]._subThreadDepth, 1);
});

test('extractSubThreads extracts continuation tokens from subThreads', () => {
    const repliesRenderer = {
        subThreads: [
            {
                continuationItemRenderer: {
                    button: {
                        buttonRenderer: {
                            command: {
                                continuationCommand: { token: 'nested-token-1' },
                                clickTrackingParams: 'nested-tracking-1'
                            }
                        }
                    }
                }
            }
        ]
    };

    const parentComment = { commentRenderer: { commentId: 'parent-1' } };
    const result = extractSubThreads(repliesRenderer, {}, parentComment, 2);

    assert.strictEqual(result.continuations.length, 1);
    assert.strictEqual(result.continuations[0].token, 'nested-token-1');
    assert.strictEqual(result.continuations[0].clickTrackingParams, 'nested-tracking-1');
    assert.strictEqual(result.continuations[0].replyLevel, 2);
    assert.strictEqual(result.continuations[0].parentCommentId, 'parent-1');
    assert.strictEqual(result.continuations[0].originComment, parentComment);
});

test('extractSubThreads recursively processes nested subThreads', () => {
    const repliesRenderer = {
        subThreads: [
            {
                commentThreadRenderer: {
                    commentViewModel: {
                        commentViewModel: {
                            commentId: 'level-1-reply'
                        }
                    },
                    replies: {
                        commentRepliesRenderer: {
                            subThreads: [
                                {
                                    commentThreadRenderer: {
                                        commentViewModel: {
                                            commentViewModel: {
                                                commentId: 'level-2-reply'
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        ]
    };

    const frameworkUpdatesById = {
        'level-1-reply': {
            properties: { content: { content: 'Level 1' }, replyLevel: 1 },
            author: { displayName: 'User 1' },
            toolbar: {}
        },
        'level-2-reply': {
            properties: { content: { content: 'Level 2' }, replyLevel: 2 },
            author: { displayName: 'User 2' },
            toolbar: {}
        }
    };

    const parentComment = { commentRenderer: { commentId: 'parent-1' } };
    const result = extractSubThreads(repliesRenderer, frameworkUpdatesById, parentComment, 1);

    assert.strictEqual(result.comments.length, 2);

    const level1 = result.comments.find((c: any) => c.commentRenderer.commentId === 'level-1-reply');
    const level2 = result.comments.find((c: any) => c.commentRenderer.commentId === 'level-2-reply');

    assert.ok(level1);
    assert.ok(level2);
    assert.strictEqual(level1._subThreadDepth, 1);
    assert.strictEqual(level2._subThreadDepth, 2);
    assert.strictEqual(level1.originComment, parentComment);
    assert.strictEqual(level2.originComment, level1);
});

test('extractSubThreads respects MAX_SUBTHREAD_DEPTH limit', () => {
    // Create deeply nested structure (6 levels)
    const createDeepNested = (depth: number): any => {
        if (depth > 6) {
            return {
                continuationItemRenderer: {
                    continuationEndpoint: {
                        continuationCommand: { token: `too-deep-${depth}` }
                    }
                }
            };
        }
        return {
            commentThreadRenderer: {
                commentViewModel: {
                    commentViewModel: { commentId: `level-${depth}` }
                },
                replies: {
                    commentRepliesRenderer: {
                        subThreads: [createDeepNested(depth + 1)]
                    }
                }
            }
        };
    };

    const repliesRenderer = { subThreads: [createDeepNested(1)] };

    const frameworkUpdatesById: Record<string, any> = {};
    for (let i = 1; i <= 6; i++) {
        frameworkUpdatesById[`level-${i}`] = {
            properties: { content: { content: `Level ${i}` }, replyLevel: i },
            author: { displayName: `User ${i}` },
            toolbar: {}
        };
    }

    const parentComment = { commentRenderer: { commentId: 'root' } };
    const result = extractSubThreads(repliesRenderer, frameworkUpdatesById, parentComment, 1);

    // Should stop at depth 5 (MAX_SUBTHREAD_DEPTH)
    assert.ok(result.comments.length <= 5);
    const commentIds = result.comments.map((c: any) => c.commentRenderer.commentId);
    assert.ok(commentIds.includes('level-1'));
    assert.ok(!commentIds.includes('level-6'));
});

test('generateCommentObjectFromFW extracts replyLevel from properties', () => {
    const update = {
        properties: {
            content: { content: 'Reply content' },
            publishedTime: '1 hour ago',
            replyLevel: 2
        },
        author: { displayName: 'Test Author' },
        toolbar: { likeCountLiked: '0', replyCount: '0' }
    };

    const comment = generateCommentObjectFromFW({
        commentId: 'reply-with-level',
        update,
        surfaceUpdate: undefined,
        toolbarStateUpdate: undefined
    });

    assert.ok(comment);
    assert.strictEqual(comment.replyLevel, 2);
});

test('processParentComment assigns replyLevel to parent and replies', () => {
    const thread = createParentThread();
    thread.commentThreadRenderer.replies = {
        commentRepliesRenderer: {
            contents: [
                {
                    commentRenderer: {
                        commentId: 'reply-1',
                        contentText: { runs: [{ text: 'First reply' }] },
                        publishedTimeText: { runs: [{ text: '1 hour ago' }] }
                    }
                }
            ]
        }
    };

    const frameworkUpdates = {
        'parent-1': {
            properties: { replyLevel: 0 }
        },
        'reply-1': {
            properties: { replyLevel: 1 }
        }
    };

    const result = processParentComment({ item: thread, frameworkUpdates, currentVideoId: 'video-1' });

    const parent: any = result.comments.find((c: any) => c.typeComment === 'C');
    const reply: any = result.comments.find((c: any) => c.typeComment === 'R');

    assert.strictEqual(parent.replyLevel, 0);
    assert.strictEqual(reply.replyLevel, 1);
});

test('processParentComment processes subThreads and sets originComment to direct parent', () => {
    const thread = {
        commentThreadRenderer: {
            comment: {
                commentRenderer: {
                    commentId: 'parent-1',
                    contentText: { runs: [{ text: 'Parent' }] },
                    publishedTimeText: { runs: [{ text: '1 day ago' }] }
                }
            },
            replies: {
                commentRepliesRenderer: {
                    subThreads: [
                        {
                            commentThreadRenderer: {
                                commentViewModel: {
                                    commentViewModel: {
                                        commentId: 'nested-1'
                                    }
                                }
                            }
                        }
                    ]
                }
            }
        }
    };

    const frameworkUpdates = {
        'nested-1': {
            properties: {
                content: { content: 'Nested reply' },
                publishedTime: '1 hour ago',
                replyLevel: 1
            },
            author: { displayName: 'Nested User' },
            toolbar: {}
        }
    };

    const result = processParentComment({ item: thread, frameworkUpdates, currentVideoId: 'video-1' });

    const parent: any = result.comments.find((c: any) => c.typeComment === 'C');
    const nested: any = result.comments.find((c: any) => c.commentRenderer?.commentId === 'nested-1');

    assert.ok(parent);
    assert.ok(nested);
    assert.strictEqual(nested.typeComment, 'R');
    assert.strictEqual(nested.replyLevel, 1);
    assert.strictEqual(nested.originComment, parent);
});
