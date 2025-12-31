import { strict as assert } from 'node:assert';
import test, { beforeEach, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    isMemberOnlyFromYtInitialData,
    isAgeRestrictedFromYtInitialData,
    normalizeYtInitialData,
    updateMemberOnlyStatus,
    updateAgeRestrictedStatus,
    updateAccessRestrictionStatus,
    setCurrentVideoMemberOnly,
    setCurrentVideoAgeRestricted,
    clearCurrentVideoMemberOnly,
    clearCurrentVideoAgeRestricted,
    shouldDisableAuth
} from '../src/source/utils/innertube/memberOnly';
import { GlobalStore } from '../src/source/utils/common';

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

// ============================================================================
// Group 1: Pure Functions - isAgeRestrictedFromYtInitialData
// ============================================================================

test('isAgeRestrictedFromYtInitialData - LOGIN_REQUIRED status', () => {
    const fixture = loadFixture('ytInitialData-age-restricted.json');
    const result = isAgeRestrictedFromYtInitialData(fixture);
    assert.equal(result, true, 'Should detect age-restricted video with LOGIN_REQUIRED status');
});

test('isAgeRestrictedFromYtInitialData - PBJ format LOGIN_REQUIRED', () => {
    const fixture = loadFixture('ytInitialData-age-restricted-pbj.json');
    const result = isAgeRestrictedFromYtInitialData(fixture);
    assert.equal(result, true, 'Should detect age-restricted video in PBJ format');
});

test('isAgeRestrictedFromYtInitialData - age gate reason only', () => {
    const fixture = loadFixture('ytInitialData-age-reason-only.json');
    const result = isAgeRestrictedFromYtInitialData(fixture);
    assert.equal(result, true, 'Should detect age-restricted video by reason containing "age"');
});

test('isAgeRestrictedFromYtInitialData - non-restricted video', () => {
    const fixture = loadFixture('ytInitialData-non-restricted.json');
    const result = isAgeRestrictedFromYtInitialData(fixture);
    assert.equal(result, false, 'Should return false for non-restricted video');
});

test('isAgeRestrictedFromYtInitialData - non-member video (not age-restricted)', () => {
    const fixture = loadFixture('ytInitialData-non-member.json');
    const result = isAgeRestrictedFromYtInitialData(fixture);
    assert.equal(result, false, 'Should return false for non-member video (not age-restricted)');
});

test('isAgeRestrictedFromYtInitialData - invalid input', () => {
    assert.equal(isAgeRestrictedFromYtInitialData(null), false, 'Should return false for null');
    assert.equal(isAgeRestrictedFromYtInitialData(undefined), false, 'Should return false for undefined');
    assert.equal(isAgeRestrictedFromYtInitialData('invalid'), false, 'Should return false for string');
    assert.equal(isAgeRestrictedFromYtInitialData({}), false, 'Should return false for empty object');
});

test('isAgeRestrictedFromYtInitialData - status exists but not LOGIN_REQUIRED and no age reason', () => {
    // Gemini suggestion: ensure no false positives
    const fixture = {
        playerResponse: {
            playabilityStatus: {
                status: 'UNPLAYABLE',
                reason: 'Video unavailable'
            }
        }
    };
    const result = isAgeRestrictedFromYtInitialData(fixture);
    assert.equal(result, false, 'Should return false when status is not LOGIN_REQUIRED and reason has no age keywords');
});

// ============================================================================
// Group 1: Pure Functions - normalizeYtInitialData
// ============================================================================

test('normalizeYtInitialData - PBJ format (object with response and playerResponse)', () => {
    const input = {
        response: { contents: { test: 'data' } },
        playerResponse: { playabilityStatus: { status: 'OK' } }
    };
    const result = normalizeYtInitialData(input);
    assert.ok(result, 'Should return a result');
    assert.ok(result.response || result.contents, 'Should preserve structure');
});

test('normalizeYtInitialData - legacy array format', () => {
    const input = [{ response: { test: 1 } }, { playerResponse: { test: 2 } }];
    const result = normalizeYtInitialData(input);
    assert.ok(result, 'Should return a result');
    // Array format should be merged
    assert.ok(result.response || result.playerResponse, 'Should merge array elements');
});

test('normalizeYtInitialData - already normalized object', () => {
    const input = { contents: { test: 'data' }, currentVideoEndpoint: {} };
    const result = normalizeYtInitialData(input);
    assert.deepEqual(result, input, 'Should return same object if already normalized');
});

test('normalizeYtInitialData - invalid input', () => {
    assert.equal(normalizeYtInitialData(null), null, 'Should return null for null input');
    assert.equal(normalizeYtInitialData(undefined), null, 'Should return null for undefined input (falsy check)');
    assert.equal(normalizeYtInitialData('string'), 'string', 'Should return string as-is');
});

// ============================================================================
// Helper function to reset GlobalStore
// ============================================================================

function resetGlobalStore(): void {
    delete (GlobalStore as any).isMemberOnly;
    delete (GlobalStore as any).isAgeRestricted;
}

// ============================================================================
// Group 2: GlobalStore Integration - updateMemberOnlyStatus
// ============================================================================

describe('updateMemberOnlyStatus', () => {
    beforeEach(() => {
        resetGlobalStore();
    });

    test('updateMemberOnlyStatus - sets GlobalStore.isMemberOnly to true for member-only video', () => {
        resetGlobalStore();
        const fixture = loadFixture('ytInitialData-member-only-1.json');
        const result = updateMemberOnlyStatus(fixture);

        assert.equal(result, true, 'Should return true');
        assert.equal((GlobalStore as any).isMemberOnly, true, 'Should set GlobalStore.isMemberOnly to true');
    });

    test('updateMemberOnlyStatus - sets GlobalStore.isMemberOnly to false for non-member video', () => {
        resetGlobalStore();
        const fixture = loadFixture('ytInitialData-non-member.json');
        const result = updateMemberOnlyStatus(fixture);

        assert.equal(result, false, 'Should return false');
        assert.equal((GlobalStore as any).isMemberOnly, false, 'Should set GlobalStore.isMemberOnly to false');
    });
});

// ============================================================================
// Group 2: GlobalStore Integration - updateAgeRestrictedStatus
// ============================================================================

describe('updateAgeRestrictedStatus', () => {
    beforeEach(() => {
        resetGlobalStore();
    });

    test('updateAgeRestrictedStatus - sets GlobalStore.isAgeRestricted to true for age-restricted video', () => {
        resetGlobalStore();
        const fixture = loadFixture('ytInitialData-age-restricted.json');
        const result = updateAgeRestrictedStatus(fixture);

        assert.equal(result, true, 'Should return true');
        assert.equal((GlobalStore as any).isAgeRestricted, true, 'Should set GlobalStore.isAgeRestricted to true');
    });

    test('updateAgeRestrictedStatus - sets GlobalStore.isAgeRestricted to false for non-restricted video', () => {
        resetGlobalStore();
        const fixture = loadFixture('ytInitialData-non-restricted.json');
        const result = updateAgeRestrictedStatus(fixture);

        assert.equal(result, false, 'Should return false');
        assert.equal((GlobalStore as any).isAgeRestricted, false, 'Should set GlobalStore.isAgeRestricted to false');
    });
});

// ============================================================================
// Group 2: GlobalStore Integration - shouldDisableAuth (Truth Table)
// ============================================================================

describe('shouldDisableAuth', () => {
    beforeEach(() => {
        resetGlobalStore();
    });

    test('shouldDisableAuth - returns false when both member-only and age-restricted', () => {
        resetGlobalStore();
        (GlobalStore as any).isMemberOnly = true;
        (GlobalStore as any).isAgeRestricted = true;

        assert.equal(shouldDisableAuth(), false, 'Should NOT disable auth (send auth for restricted)');
    });

    test('shouldDisableAuth - returns false when member-only only', () => {
        resetGlobalStore();
        (GlobalStore as any).isMemberOnly = true;
        (GlobalStore as any).isAgeRestricted = false;

        assert.equal(shouldDisableAuth(), false, 'Should NOT disable auth (send auth for member-only)');
    });

    test('shouldDisableAuth - returns false when age-restricted only', () => {
        resetGlobalStore();
        (GlobalStore as any).isMemberOnly = false;
        (GlobalStore as any).isAgeRestricted = true;

        assert.equal(shouldDisableAuth(), false, 'Should NOT disable auth (send auth for age-restricted)');
    });

    test('shouldDisableAuth - returns true when neither restricted', () => {
        resetGlobalStore();
        (GlobalStore as any).isMemberOnly = false;
        (GlobalStore as any).isAgeRestricted = false;

        assert.equal(shouldDisableAuth(), true, 'Should disable auth (no restriction)');
    });

    test('shouldDisableAuth - returns true when both undefined (not detected)', () => {
        resetGlobalStore();
        // Both are undefined after reset

        assert.equal(shouldDisableAuth(), true, 'Should disable auth (conservative fallback)');
    });

    test('shouldDisableAuth - returns false when member-only true and age-restricted undefined', () => {
        resetGlobalStore();
        (GlobalStore as any).isMemberOnly = true;
        // isAgeRestricted is undefined

        assert.equal(shouldDisableAuth(), false, 'Should NOT disable auth (member-only confirmed)');
    });

    test('shouldDisableAuth - returns false when member-only undefined and age-restricted true', () => {
        resetGlobalStore();
        // isMemberOnly is undefined
        (GlobalStore as any).isAgeRestricted = true;

        assert.equal(shouldDisableAuth(), false, 'Should NOT disable auth (age-restricted confirmed)');
    });
});

// ============================================================================
// Group 3: Set/Clear Functions
// ============================================================================

describe('setCurrentVideoMemberOnly / clearCurrentVideoMemberOnly', () => {
    beforeEach(() => {
        resetGlobalStore();
    });

    test('setCurrentVideoMemberOnly - sets to true', () => {
        resetGlobalStore();
        setCurrentVideoMemberOnly(true);
        assert.equal((GlobalStore as any).isMemberOnly, true);
    });

    test('setCurrentVideoMemberOnly - sets to false', () => {
        resetGlobalStore();
        setCurrentVideoMemberOnly(false);
        assert.equal((GlobalStore as any).isMemberOnly, false);
    });

    test('clearCurrentVideoMemberOnly - clears the value', () => {
        resetGlobalStore();
        setCurrentVideoMemberOnly(true);
        clearCurrentVideoMemberOnly();
        assert.equal((GlobalStore as any).isMemberOnly, undefined);
    });
});

describe('setCurrentVideoAgeRestricted / clearCurrentVideoAgeRestricted', () => {
    beforeEach(() => {
        resetGlobalStore();
    });

    test('setCurrentVideoAgeRestricted - sets to true', () => {
        resetGlobalStore();
        setCurrentVideoAgeRestricted(true);
        assert.equal((GlobalStore as any).isAgeRestricted, true);
    });

    test('setCurrentVideoAgeRestricted - sets to false', () => {
        resetGlobalStore();
        setCurrentVideoAgeRestricted(false);
        assert.equal((GlobalStore as any).isAgeRestricted, false);
    });

    test('clearCurrentVideoAgeRestricted - clears the value', () => {
        resetGlobalStore();
        setCurrentVideoAgeRestricted(true);
        clearCurrentVideoAgeRestricted();
        assert.equal((GlobalStore as any).isAgeRestricted, undefined);
    });
});

// ============================================================================
// Group 4: Unified Access Restriction Status
// ============================================================================

describe('updateAccessRestrictionStatus', () => {
    beforeEach(() => {
        resetGlobalStore();
    });

    test('updateAccessRestrictionStatus - member-only video sets both statuses', () => {
        resetGlobalStore();
        const fixture = loadFixture('ytInitialData-member-only-1.json');
        const result = updateAccessRestrictionStatus(fixture);

        assert.equal(result.isMemberOnly, true, 'Should return isMemberOnly: true');
        assert.equal(result.isAgeRestricted, false, 'Should return isAgeRestricted: false');
        assert.equal((GlobalStore as any).isMemberOnly, true, 'Should set GlobalStore.isMemberOnly to true');
        assert.equal((GlobalStore as any).isAgeRestricted, false, 'Should set GlobalStore.isAgeRestricted to false');
    });

    test('updateAccessRestrictionStatus - age-restricted video sets both statuses', () => {
        resetGlobalStore();
        const fixture = loadFixture('ytInitialData-age-restricted.json');
        const result = updateAccessRestrictionStatus(fixture);

        assert.equal(result.isMemberOnly, false, 'Should return isMemberOnly: false');
        assert.equal(result.isAgeRestricted, true, 'Should return isAgeRestricted: true');
        assert.equal((GlobalStore as any).isMemberOnly, false, 'Should set GlobalStore.isMemberOnly to false');
        assert.equal((GlobalStore as any).isAgeRestricted, true, 'Should set GlobalStore.isAgeRestricted to true');
    });

    test('updateAccessRestrictionStatus - non-restricted video sets both statuses to false', () => {
        resetGlobalStore();
        const fixture = loadFixture('ytInitialData-non-member.json');
        const result = updateAccessRestrictionStatus(fixture);

        assert.equal(result.isMemberOnly, false, 'Should return isMemberOnly: false');
        assert.equal(result.isAgeRestricted, false, 'Should return isAgeRestricted: false');
        assert.equal((GlobalStore as any).isMemberOnly, false, 'Should set GlobalStore.isMemberOnly to false');
        assert.equal((GlobalStore as any).isAgeRestricted, false, 'Should set GlobalStore.isAgeRestricted to false');
    });

    test('updateAccessRestrictionStatus - PBJ format member-only video', () => {
        resetGlobalStore();
        const fixture = loadFixture('ytInitialData-pbj-member-only.json');
        const result = updateAccessRestrictionStatus(fixture);

        assert.equal(result.isMemberOnly, true, 'Should return isMemberOnly: true');
        assert.equal(result.isAgeRestricted, false, 'Should return isAgeRestricted: false');
        assert.equal((GlobalStore as any).isMemberOnly, true, 'Should set GlobalStore.isMemberOnly to true');
    });

    test('updateAccessRestrictionStatus - PBJ format age-restricted video', () => {
        resetGlobalStore();
        const fixture = loadFixture('ytInitialData-age-restricted-pbj.json');
        const result = updateAccessRestrictionStatus(fixture);

        assert.equal(result.isMemberOnly, false, 'Should return isMemberOnly: false');
        assert.equal(result.isAgeRestricted, true, 'Should return isAgeRestricted: true');
        assert.equal((GlobalStore as any).isAgeRestricted, true, 'Should set GlobalStore.isAgeRestricted to true');
    });

    test('updateAccessRestrictionStatus - null input sets both to false', () => {
        resetGlobalStore();
        const result = updateAccessRestrictionStatus(null);

        assert.equal(result.isMemberOnly, false, 'Should return isMemberOnly: false for null input');
        assert.equal(result.isAgeRestricted, false, 'Should return isAgeRestricted: false for null input');
        assert.equal((GlobalStore as any).isMemberOnly, false, 'Should set GlobalStore.isMemberOnly to false');
        assert.equal((GlobalStore as any).isAgeRestricted, false, 'Should set GlobalStore.isAgeRestricted to false');
    });

    test('updateAccessRestrictionStatus - undefined input sets both to false', () => {
        resetGlobalStore();
        const result = updateAccessRestrictionStatus(undefined);

        assert.equal(result.isMemberOnly, false, 'Should return isMemberOnly: false for undefined input');
        assert.equal(result.isAgeRestricted, false, 'Should return isAgeRestricted: false for undefined input');
        assert.equal((GlobalStore as any).isMemberOnly, false, 'Should set GlobalStore.isMemberOnly to false');
        assert.equal((GlobalStore as any).isAgeRestricted, false, 'Should set GlobalStore.isAgeRestricted to false');
    });

    test('updateAccessRestrictionStatus - legacy array format member-only video', () => {
        resetGlobalStore();
        // Legacy array format: [{response: {...}}, {playerResponse: {...}}]
        const legacyArrayInput = [
            {
                response: {
                    currentVideoEndpoint: { watchEndpoint: { videoId: 'legacy-test-id' } },
                    contents: {
                        twoColumnWatchNextResults: {
                            results: {
                                results: {
                                    contents: [
                                        {
                                            videoPrimaryInfoRenderer: {
                                                badges: [
                                                    {
                                                        metadataBadgeRenderer: {
                                                            style: 'BADGE_STYLE_TYPE_MEMBERS_ONLY'
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            {
                playerResponse: {
                    playabilityStatus: { status: 'OK' }
                }
            }
        ];

        const result = updateAccessRestrictionStatus(legacyArrayInput);

        assert.equal(result.isMemberOnly, true, 'Should detect member-only from legacy array format');
        assert.equal(result.isAgeRestricted, false, 'Should not be age-restricted');
        assert.equal((GlobalStore as any).isMemberOnly, true, 'Should set GlobalStore.isMemberOnly to true');
        assert.equal((GlobalStore as any).isAgeRestricted, false, 'Should set GlobalStore.isAgeRestricted to false');
    });
});

