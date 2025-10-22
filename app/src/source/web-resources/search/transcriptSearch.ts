import Fuse from '../../../../node_modules/fuse.js/dist/fuse';

import { filterAllTrpVideoComments, filterLinksTrpVideoComments } from '../../utils/filters/comments';
import { ICommentsFuseResult, IParamSearch } from '../../utils/interfaces/i_types';
import { wrapTryCatch } from '../../utils/common';
import { getCommentsTrVideo, WebResourcesState } from '../state';
import { SearchContext } from './types';

export interface SearchButtonState {
    order?: 'newest' | 'oldest';
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

const BASE_FUSE_OPTIONS: Fuse.IFuseOptions<any> = {
    isCaseSensitive: false,
    findAllMatches: false,
    includeMatches: false,
    includeScore: true,
    ignoreLocation: true,
    useExtendedSearch: false,
    minMatchCharLength: 1,
    shouldSort: true,
    threshold: 0.15,
    distance: 100000
};

const UNSUPPORTED_FILTERS: (keyof IParamSearch)[] = [
    'heart',
    'likes',
    'replied',
    'random',
    'author',
    'donated',
    'members',
    'verified'
];

function cloneFuseOptions(): Fuse.IFuseOptions<any> {
    return JSON.parse(JSON.stringify(BASE_FUSE_OPTIONS));
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

function ensureSortOrder(order?: 'newest' | 'oldest'): 'newest' | 'oldest' {
    return order === 'oldest' ? 'oldest' : 'newest';
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
        ? new Set(new Fuse(cueGroups, options).search(trimmedQuery).map((entry) => entry.item))
        : null;

    const buttonStates: Record<string, SearchButtonState> = {};
    let resultSearch: ICommentsFuseResult[] = [];

    const updateButtonState = (
        id: string,
        order: 'newest' | 'oldest',
        title: string,
        label?: string,
        dataset?: Record<string, string>
    ): void => {
        buttonStates[id] = { order, title, label, dataset };
    };

    if (param.links) {
        resultSearch = filterLinksTrpVideoComments(cueGroups) as ICommentsFuseResult[];
        resultSearch = filterByMatches(resultSearch, matches);

        if (resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            const resolvedOrder = ensureSortOrder(param.sortOrder ?? context.sortOrders.transcript['ycs_btn_links']);
            if (resolvedOrder === 'newest') {
                if (trimmedQuery) {
                    const fuse = new Fuse(
                        resultSearch.map((entry) => entry.item),
                        options
                    );
                    resultSearch = mapTranscriptResults(fuse.search(trimmedQuery));
                }
            } else {
                if (trimmedQuery) {
                    const base = resultSearch.map((entry) => entry.item).reverse();
                    const fuse = new Fuse(base, options);
                    resultSearch = mapTranscriptResults(fuse.search(trimmedQuery));
                } else {
                    resultSearch = Array.from(resultSearch).reverse();
                }
            }

            updateButtonState(
                'ycs_btn_links',
                resolvedOrder,
                resolvedOrder === 'oldest'
                    ? 'Shows links in comments, replies, chat, video transcript (Oldest)'
                    : 'Shows links in comments, replies, chat, video transcript (Newest)',
                'Links'
            );
        }
    } else if (param.sortFirst) {
        resultSearch = (filterAllTrpVideoComments(cueGroups) as ICommentsFuseResult[]) || [];
        resultSearch = filterByMatches(resultSearch, matches);

        if (resultSearch.length > 0) {
            resultSearch.sort((a, b) => (a.refIndex || 0) - (b.refIndex || 0));

            const resolvedOrder = ensureSortOrder(
                param.sortOrder ?? context.sortOrders.transcript['ycs_btn_sort_first']
            );
            if (resolvedOrder === 'oldest') {
                resultSearch = Array.from(resultSearch).reverse();
            }

            updateButtonState(
                'ycs_btn_sort_first',
                resolvedOrder,
                resolvedOrder === 'oldest'
                    ? 'Show all comments, chat, video transcript sorted by date (Oldest)'
                    : 'Show all comments, chat, video transcript sorted by date (Newest)',
                'All'
            );
        }
    } else if (param.timestamp) {
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
                            () => group?.transcriptCueGroupRenderer?.cues?.[0]?.transcriptCueRenderer?.startOffsetMs
                        ) || 0
                }));

            const currentOrder = context.sortOrders.transcript['ycs_btn_timestamps'] ?? 'newest';
            if (currentOrder === 'oldest') {
                resultSearch = Array.from(resultSearch).reverse();
                updateButtonState(
                    'ycs_btn_timestamps',
                    'oldest',
                    'Show comments, replies, chat with time stamps (Oldest)',
                    'Time stamps',
                    { sortTrp: 'newest' }
                );
            } else {
                updateButtonState(
                    'ycs_btn_timestamps',
                    'newest',
                    'Show comments, replies, chat with time stamps (Newest)',
                    'Time stamps',
                    { sortTrp: 'oldest' }
                );
            }
        } else {
            const fuse = new Fuse(cueGroups, options);
            resultSearch = mapTranscriptResults(fuse.search(trimmedQuery));
        }
    } else {
        const fuse = new Fuse(cueGroups, options);
        resultSearch = mapTranscriptResults(fuse.search(trimmedQuery));
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
