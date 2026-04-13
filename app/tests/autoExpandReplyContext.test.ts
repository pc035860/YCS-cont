import { strict as assert } from 'node:assert';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
(globalThis as any).document = dom.window.document;
(globalThis as any).window = dom.window;
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).Element = dom.window.Element;
(globalThis as any).Node = dom.window.Node;
(globalThis as any).DocumentFragment = dom.window.DocumentFragment;

import {
    expandOriginChainFor,
    autoExpandAllRepliesIn,
    type CommentStateAccessor,
    type OriginChainDeps
} from '../src/source/web-resources/ui/originChain';
import { renderComment } from '../src/source/utils/renderView';
import { GlobalStore } from '../src/source/utils/common';

function buildParentComment(id: string, text: string): Record<string, any> {
    return {
        _index: 0,
        typeComment: 'C',
        commentId: id,
        commentRenderer: {
            commentId: id,
            contentText: { simpleText: text },
            authorText: { simpleText: 'parent_author' },
            publishedTimeText: { runs: [{ text: '2d ago' }] }
        }
    };
}

function buildReplyComment(
    id: string,
    text: string,
    parent: Record<string, any>,
    index: number
): Record<string, any> {
    return {
        _index: index,
        typeComment: 'R',
        commentId: id,
        commentRenderer: {
            commentId: id,
            contentText: { simpleText: text },
            authorText: { simpleText: 'replier' },
            publishedTimeText: { runs: [{ text: '1d ago' }] }
        },
        originComment: parent
    };
}

function buildReplyContainer(commentId: string, refIndex: number): HTMLElement {
    const container = document.createElement('div');
    container.id = `ycs-number-comment-${refIndex}`;
    container.className = 'ycs-render-comment';

    const button = document.createElement('button');
    button.id = String(refIndex);
    button.className = 'ycs-open-comment-all';
    button.innerHTML = '\u25B2';
    button.dataset.commentId = commentId;
    container.appendChild(button);

    return container;
}

function buildDeps(comments: Array<Record<string, any>>, query = ''): OriginChainDeps {
    const stateAccessor: CommentStateAccessor = {
        getComments: () => comments
    };
    return {
        stateAccessor,
        queryGetter: () => query
    };
}

function resetGlobalStore(): void {
    (GlobalStore as any).autoExpandReplyContext = false;
}

function flushFrames(ms = 100): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function setupRoot(): HTMLElement {
    const root = document.createElement('div');
    root.id = 'ycs_search_results';
    document.body.appendChild(root);
    return root;
}

function teardownRoot(root: HTMLElement): void {
    root.remove();
    resetGlobalStore();
}

test('Case A: GlobalStore.autoExpandReplyContext = false → hook short-circuits', () => {
    resetGlobalStore();
    const root = setupRoot();
    try {
        const parent = buildParentComment('c1', 'parent text');
        const reply = buildReplyComment('c1r1', 'reply text', parent, 1);
        const container = buildReplyContainer('c1r1', 1);
        root.appendChild(container);

        (GlobalStore as any).autoExpandReplyContext = false;
        autoExpandAllRepliesIn(root, buildDeps([reply]));

        const wrapper = root.querySelector('[id^="ycs-com-all-"]');
        assert.equal(wrapper, null, 'expected no origin chain wrapper when option is false');
        const button = container.querySelector('.ycs-open-comment-all') as HTMLElement;
        assert.equal(button.innerHTML, '\u25B2', 'expected button icon unchanged');
    } finally {
        teardownRoot(root);
    }
});

test('Case B: option=true with originComment → auto expand wrapper inserted', async () => {
    resetGlobalStore();
    const root = setupRoot();
    try {
        const parent = buildParentComment('c1', 'parent text');
        const reply = buildReplyComment('c1r1', 'reply text', parent, 1);
        const container = buildReplyContainer('c1r1', 1);
        root.appendChild(container);

        (GlobalStore as any).autoExpandReplyContext = true;
        autoExpandAllRepliesIn(root, buildDeps([reply]));
        await flushFrames();

        const wrapper = root.querySelector('#ycs-com-all-c1r1');
        assert.equal(wrapper !== null, true, 'expected origin chain wrapper to exist');

        const wrapperContent = wrapper?.querySelector('.ycs-render-comment');
        assert.equal(
            wrapperContent !== null && wrapperContent !== undefined,
            true,
            'expected wrapper to contain rendered parent comment node, not be empty shell'
        );

        const triggerHasClass = container.classList.contains('ycs-origin-trigger');
        assert.equal(triggerHasClass, true, 'expected reply container to have ycs-origin-trigger class');

        const button = container.querySelector('.ycs-open-comment-all') as HTMLElement;
        assert.equal(
            button.title,
            'Close all parent comments.',
            'expected button title to switch to close hint'
        );
    } finally {
        teardownRoot(root);
    }
});

test('Case C: idempotent — calling autoExpandAllRepliesIn twice inserts wrapper only once', async () => {
    resetGlobalStore();
    const root = setupRoot();
    try {
        const parent = buildParentComment('c1', 'parent text');
        const reply = buildReplyComment('c1r1', 'reply text', parent, 1);
        const container = buildReplyContainer('c1r1', 1);
        root.appendChild(container);

        (GlobalStore as any).autoExpandReplyContext = true;
        const deps = buildDeps([reply]);
        autoExpandAllRepliesIn(root, deps);
        autoExpandAllRepliesIn(root, deps);
        await flushFrames();

        const wrappers = root.querySelectorAll('#ycs-com-all-c1r1');
        assert.equal(wrappers.length, 1, 'expected exactly one origin chain wrapper after double call');
    } finally {
        teardownRoot(root);
    }
});

test('Case D: expandOriginChainFor returns false when ancestors are empty', () => {
    resetGlobalStore();
    const root = setupRoot();
    try {
        const orphan = buildReplyComment('c1r1', 'reply text', null as any, 1);
        delete orphan.originComment;
        const container = buildReplyContainer('c1r1', 1);
        root.appendChild(container);

        const result = expandOriginChainFor(container, buildDeps([orphan]));
        assert.equal(result, false, 'expected expandOriginChainFor to return false for empty ancestors');

        const wrapper = root.querySelector('#ycs-com-all-c1r1');
        assert.equal(wrapper, null, 'expected no wrapper inserted when ancestors empty');
    } finally {
        teardownRoot(root);
    }
});

test('Case E: multiple replies all expand independently', async () => {
    resetGlobalStore();
    const root = setupRoot();
    try {
        const parent1 = buildParentComment('c1', 'parent1');
        const parent2 = buildParentComment('c2', 'parent2');
        const reply1 = buildReplyComment('c1r1', 'reply1', parent1, 1);
        const reply2 = buildReplyComment('c1r2', 'reply2', parent1, 2);
        const reply3 = buildReplyComment('c2r1', 'reply3', parent2, 3);

        const container1 = buildReplyContainer('c1r1', 1);
        const container2 = buildReplyContainer('c1r2', 2);
        const container3 = buildReplyContainer('c2r1', 3);
        root.appendChild(container1);
        root.appendChild(container2);
        root.appendChild(container3);

        (GlobalStore as any).autoExpandReplyContext = true;
        autoExpandAllRepliesIn(root, buildDeps([reply1, reply2, reply3]));
        await flushFrames();

        assert.equal(root.querySelector('#ycs-com-all-c1r1') !== null, true, 'reply1 wrapper exists');
        assert.equal(root.querySelector('#ycs-com-all-c1r2') !== null, true, 'reply2 wrapper exists');
        assert.equal(root.querySelector('#ycs-com-all-c2r1') !== null, true, 'reply3 wrapper exists');

        for (const c of [container1, container2, container3]) {
            const btn = c.querySelector('.ycs-open-comment-all') as HTMLElement;
            assert.equal(
                btn.title,
                'Close all parent comments.',
                'each button should switch title after auto-expand'
            );
        }
    } finally {
        teardownRoot(root);
    }
});

test('Case G: renderComment invokes postBatchHook with batch wrapper after initial render', () => {
    resetGlobalStore();
    const root = setupRoot();
    try {
        const parent = buildParentComment('c1', 'parent text');
        const reply = buildReplyComment('c1r1', 'reply text', parent, 1);

        const hookCalls: HTMLElement[] = [];
        const spy = (batchRoot: HTMLElement): void => {
            hookCalls.push(batchRoot);
        };

        renderComment(root, [{ item: reply, refIndex: 1 }], {
            querySearch: '',
            postBatchHook: spy
        });

        assert.equal(hookCalls.length, 1, 'expected postBatchHook to be called once for initial batch');
        assert.equal(hookCalls[0].id, 'ycs_wrap_comments', 'expected hook to receive ycs_wrap_comments wrapper');
    } finally {
        teardownRoot(root);
    }
});

test('Case H: renderComment invokes postBatchHook again on show-more click', () => {
    resetGlobalStore();
    const root = setupRoot();
    try {
        const replies: Array<{ item: Record<string, any>; refIndex: number }> = [];
        for (let i = 1; i <= 250; i += 1) {
            const parent = buildParentComment(`c${i}`, `parent${i}`);
            replies.push({ item: buildReplyComment(`c${i}r1`, `reply${i}`, parent, i), refIndex: i });
        }

        const hookCalls: HTMLElement[] = [];
        const spy = (batchRoot: HTMLElement): void => {
            hookCalls.push(batchRoot);
        };

        renderComment(root, replies, {
            querySearch: '',
            postBatchHook: spy
        });

        assert.equal(hookCalls.length, 1, 'expected one hook call after initial batch (200 items)');

        const showMore = root.querySelector('#ycs_search_show_more') as HTMLElement;
        assert.equal(showMore !== null, true, 'expected show-more button to exist when results exceed batch size');

        showMore.click();

        assert.equal(hookCalls.length, 2, 'expected second hook call after show-more click');
        assert.equal(
            hookCalls[1].id !== 'ycs_wrap_comments',
            true,
            'expected second hook to receive a fresh batch wrapper, not the main wrapper'
        );
    } finally {
        teardownRoot(root);
    }
});

test('Case J: autoExpandAllRepliesIn defers all work to next frames and completes across chunks', async () => {
    resetGlobalStore();
    const root = setupRoot();
    try {
        const replies: Array<Record<string, any>> = [];
        for (let i = 1; i <= 12; i += 1) {
            const parent = buildParentComment(`c${i}`, `p${i}`);
            replies.push(buildReplyComment(`c${i}r1`, `r${i}`, parent, i));
            root.appendChild(buildReplyContainer(`c${i}r1`, i));
        }

        (GlobalStore as any).autoExpandReplyContext = true;
        autoExpandAllRepliesIn(root, buildDeps(replies));

        const immediateWrappers = root.querySelectorAll('[id^="ycs-com-all-"]').length;
        assert.equal(
            immediateWrappers,
            0,
            `expected 0 wrappers synchronously so filter click paints before expand work starts, got ${immediateWrappers}`
        );

        await flushFrames(200);

        const finalWrappers = root.querySelectorAll('[id^="ycs-com-all-"]').length;
        assert.equal(
            finalWrappers,
            12,
            `expected all 12 wrappers after frames flush, got ${finalWrappers}`
        );
    } finally {
        teardownRoot(root);
    }
});

test('Case I: renderComment + postBatchHook wiring auto-expands replies end-to-end', async () => {
    resetGlobalStore();
    const root = setupRoot();
    try {
        const parent = buildParentComment('c1', 'parent text');
        const reply = buildReplyComment('c1r1', 'reply text', parent, 1);
        const stateAccessor: CommentStateAccessor = { getComments: () => [reply] };

        (GlobalStore as any).autoExpandReplyContext = true;

        renderComment(root, [{ item: reply, refIndex: 1 }], {
            querySearch: '',
            postBatchHook: (batchRoot: HTMLElement) => {
                autoExpandAllRepliesIn(batchRoot, {
                    stateAccessor,
                    queryGetter: () => ''
                });
            }
        });
        await flushFrames();

        const wrapper = root.querySelector('#ycs-com-all-c1r1');
        assert.equal(
            wrapper !== null,
            true,
            'expected origin chain wrapper after end-to-end renderComment + postBatchHook + autoExpandAllRepliesIn'
        );
    } finally {
        teardownRoot(root);
    }
});

test('Case F: expandOriginChainFor sets ycs-origin-trigger class on success', () => {
    resetGlobalStore();
    const root = setupRoot();
    try {
        const parent = buildParentComment('c1', 'parent text');
        const reply = buildReplyComment('c1r1', 'reply text', parent, 1);
        const container = buildReplyContainer('c1r1', 1);
        root.appendChild(container);

        const result = expandOriginChainFor(container, buildDeps([reply]));
        assert.equal(result, true, 'expected expandOriginChainFor to return true on success');
        assert.equal(
            container.classList.contains('ycs-origin-trigger'),
            true,
            'expected ycs-origin-trigger class on container'
        );
        assert.equal(
            root.querySelector('#ycs-com-all-c1r1') !== null,
            true,
            'expected wrapper to be inserted'
        );
    } finally {
        teardownRoot(root);
    }
});
