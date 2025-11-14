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

test('buildCommentsExportPayloadFromCache returns undefined when cache is empty', () => {
    const payload = buildCommentsExportPayloadFromCache({ comments: [] });
    assert.equal(payload, undefined);
});
