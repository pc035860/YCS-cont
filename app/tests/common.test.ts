import { strict as assert } from 'node:assert';
import test from 'node:test';

import { decodeHtml } from '../src/source/utils/common';

test('decodeHtml converts HTML entities to characters', () => {
    const raw = 'Fish &amp; Chips &copy; 2024 &#62;';
    const decoded = decodeHtml(raw);
    assert.equal(decoded, 'Fish & Chips © 2024 >');
});

test('decodeHtml leaves plain text untouched', () => {
    const raw = '>> Ready when you are';
    const decoded = decodeHtml(raw);
    assert.equal(decoded, raw);
});
