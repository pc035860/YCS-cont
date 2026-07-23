import type { CommentItem } from '../interfaces/i_types';
import { fetchCommentThreadsSearch } from './client';
import { transformThreadToCommentItems } from './transform';

export interface InstantSearchPage {
    items: CommentItem[];
    nextPageToken?: string;
    totalResults?: number;
}

export async function fetchCommentSearchPage(options: {
    videoId: string;
    searchTerms: string;
    apiKey: string;
    pageToken?: string;
    signal?: AbortSignal;
}): Promise<InstantSearchPage> {
    const response = await fetchCommentThreadsSearch(options);

    const items: CommentItem[] = [];
    for (const thread of response.items ?? []) {
        items.push(...transformThreadToCommentItems(thread, options.videoId));
    }

    return {
        items,
        nextPageToken: response.nextPageToken,
        totalResults: response.pageInfo?.totalResults
    };
}
