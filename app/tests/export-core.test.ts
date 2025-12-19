import { strict as assert } from 'node:assert';
import test from 'node:test';

import {
    buildChatExportPayload,
    buildCommentsExportPayload,
    buildCommentsExportPayloadFromCache
} from '../src/source/utils/export-core';
import type { CommentItem } from '../src/source/utils/interfaces/i_types';

test('buildCommentsExportPayload maps comments and replies to export rows', () => {
    const comments: CommentItem[] = [
        {
            commentRenderer: {
                commentId: 'c1',
                authorEndpoint: {
                    browseEndpoint: { canonicalBaseUrl: '/@test' }
                },
                authorText: { simpleText: 'Tester' },
                publishedTimeText: {
                    runs: [
                        {
                            text: '1 day ago',
                            navigationEndpoint: {
                                commandMetadata: {
                                    webCommandMetadata: { url: '/watch?v=vid&lc=c1' }
                                }
                            }
                        }
                    ]
                },
                contentText: { fullText: 'Hello world' },
                voteCount: { simpleText: '5' },
                sponsorCommentBadge: {
                    sponsorCommentBadgeRenderer: {
                        tooltip: 'member'
                    }
                }
            },
            typeComment: 'C'
        },
        {
            commentRenderer: {
                commentId: 'r1',
                authorEndpoint: {
                    browseEndpoint: { canonicalBaseUrl: '/@reply' }
                },
                authorText: { simpleText: 'Responder' },
                publishedTimeText: {
                    runs: [
                        {
                            text: '2 hours ago',
                            navigationEndpoint: {
                                commandMetadata: {
                                    webCommandMetadata: { url: '/watch?v=vid&lc=r1' }
                                }
                            }
                        }
                    ]
                },
                contentText: { fullText: 'Reply body' },
                voteCount: { simpleText: '2' },
                sponsorCommentBadge: {
                    sponsorCommentBadgeRenderer: {
                        tooltip: 'member (gold)'
                    }
                }
            },
            originComment: {
                commentRenderer: {
                    commentId: 'c1'
                }
            },
            typeComment: 'R'
        }
    ];

    const payload = buildCommentsExportPayload({
        titleVideo: 'Demo',
        url: 'https://www.youtube.com/watch?v=vid',
        comments
    });

    assert.equal(payload.comments[0].author.channel, 'youtube.com/@test');
    assert.equal(payload.comments[0].commentReplies.replies.length, 1);
    assert.equal(payload.comments[0].commentReplies.replies[0].author.nameAuthor, 'Responder');
});

test('buildChatExportPayload extracts member badge text and channel IDs', () => {
    const chatMessages = [
        {
            replayChatItemAction: {
                actions: [
                    {
                        addChatItemAction: {
                            item: {
                                liveChatTextMessageRenderer: {
                                    authorName: { simpleText: 'ChatUser' },
                                    authorExternalChannelId: 'UC123',
                                    authorBadges: [
                                        {
                                            liveChatAuthorBadgeRenderer: {
                                                customThumbnail: {},
                                                tooltip: 'member (1 year)'
                                            }
                                        }
                                    ],
                                    message: { simpleText: 'Hi there' },
                                    timestampUsec: '1234567',
                                    timestampText: { simpleText: '00:01' }
                                }
                            }
                        }
                    }
                ]
            }
        }
    ];

    const payload = buildChatExportPayload(chatMessages, {
        titleVideo: 'Demo chat',
        url: 'https://www.youtube.com/watch?v=vid',
        videoId: 'vid'
    });

    assert.equal(payload.commentsChat[0].author.channel, 'youtube.com/channel/UC123');
    assert.equal(payload.commentsChat[0].author.member, 'member (1 year)');
});

test('buildChatExportPayload populates videoOffsetMs from videoOffsetTimeMsec', () => {
    const chatMessages = [
        {
            replayChatItemAction: {
                videoOffsetTimeMsec: '330000', // 5 minutes 30 seconds
                actions: [
                    {
                        addChatItemAction: {
                            item: {
                                liveChatTextMessageRenderer: {
                                    authorName: { simpleText: 'TestUser' },
                                    authorExternalChannelId: 'UC456',
                                    message: { simpleText: 'Test message' },
                                    timestampUsec: '1234567890',
                                    timestampText: { simpleText: '' }
                                }
                            }
                        }
                    }
                ]
            }
        }
    ];

    const payload = buildChatExportPayload(chatMessages, {
        titleVideo: 'Test video',
        url: 'https://www.youtube.com/watch?v=test',
        videoId: 'test'
    });

    assert.equal(payload.commentsChat[0].videoOffsetMs, 330000);
    assert.equal(payload.commentsChat[0].timestampText, '0:05:30');
    assert.equal(payload.commentsChat[0].relativeTimestamp, '+0:05:30');
});

test('buildCommentsExportPayloadFromCache returns undefined when cache is empty', () => {
    const payload = buildCommentsExportPayloadFromCache({ comments: [] });
    assert.equal(payload, undefined);
});

test('buildCommentsExportPayload handles nested replies (replyLevel >= 2)', () => {
    const parentComment: CommentItem = {
        commentRenderer: {
            commentId: 'c1',
            authorText: { simpleText: 'Parent' },
            contentText: { fullText: 'Parent comment' },
            authorEndpoint: { browseEndpoint: { canonicalBaseUrl: '/@parent' } }
        },
        typeComment: 'C',
        replyLevel: 0
    };

    const firstReply: CommentItem = {
        commentRenderer: {
            commentId: 'r1',
            authorText: { simpleText: 'Reply1' },
            contentText: { fullText: 'First reply' },
            authorEndpoint: { browseEndpoint: { canonicalBaseUrl: '/@reply1' } }
        },
        originComment: parentComment,
        typeComment: 'R',
        replyLevel: 1
    };

    const nestedReply: CommentItem = {
        commentRenderer: {
            commentId: 'r2',
            authorText: { simpleText: 'Reply2' },
            contentText: { fullText: 'Nested reply' },
            authorEndpoint: { browseEndpoint: { canonicalBaseUrl: '/@reply2' } }
        },
        originComment: firstReply,
        typeComment: 'R',
        replyLevel: 2
    };

    const comments = [parentComment, firstReply, nestedReply];

    const payload = buildCommentsExportPayload({
        titleVideo: 'Test',
        url: 'https://www.youtube.com/watch?v=test',
        comments
    });

    assert.equal(payload.totalComments, 1, 'Should have 1 parent comment');
    assert.equal(payload.totalReplies, 2, 'Should have 2 replies total');
    assert.equal(payload.comments.length, 1, 'Should have 1 comment in export');
    assert.equal(
        payload.comments[0].commentReplies.replies.length,
        2,
        'Parent comment should have 2 replies (including nested)'
    );

    const replyAuthors = payload.comments[0].commentReplies.replies.map((r) => r.author.nameAuthor);
    assert.ok(replyAuthors.includes('Reply1'), 'Should include first reply');
    assert.ok(replyAuthors.includes('Reply2'), 'Should include nested reply');
});
