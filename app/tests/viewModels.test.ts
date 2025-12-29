import { strict as assert } from 'node:assert';
import test from 'node:test';

import { buildCommentViewModels } from '../src/source/utils/viewModels';

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
