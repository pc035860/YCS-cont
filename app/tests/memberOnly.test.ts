import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMemberOnlyFromYtInitialData } from '../src/source/utils/innertube/memberOnly';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadFixture(name: string): unknown {
    const fixturePath = join(__dirname, 'fixtures', name);
    const content = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(content);
}

test('isMemberOnlyFromYtInitialData - member only video (primary info)', () => {
    const fixture = loadFixture('ytInitialData-member-only-1.json');
    const result = isMemberOnlyFromYtInitialData(fixture);
    assert.equal(result, true, 'Should detect members-only badge in videoPrimaryInfoRenderer');
});

test('isMemberOnlyFromYtInitialData - member only video (videoRenderer)', () => {
    const fixture = loadFixture('ytInitialData-member-only-2.json');
    const result = isMemberOnlyFromYtInitialData(fixture);
    assert.equal(result, true, 'Should detect members-only badge in videoRenderer');
});

test('isMemberOnlyFromYtInitialData - non-member video', () => {
    const fixture = loadFixture('ytInitialData-non-member.json');
    const result = isMemberOnlyFromYtInitialData(fixture);
    assert.equal(result, false, 'Should return false for non-member video');
});

test('isMemberOnlyFromYtInitialData - invalid input', () => {
    assert.equal(isMemberOnlyFromYtInitialData(null), false, 'Should return false for null');
    assert.equal(isMemberOnlyFromYtInitialData(undefined), false, 'Should return false for undefined');
    assert.equal(isMemberOnlyFromYtInitialData('invalid'), false, 'Should return false for string');
    assert.equal(isMemberOnlyFromYtInitialData({}), false, 'Should return false for empty object');
});

test('isMemberOnlyFromYtInitialData - missing videoId', () => {
    const fixture = { contents: {} };
    const result = isMemberOnlyFromYtInitialData(fixture);
    assert.equal(result, false, 'Should return false when videoId is missing');
});

test('isMemberOnlyFromYtInitialData - PBJ format member only video', () => {
    const fixture = loadFixture('ytInitialData-pbj-member-only.json');
    const result = isMemberOnlyFromYtInitialData(fixture);
    assert.equal(result, true, 'Should detect members-only badge in PBJ format response.videoPrimaryInfoRenderer');
});

test('isMemberOnlyFromYtInitialData - PBJ format non-member video', () => {
    const fixture = loadFixture('ytInitialData-pbj-non-member.json');
    const result = isMemberOnlyFromYtInitialData(fixture);
    assert.equal(result, false, 'Should return false for non-member video in PBJ format');
});

