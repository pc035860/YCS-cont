import { strict as assert } from 'node:assert';
import test from 'node:test';

import { mergeFilterButtonsWithDefaults } from '../src/source/config/filterButtons';
import type { FilterButtonSetting } from '../src/source/config/filterButtons';

const defaults: FilterButtonSetting[] = [
    { id: 'a', enabled: true },
    { id: 'b', enabled: true },
    { id: 'c', enabled: false },
    { id: 'd', enabled: true }
];

test('non-array stored value returns a copy of defaults', () => {
    for (const stored of [undefined, null, {}, 'x']) {
        const result = mergeFilterButtonsWithDefaults(stored, defaults);
        assert.deepEqual(result, defaults);
        assert.notEqual(result, defaults);
    }
});

test('stored array with every default id is unchanged', () => {
    const stored = [
        { id: 'd', enabled: false },
        { id: 'b', enabled: true },
        { id: 'a', enabled: false },
        { id: 'c', enabled: true }
    ];
    assert.deepEqual(mergeFilterButtonsWithDefaults(stored, defaults), stored);
});

test('missing middle id is inserted after its preceding default neighbor', () => {
    const stored = [
        { id: 'a', enabled: true },
        { id: 'c', enabled: false },
        { id: 'd', enabled: true }
    ];
    assert.deepEqual(
        mergeFilterButtonsWithDefaults(stored, defaults).map((b) => b.id),
        ['a', 'b', 'c', 'd']
    );
});

test('consecutive missing ids keep default order and the stored array is not mutated', () => {
    const stored = [
        { id: 'd', enabled: true },
        { id: 'a', enabled: true }
    ];
    const snapshot = structuredClone(stored);
    assert.deepEqual(
        mergeFilterButtonsWithDefaults(stored, defaults).map((b) => b.id),
        ['d', 'a', 'b', 'c']
    );
    assert.deepEqual(stored, snapshot);
});

test('missing first id is inserted at index 0', () => {
    const stored = [
        { id: 'c', enabled: true },
        { id: 'b', enabled: true },
        { id: 'd', enabled: true }
    ];
    assert.deepEqual(mergeFilterButtonsWithDefaults(stored, defaults), [{ id: 'a', enabled: true }, ...stored]);
});

test('inserted id follows its neighbor in user order, keeping user flags and its default enabled', () => {
    const stored = [
        { id: 'd', enabled: false },
        { id: 'a', enabled: false },
        { id: 'b', enabled: true }
    ];
    assert.deepEqual(mergeFilterButtonsWithDefaults(stored, defaults), [
        { id: 'd', enabled: false },
        { id: 'a', enabled: false },
        { id: 'b', enabled: true },
        { id: 'c', enabled: false }
    ]);
});

test('unknown stored ids are kept in place', () => {
    const stored = [
        { id: 'legacy', enabled: true },
        { id: 'a', enabled: true },
        { id: 'c', enabled: false },
        { id: 'd', enabled: true }
    ];
    assert.deepEqual(
        mergeFilterButtonsWithDefaults(stored, defaults).map((b) => b.id),
        ['legacy', 'a', 'b', 'c', 'd']
    );
});
