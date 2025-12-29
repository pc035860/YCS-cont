import { strict as assert } from 'node:assert';
import test from 'node:test';

import { buildChatMessageViewModels, buildCommentViewModels } from '../src/source/utils/viewModels';
import { formatCommentRuns } from '../src/source/utils/innertube/comments/pipeline';

// test('buildCommentViewModels decodes HTML entities once', () => {
//     const items = [
//         {
//             item: {
//                 commentRenderer: {
//                     authorText: { simpleText: 'Author' },
//                     contentText: {
//                         simpleText: '&amp;gt; Hello &amp;copy;'
//                     }
//                 }
//             }
//         }
//     ];

//     const [model] = buildCommentViewModels(items);
//     assert.equal(model !== undefined, true, 'expected a comment model');
//     assert.equal(model.contentHtml, '&gt; Hello &copy;');
// });

// test('buildCommentViewModels escape unexpected tags but keeps anchors', () => {
//     const runs = [
//         {text: '<test>unsafe</test><a href="/watch?v=1">link</a>' }
//     ]
    
//     const formattedCommentContent = formatCommentRuns(runs, '123');
//     const renderFullText = formattedCommentContent.renderFullText;

//     assert.equal(formattedCommentContent !== undefined, true, 'expected a FormattedCommentContent');
//     assert.equal(
//         renderFullText,
//         '&lt;test&gt;unsafe&lt;/test&gt;<a href="https://www.youtube.com/watch?v=1" rel="noopener noreferrer">link</a>'
//     );
// });

// test('buildChatMessageViewModels decodes run text HTML entities once', () => {
//     const items = [
//         {
//             item: {
//                 replayChatItemAction: {
//                     actions: [
//                         {
//                             addChatItemAction: {
//                                 item: {
//                                     liveChatTextMessageRenderer: {
//                                         message: {
//                                             runs: [{ text: '&amp;gt; Wow' }]
//                                         }
//                                     }
//                                 }
//                             }
//                         }
//                     ]
//                 }
//             }
//         }
//     ];

//     const [model] = buildChatMessageViewModels(items);
//     assert.equal(model !== undefined, true, 'expected a chat model');
//     assert.equal(model.messageHtml, '&gt; Wow');
// });

test('buildCommentViewModels extracts heartTooltip from creatorHeart.tooltip', () => {
    const items = [
        {
            item: {
                commentRenderer: {
                    authorText: { simpleText: 'Test Author' },
                    contentText: { simpleText: 'Test comment' },
                    creatorHeart: {
                        tooltip: '@author gave ❤'
                    }
                }
            }
        }
    ];

    const [model] = buildCommentViewModels(items);
    assert.equal(model !== undefined, true, 'expected a comment model');
    assert.ok(model.heartTooltip, 'expected heartTooltip to be set');
    assert.equal(model.heartTooltip, '@author gave ❤', 'expected heartTooltip to match creatorHeart.tooltip');
});

test('buildCommentViewModels preserves multilingual tooltip text', () => {
    const items = [
        {
            item: {
                commentRenderer: {
                    authorText: { simpleText: 'Test Author' },
                    contentText: { simpleText: 'Test comment' },
                    creatorHeart: {
                        tooltip: '@yuzu_zuyuzu給了 ❤'
                    }
                }
            }
        }
    ];

    const [model] = buildCommentViewModels(items);
    assert.equal(model !== undefined, true, 'expected a comment model');
    assert.ok(model.heartTooltip, 'expected heartTooltip to be set');
    assert.equal(
        model.heartTooltip,
        '@yuzu_zuyuzu給了 ❤',
        'expected multilingual tooltip to be preserved without prefix'
    );
});

test('buildCommentViewModels handles comments without creatorHeart', () => {
    const items = [
        {
            item: {
                commentRenderer: {
                    authorText: { simpleText: 'Test Author' },
                    contentText: { simpleText: 'Test comment' }
                    // No creatorHeart
                }
            }
        }
    ];

    const [model] = buildCommentViewModels(items);
    assert.equal(model !== undefined, true, 'expected a comment model');
    assert.equal(model.heartTooltip, undefined, 'expected heartTooltip to be undefined when creatorHeart missing');
});
