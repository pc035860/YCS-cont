import { strict as assert } from 'node:assert';
import test from 'node:test';

import { createSearchIntentState } from '../src/source/web-resources/features/searchIntentState';

test('isIntentActive returns false by default', () => {
    const state = createSearchIntentState();

    assert.equal(
        state.isIntentActive({
            query: '',
            hasActiveFilter: false,
            isCollapsed: false
        }),
        false
    );
});

test('query without executing search does not hide native comments', () => {
    const state = createSearchIntentState();

    assert.equal(
        state.isIntentActive({
            query: 'hello',
            hasActiveFilter: false,
            isCollapsed: false
        }),
        false
    );
});

test('executed text search keeps intent active', () => {
    const state = createSearchIntentState();
    state.markSearchExecuted();

    assert.equal(
        state.isIntentActive({
            query: 'hello',
            hasActiveFilter: false,
            isCollapsed: false
        }),
        true
    );
});

test('active filter keeps intent active even when query is empty', () => {
    const state = createSearchIntentState();

    assert.equal(
        state.isIntentActive({
            query: '',
            hasActiveFilter: true,
            isCollapsed: false
        }),
        true
    );
});

test('resetExecution explicitly clears execution state', () => {
    const state = createSearchIntentState();
    state.markSearchExecuted();
    state.resetExecution();

    assert.equal(
        state.isIntentActive({
            query: 'hello',
            hasActiveFilter: false,
            isCollapsed: false
        }),
        false
    );
});

test('query with only whitespace is treated as empty', () => {
    const state = createSearchIntentState();
    state.markSearchExecuted();

    assert.equal(
        state.isIntentActive({
            query: '   ',
            hasActiveFilter: false,
            isCollapsed: false
        }),
        false
    );
});

test('clearing query and filter resets execution state', () => {
    const state = createSearchIntentState();
    state.markSearchExecuted();

    assert.equal(
        state.isIntentActive({
            query: 'hello',
            hasActiveFilter: false,
            isCollapsed: false
        }),
        true
    );

    assert.equal(
        state.isIntentActive({
            query: '',
            hasActiveFilter: false,
            isCollapsed: false
        }),
        false
    );

    assert.equal(
        state.isIntentActive({
            query: 'hello',
            hasActiveFilter: false,
            isCollapsed: false
        }),
        false
    );
});

test('collapsed app always disables intent visibility effect', () => {
    const state = createSearchIntentState();
    state.markSearchExecuted();

    assert.equal(
        state.isIntentActive({
            query: 'hello',
            hasActiveFilter: false,
            isCollapsed: true
        }),
        false
    );

    assert.equal(
        state.isIntentActive({
            query: '',
            hasActiveFilter: true,
            isCollapsed: true
        }),
        false
    );
});
