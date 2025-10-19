import { strict as assert } from 'node:assert';
import test from 'node:test';

import { buildChatMessageViewModels, buildCommentViewModels } from '../src/source/utils/viewModels';

test('buildCommentViewModels decodes HTML entities once', () => {
    const items = [
        {
            item: {
                commentRenderer: {
                    authorText: { simpleText: 'Author' },
                    contentText: {
                        simpleText: '&amp;gt; Hello &amp;copy;'
                    }
                }
            }
        }
    ];

    const [model] = buildCommentViewModels(items);
    assert.equal(model !== undefined, true, 'expected a comment model');
    assert.equal(model.contentHtml, '&gt; Hello &copy;');
});

test('buildCommentViewModels escape unexpected tags but keeps anchors', () => {
    const items = [
        {
            item: {
                commentRenderer: {
                    authorText: { simpleText: 'Author' },
                    contentText: {
                        renderFullText: '<test>unsafe</test><a href="/watch?v=1">link</a>'
                    }
                }
            }
        }
    ];

    const [model] = buildCommentViewModels(items);
    assert.equal(model !== undefined, true, 'expected a comment model');
    assert.equal(
        model?.contentHtml,
        '&lt;test&gt;unsafe&lt;/test&gt;<a href="https://www.youtube.com/watch?v=1" rel="noopener noreferrer">link</a>'
    );
});

test('buildChatMessageViewModels decodes run text HTML entities once', () => {
    const items = [
        {
            item: {
                replayChatItemAction: {
                    actions: [
                        {
                            addChatItemAction: {
                                item: {
                                    liveChatTextMessageRenderer: {
                                        message: {
                                            runs: [{ text: '&amp;gt; Wow' }]
                                        }
                                    }
                                }
                            }
                        }
                    ]
                }
            }
        }
    ];

    const [model] = buildChatMessageViewModels(items);
    assert.equal(model !== undefined, true, 'expected a chat model');
    assert.equal(model.messageHtml, '&gt; Wow');
});
