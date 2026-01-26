/**
 * Transcript Loader Module
 *
 * Handles transcript loading functionality including:
 * - Loading transcript data with language preference
 * - Language selection dropdown menu
 * - Caching transcript data
 * - UI state management (button, status icons)
 */

import { extractChannelId, getVideoId } from '../../utils/common';
import { getTranscriptVideo, getTranscriptTracks } from '../../utils/innertube';
import type { TranscriptData, TranscriptTrackInfo, TranscriptCueGroup } from '../../utils/interfaces/i_types';
import { iconReload, iconOk } from '../../utils/icons';
import { buildCacheMeta } from '../helpers/cacheHelpers';
import { saveToCache, updateBadge } from '../services/cacheService';
import type {
    WebResourcesState,
    getCommentsTrVideo as GetCommentsTrVideoFn,
    setCommentsTrVideo as SetCommentsTrVideoFn,
    clearCommentsTrVideo as ClearCommentsTrVideoFn,
    getTranscriptTracks as GetStateTranscriptTracksFn,
    setTranscriptTracks as SetTranscriptTracksFn,
    getSelectedTranscriptLanguage as GetSelectedTranscriptLanguageFn,
    setSelectedTranscriptLanguage as SetSelectedTranscriptLanguageFn,
    getController as GetControllerFn,
    resetController as ResetControllerFn,
    getCounts as GetCountsFn,
    setCount as SetCountFn,
    getComments as GetCommentsFn,
    getCommentsChat as GetCommentsChatFn
} from '../state';

// ============================================
// Pure Helper Functions (No State Dependencies)
// ============================================

/**
 * Extract cue groups from transcript data structure
 * Deep property accessor that safely navigates nested YouTube transcript format
 */
export const extractCueGroups = (transcript?: TranscriptData | null): TranscriptCueGroup[] | undefined => {
    return transcript?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.body
        ?.transcriptBodyRenderer?.cueGroups as TranscriptCueGroup[] | undefined;
};

/**
 * Get the count of cue groups in transcript
 * Returns 0 if transcript is empty or invalid
 */
export const getCueGroupCount = (transcript?: TranscriptData | null): number => {
    return extractCueGroups(transcript)?.length ?? 0;
};

// ============================================
// Dependency Injection Interfaces
// ============================================

/**
 * State operation functions injected from appController
 */
export interface TranscriptLoaderStateDeps {
    getState: () => WebResourcesState;
    setState: (state: WebResourcesState) => void;
    getCommentsTrVideo: typeof GetCommentsTrVideoFn;
    setCommentsTrVideo: typeof SetCommentsTrVideoFn;
    clearCommentsTrVideo: typeof ClearCommentsTrVideoFn;
    getStateTranscriptTracks: typeof GetStateTranscriptTracksFn;
    setTranscriptTracks: typeof SetTranscriptTracksFn;
    getSelectedTranscriptLanguage: typeof GetSelectedTranscriptLanguageFn;
    setSelectedTranscriptLanguage: typeof SetSelectedTranscriptLanguageFn;
    getController: typeof GetControllerFn;
    resetController: typeof ResetControllerFn;
    getCounts: typeof GetCountsFn;
    setCount: typeof SetCountFn;
    getComments: typeof GetCommentsFn;
    getCommentsChat: typeof GetCommentsChatFn;
}

/**
 * DOM element references for transcript UI
 */
export interface TranscriptLoaderElements {
    elLiveApp: HTMLElement;
    elLoadTranscriptVideo: HTMLElement | null;
    elTranscriptLangButton: HTMLElement | null;
    elTranscriptLangMenu: HTMLElement | null;
}

/**
 * Callback functions for UI updates
 */
export interface TranscriptLoaderCallbacks {
    updateTitleCount: (count: number) => void;
    showLoadComments: (count: number, el: HTMLElement) => void;
    closeAllDropdowns: (except?: HTMLElement | null) => void;
    setMenuVisibility: (menu: HTMLElement | null, visible: boolean) => void;
}

/**
 * Combined dependencies for TranscriptLoader
 */
export interface TranscriptLoaderDeps {
    state: TranscriptLoaderStateDeps;
    elements: TranscriptLoaderElements;
    callbacks: TranscriptLoaderCallbacks;
}

// ============================================
// TranscriptLoader Class
// ============================================

/**
 * Handles transcript loading and language selection
 */
export class TranscriptLoader {
    private deps: TranscriptLoaderDeps;

    constructor(deps: TranscriptLoaderDeps) {
        this.deps = deps;
    }

    // ----------------------------------------
    // State accessors
    // ----------------------------------------

    private get state(): WebResourcesState {
        return this.deps.state.getState();
    }

    private set state(newState: WebResourcesState) {
        this.deps.state.setState(newState);
    }

    private get elements(): TranscriptLoaderElements {
        return this.deps.elements;
    }

    // ----------------------------------------
    // Public methods
    // ----------------------------------------

    /**
     * Load transcript data with optional language preference
     * @param trigger - The button element that triggered the load
     * @param languageCode - Optional language code to load
     * @param autogenerated - Optional flag to load autogenerated transcripts
     */
    async load(trigger: HTMLElement, languageCode?: string, autogenerated?: boolean): Promise<void> {
        const { elLiveApp } = this.elements;
        if (!elLiveApp.parentNode || !elLiveApp.parentElement) return;

        const startUrl = window.location.href;
        const startVideoId = getVideoId(startUrl);
        if (!startVideoId) return;

        const currentTarget = trigger as HTMLButtonElement;
        const defaultLabel = currentTarget.innerText;

        // Clear any cached label from dataset
        this.clearButtonLabelDataset(currentTarget);

        currentTarget.disabled = true;
        currentTarget.innerText = 'reload';

        try {
            const elStatusTrVideo = document.getElementById('ycs_status_trvideo');
            const elLoadTrVideo = document.getElementById('ycs_cmnts_video');

            if (elLoadTrVideo && elStatusTrVideo) {
                elLoadTrVideo.textContent = '0';
                elStatusTrVideo.innerHTML = iconReload();

                // Ensure controller is fresh - reset if previously aborted
                // This allows transcript loading to recover after an abort
                let controller = this.deps.state.getController(this.state);
                if (controller.signal.aborted) {
                    this.state = this.deps.state.resetController(this.state);
                    controller = this.deps.state.getController(this.state);
                }

                const normalizedLanguage = languageCode?.trim();
                const preferredLanguage =
                    normalizedLanguage || this.deps.state.getSelectedTranscriptLanguage(this.state);
                const tr = (await getTranscriptVideo(controller.signal, {
                    languageCode: preferredLanguage,
                    autogenerated
                })) as TranscriptData | undefined;

                this.state = this.deps.state.clearCommentsTrVideo(this.state);
                if (getCueGroupCount(tr) > 0) {
                    this.state = this.deps.state.setCommentsTrVideo(this.state, tr);
                }

                // Check if video changed during loading
                const currentVideoId = getVideoId(window.location.href);
                if (startVideoId && currentVideoId && startVideoId !== currentVideoId) {
                    console.warn(
                        '[YCS] Video changed during transcript loading, skipping cache save:',
                        startVideoId,
                        '→',
                        currentVideoId
                    );
                    return;
                }

                // Save to cache
                try {
                    const transcript = this.deps.state.getCommentsTrVideo(this.state);
                    const cueGroups = extractCueGroups(transcript);
                    if (transcript && elLoadTrVideo && cueGroups && cueGroups.length > 0) {
                        this.deps.callbacks.showLoadComments(cueGroups.length, elLoadTrVideo);
                        saveToCache(
                            {
                                videoId: startVideoId,
                                comments: this.deps.state.getComments(this.state),
                                commentsChat: JSON.stringify(
                                    Array.from(this.deps.state.getCommentsChat(this.state).entries())
                                ),
                                commentsTrVideo: transcript,
                                channelId: extractChannelId()
                            },
                            buildCacheMeta()
                        );
                    } else {
                        this.state = this.deps.state.clearCommentsTrVideo(this.state);
                    }
                } catch (err) {
                    console.error(err);
                    this.state = this.deps.state.clearCommentsTrVideo(this.state);
                }

                // Update status icon
                const transcript = this.deps.state.getCommentsTrVideo(this.state);
                if (getCueGroupCount(transcript) > 0) {
                    elStatusTrVideo.innerHTML = iconOk();
                }
            }

            // Update counts
            if (
                getCueGroupCount(this.deps.state.getCommentsTrVideo(this.state)) > 0 &&
                (elLiveApp.parentNode || elLiveApp.parentElement)
            ) {
                const transcript = this.deps.state.getCommentsTrVideo(this.state);
                this.state = this.deps.state.setCount(this.state, 'commentsTrVideo', getCueGroupCount(transcript));
            }

            const counts = this.deps.state.getCounts(this.state);
            const totalCount = counts.comments + counts.commentsChat + counts.commentsTrVideo;
            updateBadge('NUMBER_COMMENTS', totalCount);
            this.deps.callbacks.updateTitleCount(totalCount);
        } finally {
            currentTarget.disabled = false;
            currentTarget.innerText = defaultLabel;
        }
    }

    /**
     * Render the language selection dropdown menu
     * @param tracks - Available transcript tracks
     * @param selected - Currently selected language code
     */
    renderLanguageMenu(tracks: TranscriptTrackInfo[], selected?: string): void {
        const { elTranscriptLangMenu, elLoadTranscriptVideo } = this.elements;
        if (!elTranscriptLangMenu) return;

        elTranscriptLangMenu.innerHTML = '';

        if (!tracks.length) {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'ycs_dropdown_item ycs_disabled';
            emptyItem.textContent = 'No languages available';
            elTranscriptLangMenu.appendChild(emptyItem);
            return;
        }

        const createItem = (track: TranscriptTrackInfo | undefined, label: string, value?: string) => {
            const item = document.createElement('div');
            item.className = 'ycs_dropdown_item';
            item.dataset.value = value ?? '';
            item.textContent = label;
            if ((value ?? '') === (selected ?? '')) {
                item.classList.add('ycs_dropdown_item--active');
            }
            item.addEventListener('click', () => {
                const normalizedValue = value?.trim();
                const nextLanguage = normalizedValue ? normalizedValue : undefined;
                this.state = this.deps.state.setSelectedTranscriptLanguage(this.state, nextLanguage);
                this.deps.callbacks.closeAllDropdowns();
                this.deps.callbacks.setMenuVisibility(elTranscriptLangMenu, false);
                if (elLoadTranscriptVideo instanceof HTMLElement) {
                    this.load(elLoadTranscriptVideo, nextLanguage, track?.isAutoGenerated).catch((err) =>
                        console.error(err)
                    );
                }
            });
            return item;
        };

        // Add default option
        const preferredLanguage = this.deps.state.getSelectedTranscriptLanguage(this.state);
        const preferredOption = createItem(undefined, 'Default (YouTube / options)', preferredLanguage);
        elTranscriptLangMenu.appendChild(preferredOption);

        // Add language options
        tracks.forEach((track) => {
            const code = track.languageCode ?? '';
            const labelParts = [track.displayName || code];
            if (track.isAutoGenerated) {
                labelParts.push('(auto)');
            }
            if (code && !labelParts.includes(code)) {
                labelParts.push(`[${code}]`);
            }
            const label = labelParts.join(' ');
            const item = createItem(track, label, code);
            elTranscriptLangMenu.appendChild(item);
        });
    }

    /**
     * Set up the language dropdown button handler
     * @param button - The dropdown trigger button
     */
    setupLanguageDropdown(button: HTMLElement): void {
        const { elTranscriptLangMenu } = this.elements;

        const toggleMenu = () => {
            if (!elTranscriptLangMenu) return;
            const shouldShow = !elTranscriptLangMenu.classList.contains('show');
            this.deps.callbacks.closeAllDropdowns(elTranscriptLangMenu);
            this.deps.callbacks.setMenuVisibility(elTranscriptLangMenu, shouldShow);
        };

        const ensureTracks = async () => {
            // Ensure controller is fresh - reset if previously aborted
            let controller = this.deps.state.getController(this.state);
            if (controller.signal.aborted) {
                this.state = this.deps.state.resetController(this.state);
                controller = this.deps.state.getController(this.state);
            }

            let tracks = this.deps.state.getStateTranscriptTracks(this.state) ?? [];
            const selectedLanguage = this.deps.state.getSelectedTranscriptLanguage(this.state);

            if (!tracks.length) {
                const fetched = await getTranscriptTracks(controller.signal);
                tracks = fetched ?? [];
                this.state = this.deps.state.setTranscriptTracks(this.state, tracks);
            }
            this.renderLanguageMenu(tracks, selectedLanguage);
        };

        button.addEventListener('click', () => {
            const buttonElement = button as HTMLButtonElement;
            const originalText = buttonElement.innerText;
            const originalDisabled = buttonElement.disabled;

            // Set loading state
            buttonElement.disabled = true;
            buttonElement.innerText = 'loading...';

            ensureTracks()
                .then(() => {
                    buttonElement.disabled = originalDisabled;
                    buttonElement.innerText = originalText;
                    toggleMenu();
                })
                .catch((err) => {
                    console.error('Failed to load transcript tracks', err);
                    buttonElement.disabled = originalDisabled;
                    buttonElement.innerText = originalText;
                    const selectedLanguage = this.deps.state.getSelectedTranscriptLanguage(this.state);
                    this.renderLanguageMenu([], selectedLanguage);
                    toggleMenu();
                });
        });
    }

    // ----------------------------------------
    // Private helpers
    // ----------------------------------------

    /**
     * Clear the dataset label from button (used by cacheHelpers)
     */
    private clearButtonLabelDataset(button: HTMLButtonElement): void {
        if (button.dataset.label) {
            delete button.dataset.label;
        }
    }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create and initialize a TranscriptLoader instance
 * Sets up event listeners for load button and language dropdown
 */
export function createTranscriptLoader(deps: TranscriptLoaderDeps): TranscriptLoader {
    const loader = new TranscriptLoader(deps);
    const { elLoadTranscriptVideo, elTranscriptLangButton } = deps.elements;

    // Set up load button click handler
    if (elLoadTranscriptVideo) {
        elLoadTranscriptVideo.addEventListener('click', async function (e: MouseEvent): Promise<void> {
            const currentTarget = e.currentTarget as HTMLButtonElement;
            const selectedLanguage = deps.state.getSelectedTranscriptLanguage(deps.state.getState());
            await loader.load(currentTarget, selectedLanguage);
        });
    }

    // Set up language dropdown handler
    if (elTranscriptLangButton) {
        loader.setupLanguageDropdown(elTranscriptLangButton);
    }

    return loader;
}
