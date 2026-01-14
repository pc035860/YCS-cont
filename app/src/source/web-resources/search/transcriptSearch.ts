import Fuse from '../../../../node_modules/fuse.js/dist/fuse';

import { buildKeysSignature, buildOptionsSignature, cloneFuseOptions } from './fuseCacheUtils';

import { filterLinksTrpVideoComments } from '../../utils/filters/comments';
import { ICommentsFuseResult, IParamSearch, ISelectedSort } from '../../utils/interfaces/i_types';
import { wrapTryCatch } from '../../utils/common';
import { getCommentsTrVideo, WebResourcesState } from '../state';
import { SearchContext } from './types';

export interface SearchButtonState {
    title?: string;
    label?: string;
    dataset?: Record<string, string>;
}

export interface TranscriptSearchResult {
    results: ICommentsFuseResult[];
    total: number;
    summary: string;
    query: string;
    buttonStates: Record<string, SearchButtonState>;
}

const UNSUPPORTED_SORTS: ISelectedSort[] = [
    'most_likes',
    'least_likes',
    'most_replies',
    'least_replies',
    'author_az',
    'author_za'
];

const UNSUPPORTED_FILTERS: (keyof IParamSearch)[] = [
    'heart',
    'random',
    'author',
    'donated',
    'members',
    'verified',
    'origin',
    'emoji'
];

// Fuse cache for the full cueGroups array (subsets still use transient instances).
interface TranscriptFuseCache<T> {
    instance: Fuse<T>;
    dataRef: T[];
    dataLength: number;
    keysSig: string;
    optionsSig: string;
}

let transcriptFuseCache: TranscriptFuseCache<any> | null = null;

function getTranscriptFuseInstance<T>(base: T[], options: Fuse.IFuseOptions<any>): Fuse<T> {
    const keysSig = buildKeysSignature(options.keys);
    const optionsSig = buildOptionsSignature(options);
    if (
        transcriptFuseCache &&
        transcriptFuseCache.dataRef === base &&
        transcriptFuseCache.dataLength === base.length &&
        transcriptFuseCache.keysSig === keysSig &&
        transcriptFuseCache.optionsSig === optionsSig
    ) {
        return transcriptFuseCache.instance as Fuse<T>;
    }

    const instance = new Fuse<T>(base, options);
    transcriptFuseCache = { instance: instance as any, dataRef: base, dataLength: base.length, keysSig, optionsSig };
    return instance;
}

export function clearTranscriptFuseCache(): void {
    transcriptFuseCache = null;
}

function mapTranscriptResults(raw: readonly Fuse.FuseResult<any>[]): ICommentsFuseResult[] {
    return raw.map((result) => ({
        item: result.item,
        refIndex:
            wrapTryCatch(
                () => result.item?.transcriptCueGroupRenderer?.cues?.[0]?.transcriptCueRenderer?.startOffsetMs
            ) || 0,
        score: result.score
    }));
}

function filterByMatches(results: ICommentsFuseResult[], matches: Set<any> | null): ICommentsFuseResult[] {
    if (!matches) return results;
    return results.filter((entry) => matches.has(entry.item));
}

export function runSearch(
    query: string,
    filters: IParamSearch | undefined,
    state: WebResourcesState,
    context: SearchContext
): TranscriptSearchResult {
    const trimmedQuery = query?.trim?.() ?? '';
    const param = filters ?? {};

    if (UNSUPPORTED_FILTERS.some((key) => Boolean(param[key as keyof IParamSearch]))) {
        return {
            results: [],
            total: 0,
            summary: '(Tr. video) Found: 0',
            query: trimmedQuery,
            buttonStates: {}
        };
    }

    const commentsTrVideo = getCommentsTrVideo(state);
    const cueGroups = wrapTryCatch(
        () =>
            commentsTrVideo?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.body
                ?.transcriptBodyRenderer?.cueGroups
    ) as any[] | undefined;

    if (!Array.isArray(cueGroups) || cueGroups.length === 0) {
        return {
            results: [],
            total: 0,
            summary: '(Tr. video) Found: 0',
            query: trimmedQuery,
            buttonStates: {}
        };
    }

    let fuseOptions = cloneFuseOptions();
    let fuseKeys = [
        'transcriptCueGroupRenderer.cues.transcriptCueRenderer.cue.simpleText',
        'transcriptCueGroupRenderer.formattedStartOffset.simpleText'
    ];

    if (context.extendedSearch.enabled) {
        fuseOptions = cloneFuseOptions();
        fuseOptions.useExtendedSearch = true;

        if (context.extendedSearch.title) {
            fuseKeys = ['transcriptCueGroupRenderer.formattedStartOffset.simpleText'];
        }

        if (context.extendedSearch.main) {
            fuseKeys = ['transcriptCueGroupRenderer.cues.transcriptCueRenderer.cue.simpleText'];
        }
    }

    const options: Fuse.IFuseOptions<any> = {
        ...fuseOptions,
        keys: fuseKeys
    };

    const matches: Set<any> | null = trimmedQuery
        ? new Set(
              getTranscriptFuseInstance<any>(cueGroups, options)
                  .search(trimmedQuery)
                  .map((entry) => entry.item)
          )
        : null;

    const buttonStates: Record<string, SearchButtonState> = {};
    let resultSearch: ICommentsFuseResult[] = [];

    if (trimmedQuery) {
        const fuse = getTranscriptFuseInstance<any>(cueGroups, options);
        resultSearch = mapTranscriptResults(fuse.search(trimmedQuery));
    } else {
        // Handle empty query by returning all results
        resultSearch = mapTranscriptResults(
            cueGroups.map((item, index) => ({
                item,
                refIndex: index,
                score: 0
            }))
        );
        if (param.sortOrder === 'relevance') {
            // No such thing as sorting by relevance for empty query, default to newest
            param.sortOrder = 'newest';
        }
    }

    for (const key of Object.keys(param)) {
        switch (key) {
            case 'links':
                resultSearch = filterLinksTrpVideoComments(cueGroups) as ICommentsFuseResult[];
                resultSearch = filterByMatches(resultSearch, matches);
                break;
            case 'timestamp': {
                const mmRe = /^(\d{1,3})(?::(\d{1,2}))?$/;
                const match = mmRe.exec(trimmedQuery);

                if (match) {
                    const minutes = parseInt(match[1] || '0', 10);
                    const seconds = match[2] ? parseInt(match[2], 10) : undefined;
                    const fromMs = minutes * 60 * 1000 + (seconds ? seconds * 1000 : 0);
                    const toMs = seconds === undefined ? (minutes + 1) * 60 * 1000 : fromMs + 1000;

                    resultSearch = cueGroups
                        .filter((group: any) => {
                            const start = wrapTryCatch(
                                () => group?.transcriptCueGroupRenderer?.cues?.[0]?.transcriptCueRenderer?.startOffsetMs
                            ) as number;
                            return typeof start === 'number' && start >= fromMs && start < toMs;
                        })
                        .map((group: any) => ({
                            item: group,
                            refIndex:
                                wrapTryCatch(
                                    () =>
                                        group?.transcriptCueGroupRenderer?.cues?.[0]?.transcriptCueRenderer
                                            ?.startOffsetMs
                                ) || 0
                        }));
                }
                break;
            }
            default:
                break;
        }
    }

    if (resultSearch.length > 1) {
        if (param.sortOrder === 'oldest') {
            resultSearch.sort((a, b) => b.refIndex - a.refIndex);
        } else if (param.sortOrder === 'longest') {
            resultSearch.sort(
                (a, b) =>
                    (b.item as any).transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.cue.simpleText.length -
                    (a.item as any).transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.cue.simpleText.length
            );
        } else if (param.sortOrder === 'shortest') {
            resultSearch.sort(
                (a, b) =>
                    (a.item as any).transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.cue.simpleText.length -
                    (b.item as any).transcriptCueGroupRenderer.cues[0].transcriptCueRenderer.cue.simpleText.length
            );
        } else if (param.sortOrder === 'newest' || UNSUPPORTED_SORTS.some((key) => param.sortOrder === key)) {
            // Unsupported sorts default to newest
            resultSearch.sort((a, b) => a.refIndex - b.refIndex);
        }
    }

    const total = resultSearch.length;
    return {
        results: resultSearch,
        total,
        summary: `(Tr. video) Found: ${total}`,
        query: trimmedQuery,
        buttonStates
    };
}
