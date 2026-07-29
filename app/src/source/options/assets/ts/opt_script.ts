import { options } from '../../../config/options';
import { formatBytes } from '../../../utils/formatting';
import { isNumeric } from '../../../utils/common';
import { idb } from '../../../utils/libs';

import { IStorageEstimate } from '../../../utils/interfaces/i_types';
import { shouldSkipAutoloadFromStorage } from '../../../web-resources/search/instantSearchGate';

const STORE_CACHE_YCS = 'STORE_CACHE_YCS';

window.onload = async (): Promise<void> => {
    try {
        const setRenderAutoloadOpt = (param: boolean): void => {
            if (typeof param !== 'boolean') return;

            (document.getElementById('y_opts_autoload') as HTMLInputElement).checked = param;
            updateAutoloadInstantVisual();
        };

        const optSetAutoload = async (opt: HTMLInputElement): Promise<void> => {
            try {
                // const opts = JSON.parse(localStorage.getItem('ycs_options') as string);
                // opts.autoload = opt.checked;

                await chrome.storage.local.set({
                    autoload: opt.checked
                });

                // const jsonOpts = JSON.stringify(opts);

                // localStorage.setItem('ycs_options', jsonOpts);
            } catch (err) {
                console.error(err);
            }
        };

        const setRenderHighlightTextOpt = (param: boolean): void => {
            if (typeof param !== 'boolean') return;

            (document.getElementById('y_opts_highlight') as HTMLInputElement).checked = param;
            const group = document.getElementById('ycs-highlight-group');
            group?.classList.toggle('ycs_group--enabled', param);
        };

        const optSetHighlightText = async (opt: HTMLInputElement): Promise<void> => {
            try {
                // const opts = JSON.parse(localStorage.getItem('ycs_options') as string);
                // opts.highlightText = opt.checked;

                await chrome.storage.local.set({
                    highlightText: opt.checked
                });

                // update UI state immediately
                setRenderHighlightTextOpt(opt.checked);

                // const jsonOpts = JSON.stringify(opts);
                // localStorage.setItem('ycs_options', jsonOpts);
            } catch (err) {
                console.error(err);
            }
        };

        const setRenderHighlightExact = (param: boolean): void => {
            if (typeof param !== 'boolean') return;

            (document.getElementById('y_opts_highlight_exact') as HTMLInputElement).checked = param;
        };

        const optSetHighlightExact = async (opt: HTMLInputElement): Promise<void> => {
            try {
                await chrome.storage.local.set({
                    highlightExact: opt.checked
                });
            } catch (err) {
                console.error(err);
            }
        };

        const setRenderCacheOpt = (param: boolean): void => {
            if (typeof param !== 'boolean') return;

            (document.getElementById('y_opts_cache') as HTMLInputElement).checked = param;
        };

        const setRenderHiddenByDefault = (param: boolean): void => {
            if (typeof param !== 'boolean') return;

            (document.getElementById('y_opts_hidden_by_default') as HTMLInputElement).checked = param;
        };

        const optSetSortTimestamp = async (opt: HTMLInputElement): Promise<void> => {
            try {
                await chrome.storage.local.set({
                    sortTimestamp: opt.checked
                });
            } catch (err) {
                console.error(err);
            }
        };

        const setRenderSortTimestampOpt = (param: boolean): void => {
            if (typeof param !== 'boolean') return;

            (document.getElementById('y_opts_sort_timestamp') as HTMLInputElement).checked = param;
        };

        const setRenderAutoExpandReplyContext = (param: unknown): void => {
            (document.getElementById('y_opts_auto_expand_reply_context') as HTMLInputElement).checked = !!param;
        };

        const optSetAutoExpandReplyContext = async (opt: HTMLInputElement): Promise<void> => {
            try {
                await chrome.storage.local.set({
                    autoExpandReplyContext: opt.checked
                });
            } catch (err) {
                console.error(err);
            }
        };

        const setRenderSidebarByDefault = (param: boolean): void => {
            if (typeof param !== 'boolean') return;
            (document.getElementById('y_opts_sidebar_by_default') as HTMLInputElement).checked = param;
        };

        const optSetSidebarByDefault = async (opt: HTMLInputElement): Promise<void> => {
            try {
                await chrome.storage.local.set({
                    sidebarByDefault: opt.checked
                });
            } catch (err) {
                console.error(err);
            }
        };

        const setRenderShowSidebarToggle = (param: boolean): void => {
            if (typeof param !== 'boolean') return;
            (document.getElementById('y_opts_show_sidebar_toggle') as HTMLInputElement).checked = param;
        };

        const optSetShowSidebarToggle = async (opt: HTMLInputElement): Promise<void> => {
            try {
                await chrome.storage.local.set({
                    showSidebarToggle: opt.checked
                });
            } catch (err) {
                console.error(err);
            }
        };

        const setRenderHiddenByDefaultShorts = (param: boolean): void => {
            if (typeof param !== 'boolean') return;

            (document.getElementById('y_opts_hidden_by_default_shorts') as HTMLInputElement).checked = param;
        };

        const setRenderEnableShortsSupport = (param: boolean): void => {
            if (typeof param !== 'boolean') return;

            (document.getElementById('y_opts_enable_shorts_support') as HTMLInputElement).checked = param;
            const group = document.getElementById('ycs-shorts-group');
            group?.classList.toggle('ycs_group--enabled', param);
            updateShortsSupportDependents(param);
        };

        const updateShortsSupportDependents = (enabled: boolean): void => {
            const subgroup = document.querySelector('#ycs-shorts-group .ycs_group_subgroup') as HTMLElement | null;
            const hiddenByDefaultShorts = document.getElementById(
                'y_opts_hidden_by_default_shorts'
            ) as HTMLInputElement | null;

            if (subgroup) {
                subgroup.classList.toggle('ycs_group_subgroup--disabled', !enabled);
            }
            if (hiddenByDefaultShorts) {
                hiddenByDefaultShorts.disabled = !enabled;
            }
        };

        const setRenderTranscriptLanguage = (param?: string): void => {
            const select = document.getElementById('y_opts_transcript_language_select') as HTMLSelectElement | null;
            const input = document.getElementById('y_opts_transcript_language') as HTMLInputElement | null;

            if (!select || !input) return;

            const value = param ?? '';

            // Check if value matches any select option
            const matchingOption = Array.from(select.options).find((option) => option.value === value);

            if (matchingOption) {
                // Value matches a select option, select it and clear input
                select.value = value;
                input.value = '';
            } else {
                // Value doesn't match any option, clear select and put in input
                select.value = '';
                input.value = value;
            }
        };

        const optSetTranscriptLanguage = async (value: string): Promise<void> => {
            try {
                await chrome.storage.local.set({
                    transcriptLanguage: value
                });
            } catch (err) {
                console.error(err);
            }
        };

        const setRenderMaxComments = (param: number): void => {
            const input = document.getElementById('y_opts_max_comments_input') as HTMLInputElement | null;
            if (!input) return;
            input.valueAsNumber = param ?? 500000;
        };

        const optSetMaxComments = async (e: Event): Promise<void> => {
            try {
                const value = (e.target as HTMLInputElement).valueAsNumber;
                await chrome.storage.local.set({
                    maxComments: value
                });
            } catch (err) {
                console.error(err);
            }
        };

        // YouTube Data API handlers
        let currentApiEnabled = true;
        let currentApiKey = '';
        let currentInstantSearch = true;

        const AUTOLOAD_INSTANT_TOOLTIP =
            'When instant search is enabled, comments are not auto-loaded on new videos. Cached videos still restore automatically.';

        const updateAutoloadInstantVisual = (): void => {
            const autoloadCheckbox = document.getElementById('y_opts_autoload') as HTMLInputElement | null;
            const autoloadWrap = document.getElementById('y_opts_autoload_wrap');
            if (!autoloadCheckbox || !autoloadWrap) return;

            const instantActive = shouldSkipAutoloadFromStorage({
                youtubeApiKey: currentApiKey,
                youtubeApiEnabled: currentApiEnabled,
                youtubeApiInstantSearch: currentInstantSearch
            });

            autoloadWrap.classList.toggle('ycs_autoload_instant_muted', instantActive);
            if (instantActive) {
                autoloadCheckbox.title = AUTOLOAD_INSTANT_TOOLTIP;
            } else {
                autoloadCheckbox.removeAttribute('title');
            }
        };

        const setRenderYoutubeApiInstantSearch = (param: boolean): void => {
            const checkbox = document.getElementById('y_opts_youtube_api_instant_search') as HTMLInputElement | null;
            if (!checkbox) return;
            checkbox.checked = param !== false;
            currentInstantSearch = param !== false;
            updateAutoloadInstantVisual();
            updateApiModeDisplay();
        };

        const optSetYoutubeApiInstantSearch = async (enabled: boolean): Promise<void> => {
            try {
                await chrome.storage.local.set({
                    youtubeApiInstantSearch: enabled
                });
                currentInstantSearch = enabled;
                updateAutoloadInstantVisual();
                updateApiModeDisplay();
            } catch (err) {
                console.error(err);
            }
        };

        const setRenderYoutubeApiEnabled = (param: boolean): void => {
            const checkbox = document.getElementById('y_opts_youtube_api_enabled') as HTMLInputElement | null;
            if (!checkbox) return;
            checkbox.checked = param !== false; // default true
            currentApiEnabled = param !== false;
            updateAutoloadInstantVisual();
            updateApiModeDisplay();
        };

        const optSetYoutubeApiEnabled = async (enabled: boolean): Promise<void> => {
            try {
                await chrome.storage.local.set({
                    youtubeApiEnabled: enabled
                });
                currentApiEnabled = enabled;
                updateAutoloadInstantVisual();
                updateApiModeDisplay();
            } catch (err) {
                console.error(err);
            }
        };

        const setRenderYoutubeApiKey = (param?: string): void => {
            const input = document.getElementById('y_opts_youtube_api_key') as HTMLInputElement | null;
            if (!input) return;
            input.value = param ?? '';
            currentApiKey = param ?? '';
            updateAutoloadInstantVisual();
            updateApiModeDisplay();
        };

        const optSetYoutubeApiKey = async (value: string): Promise<void> => {
            try {
                const trimmedValue = value.trim();
                await chrome.storage.local.set({
                    youtubeApiKey: trimmedValue
                });
                currentApiKey = trimmedValue;
                updateAutoloadInstantVisual();
                updateApiModeDisplay();
            } catch (err) {
                console.error(err);
            }
        };

        const updateApiModeDisplay = (): void => {
            const modeValue = document.getElementById('ycs_api_mode_value') as HTMLElement | null;
            if (!modeValue) return;

            const hasKey = Boolean(currentApiKey && currentApiKey.trim());
            const fullLoadViaDataApi = hasKey && currentApiEnabled;
            const instantOn = currentInstantSearch !== false;

            if (fullLoadViaDataApi) {
                modeValue.textContent = instantOn
                    ? 'YouTube Data API (full load + Instant)'
                    : 'YouTube Data API (full load)';
                modeValue.classList.add('youtube-api');
                modeValue.classList.remove('disabled');
            } else if (hasKey && instantOn) {
                modeValue.textContent = 'Innertube load + Instant search';
                modeValue.classList.add('youtube-api');
                modeValue.classList.remove('disabled');
            } else if (hasKey && !currentApiEnabled) {
                modeValue.textContent = 'YouTube Data API (disabled)';
                modeValue.classList.remove('youtube-api');
                modeValue.classList.add('disabled');
            } else {
                modeValue.textContent = 'Innertube (default)';
                modeValue.classList.remove('youtube-api');
                modeValue.classList.remove('disabled');
            }
        };

        const initYoutubeApiKeyEvents = (): void => {
            const apiKeyInput = document.getElementById('y_opts_youtube_api_key') as HTMLInputElement | null;
            const toggleBtn = document.getElementById('ycs_toggle_api_key') as HTMLButtonElement | null;

            if (apiKeyInput) {
                apiKeyInput.addEventListener('input', (e: Event) => {
                    const target = e.target as HTMLInputElement;
                    optSetYoutubeApiKey(target.value);
                });

                apiKeyInput.addEventListener('change', (e: Event) => {
                    const target = e.target as HTMLInputElement;
                    optSetYoutubeApiKey(target.value);
                });
            }

            if (toggleBtn && apiKeyInput) {
                toggleBtn.addEventListener('click', () => {
                    if (apiKeyInput.type === 'password') {
                        apiKeyInput.type = 'text';
                        toggleBtn.textContent = 'Hide';
                    } else {
                        apiKeyInput.type = 'password';
                        toggleBtn.textContent = 'Show';
                    }
                });
            }
        };

        const setRenderFilterButtons = (filterButtons: Array<{ id: string; enabled: boolean }>): void => {
            if (!Array.isArray(filterButtons)) return;

            const listContainer = document.getElementById('ycs_filter_buttons_list');
            if (!listContainer) return;

            // Clear existing content
            listContainer.innerHTML = '';

            // Re-render list based on settings
            filterButtons.forEach((button) => {
                const item = document.createElement('div');
                item.className = 'ycs_filter_button_item';
                item.draggable = true;
                item.dataset.buttonId = button.id;

                const buttonName = getButtonDisplayName(button.id);

                item.innerHTML = `
                    <span class="ycs_drag_handle">⋮⋮</span>
                    <input type="checkbox" id="filter_opt_${button.id.replace('ycs_btn_', '')}" ${button.enabled ? 'checked' : ''} />
                    <label for="filter_opt_${button.id.replace('ycs_btn_', '')}">${buttonName}</label>
                `;

                listContainer.appendChild(item);
            });
        };

        const getButtonDisplayName = (buttonId: string): string => {
            const nameMap: Record<string, string> = {
                ycs_btn_timestamps: 'Timestamps',
                ycs_btn_timestamp_viz: 'Stamp Dist',
                ycs_btn_author: 'Author',
                ycs_btn_heart: '❤ (Heart)',
                ycs_btn_verified: '✔ (Verified)',
                ycs_btn_links: 'Links',
                ycs_btn_likes: 'Likes',
                ycs_btn_replied_comments: 'Replied',
                ycs_btn_members: 'Members',
                ycs_btn_donated: 'Donated',
                ycs_btn_random: 'Random',
                ycs_btn_sort_first: 'All',
                ycs_btn_quick_chat: 'Chat (Quick chat search)',
                ycs_btn_quick_transcript: 'Transcript (Quick transcript search)'
            };
            return nameMap[buttonId] || buttonId;
        };

        const saveFilterButtons = async (): Promise<void> => {
            try {
                const listContainer = document.getElementById('ycs_filter_buttons_list');
                if (!listContainer) return;

                const filterButtons: Array<{ id: string; enabled: boolean }> = [];

                Array.from(listContainer.children).forEach((item) => {
                    const buttonId = (item as HTMLElement).dataset.buttonId;
                    const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;

                    if (buttonId && checkbox) {
                        filterButtons.push({
                            id: buttonId,
                            enabled: checkbox.checked
                        });
                    }
                });

                await chrome.storage.local.set({
                    filterButtons: filterButtons
                });
            } catch (err) {
                console.error(err);
            }
        };

        const resetFilterButtonsToDefault = async (): Promise<void> => {
            try {
                await chrome.storage.local.set({
                    filterButtons: options.filterButtons
                });
                setRenderFilterButtons(options.filterButtons);
            } catch (err) {
                console.error(err);
            }
        };

        const initFilterButtonsEvents = (): void => {
            const listContainer = document.getElementById('ycs_filter_buttons_list');
            if (!listContainer) return;

            let draggedElement: HTMLElement | null = null;

            // Drag start
            listContainer.addEventListener('dragstart', (e: DragEvent) => {
                draggedElement = e.target as HTMLElement;
                if (draggedElement) {
                    draggedElement.classList.add('dragging');
                }
            });

            // Drag end
            listContainer.addEventListener('dragend', (_e: DragEvent) => {
                if (draggedElement) {
                    draggedElement.classList.remove('dragging');
                    draggedElement = null;
                }
            });

            // Drag over
            listContainer.addEventListener('dragover', (e: DragEvent) => {
                e.preventDefault();
                const afterElement = getDragAfterElement(listContainer, e.clientX, e.clientY);
                if (draggedElement && afterElement == null) {
                    listContainer.appendChild(draggedElement);
                } else if (draggedElement && afterElement) {
                    listContainer.insertBefore(draggedElement, afterElement);
                }
            });

            // Drag drop
            listContainer.addEventListener('drop', (e: DragEvent) => {
                e.preventDefault();
                saveFilterButtons();
            });

            // Checkbox change event
            listContainer.addEventListener('change', (e: Event) => {
                const target = e.target as HTMLInputElement;
                if (target.type === 'checkbox') {
                    saveFilterButtons();
                }
            });
        };

        const getDragAfterElement = (container: HTMLElement, clientX: number, clientY: number): HTMLElement | null => {
            const items = [...container.querySelectorAll('.ycs_filter_button_item:not(.dragging)')];
            if (!items.length) {
                return null;
            }

            const computedStyle = window.getComputedStyle(container);
            const columnCount = Math.max(
                1,
                computedStyle.gridTemplateColumns.split(' ').filter((part) => part.trim().length > 0).length
            );

            type GridItem = {
                element: HTMLElement;
                rect: DOMRect;
                row: number;
                column: number;
                order: number;
            };

            const allChildren = Array.from(container.querySelectorAll('.ycs_filter_button_item')) as HTMLElement[];

            const rowBounds: Array<{ top: number; bottom: number; order: number }> = [];
            const columnBounds: Array<{ left: number; right: number; center: number; order: number }> = [];

            const gridItems: GridItem[] = items
                .map((child) => {
                    const element = child as HTMLElement;
                    const rect = element.getBoundingClientRect();
                    const domIndex = allChildren.indexOf(element);
                    const order = domIndex >= 0 ? domIndex : Number.MAX_SAFE_INTEGER;
                    const row = Math.floor(order / columnCount);
                    const column = order % columnCount;

                    const existingRow = rowBounds[row];
                    if (existingRow) {
                        existingRow.top = Math.min(existingRow.top, rect.top);
                        existingRow.bottom = Math.max(existingRow.bottom, rect.bottom);
                    } else {
                        rowBounds[row] = {
                            top: rect.top,
                            bottom: rect.bottom,
                            order: row
                        };
                    }

                    const existingColumn = columnBounds[column];
                    if (existingColumn) {
                        existingColumn.left = Math.min(existingColumn.left, rect.left);
                        existingColumn.right = Math.max(existingColumn.right, rect.right);
                        existingColumn.center = (existingColumn.left + existingColumn.right) / 2;
                    } else {
                        columnBounds[column] = {
                            left: rect.left,
                            right: rect.right,
                            center: rect.left + rect.width / 2,
                            order: column
                        };
                    }

                    return {
                        element,
                        rect,
                        row,
                        column,
                        order
                    };
                })
                .sort((a, b) => a.order - b.order)
                .map((item, index) => ({
                    ...item,
                    row: Math.floor(index / columnCount),
                    column: index % columnCount,
                    order: index
                }));

            const pointerRow = resolveTargetRow(rowBounds, clientY);
            const pointerColumn = resolveTargetColumn(columnBounds, clientX);

            for (const item of gridItems) {
                if (item.row > pointerRow || (item.row === pointerRow && item.column >= pointerColumn)) {
                    return item.element;
                }
            }

            return null;
        };

        const resolveTargetRow = (
            rows: Array<{ top: number; bottom: number; order: number }>,
            pointerY: number
        ): number => {
            if (!rows.length) return 0;

            const sortedRows = [...rows].sort((a, b) => a.top - b.top);

            if (pointerY < sortedRows[0].top) {
                return 0;
            }

            for (let i = 0; i < sortedRows.length; i++) {
                const row = sortedRows[i];
                const nextRow = sortedRows[i + 1];

                if (pointerY <= row.bottom) {
                    return row.order;
                }

                if (nextRow && pointerY < nextRow.top) {
                    return nextRow.order;
                }
            }

            return sortedRows[sortedRows.length - 1].order + 1;
        };

        const resolveTargetColumn = (
            columns: Array<{ left: number; right: number; center: number; order: number }>,
            pointerX: number
        ): number => {
            if (!columns.length) return 0;

            const sortedColumns = [...columns].sort((a, b) => a.left - b.left);

            const firstColumn = sortedColumns[0];
            const lastColumn = sortedColumns[sortedColumns.length - 1];

            if (pointerX <= firstColumn.center) {
                return firstColumn.order;
            }

            for (let i = 0; i < sortedColumns.length - 1; i++) {
                const current = sortedColumns[i];
                const next = sortedColumns[i + 1];
                const boundary = (current.center + next.center) / 2;

                if (pointerX < boundary) {
                    return current.order;
                }
            }

            return pointerX >= lastColumn.right ? lastColumn.order + 1 : lastColumn.order;
        };

        const optSetCache = async (opt: HTMLInputElement): Promise<void> => {
            try {
                // const opts = JSON.parse(localStorage.getItem('ycs_options') as string);
                // opts.cache = opt.checked;

                await chrome.storage.local.set({
                    cache: opt.checked
                });

                // const jsonOpts = JSON.stringify(opts);

                // localStorage.setItem('ycs_options', jsonOpts);
            } catch (err) {
                console.error(err);
            }
        };

        const optSetHiddenByDefault = async (opt: HTMLInputElement): Promise<void> => {
            try {
                await chrome.storage.local.set({
                    hiddenByDefault: opt.checked
                });
            } catch (err) {
                console.error(err);
            }
        };

        const optSetHiddenByDefaultShorts = async (opt: HTMLInputElement): Promise<void> => {
            try {
                await chrome.storage.local.set({
                    hiddenByDefaultShorts: opt.checked
                });
            } catch (err) {
                console.error(err);
            }
        };

        const optSetEnableShortsSupport = async (opt: HTMLInputElement): Promise<void> => {
            try {
                await chrome.storage.local.set({
                    enableShortsSupport: opt.checked
                });

                // Update UI state immediately
                const group = document.getElementById('ycs-shorts-group');
                group?.classList.toggle('ycs_group--enabled', opt.checked);
                updateShortsSupportDependents(opt.checked);
            } catch (err) {
                console.error(err);
            }
        };

        const setRenderAutoClearCacheOpt = (param: number): void => {
            if (!param) return;

            (document.getElementById('y_opts_cache_quota') as HTMLInputElement).value = param.toString();
        };

        const optSetAutoClearCache = async (e: Event): Promise<void> => {
            try {
                if (isNumeric((e.target as HTMLInputElement).value)) {
                    // const opts = JSON.parse(localStorage.getItem('ycs_options') as string);
                    // opts.autoClear = (e.target as HTMLInputElement).value;

                    await chrome.storage.local.set({
                        autoClear: (e.target as HTMLInputElement).value
                    });

                    // const jsonOpts = JSON.stringify(opts);

                    // localStorage.setItem('ycs_options', jsonOpts);
                }
            } catch (err) {
                console.error(err);
            }
        };

        const showUsageMemory = async (): Promise<void> => {
            try {
                const db = await idb;

                const memory = (await navigator.storage.estimate()) as IStorageEstimate;

                const elTotalCache = document.getElementById('ycs_total_cache') as HTMLElement;
                const elUsedCache = document.getElementById('ycs_used_cache') as HTMLElement;
                const elBrowserAvStorage = document.getElementById('ycs_browser_av_storage') as HTMLElement;
                const elQuotaAvStorage = document.getElementById('ycs_quota_av_storage') as HTMLElement;

                elTotalCache.textContent = (await db.count(STORE_CACHE_YCS)) + '';

                elUsedCache.textContent = formatBytes(
                    (memory?.usageDetails?.indexedDB || memory.usage) as number
                ) as string;

                elBrowserAvStorage.textContent =
                    (((memory.usage as number) / (memory.quota as number)) * 100).toFixed(2) + '%';

                elQuotaAvStorage.textContent = formatBytes(memory.quota as number) as string;
            } catch (err) {
                console.error(err);
            }
        };

        const btnClearAllCache = async (): Promise<void> => {
            try {
                const db = await idb;

                await db.clear(STORE_CACHE_YCS);

                await showUsageMemory();
            } catch (err) {
                console.error(err);
            }
        };

        const optsStorage = await chrome.storage.local.get();
        // console.log('optsStorage: ', optsStorage);

        await chrome.storage.local.set({
            ...options,
            ...optsStorage
        });

        const storageOpts = await chrome.storage.local.get();
        // console.log('storageOpts: ', storageOpts);

        if (storageOpts) {
            for (const key of Object.keys(storageOpts)) {
                switch (key) {
                    case 'autoload':
                        setRenderAutoloadOpt(storageOpts[key]);
                        break;

                    case 'highlightText':
                        console.log('setHighlightTextOpt: ', storageOpts[key]);
                        setRenderHighlightTextOpt(storageOpts[key]);
                        break;

                    case 'highlightExact':
                        setRenderHighlightExact(storageOpts[key]);
                        break;

                    case 'cache':
                        setRenderCacheOpt(storageOpts[key]);
                        break;

                    case 'autoClear':
                        setRenderAutoClearCacheOpt(storageOpts[key]);
                        break;

                    case 'hiddenByDefault':
                        setRenderHiddenByDefault(storageOpts[key]);
                        break;

                    case 'sortTimestamp':
                        setRenderSortTimestampOpt(storageOpts[key]);
                        break;

                    case 'autoExpandReplyContext':
                        setRenderAutoExpandReplyContext(storageOpts[key]);
                        break;

                    case 'hiddenByDefaultShorts':
                        setRenderHiddenByDefaultShorts(storageOpts[key]);
                        break;

                    case 'sidebarByDefault':
                        setRenderSidebarByDefault(storageOpts[key]);
                        break;

                    case 'showSidebarToggle':
                        setRenderShowSidebarToggle(storageOpts[key]);
                        break;

                    case 'enableShortsSupport':
                        setRenderEnableShortsSupport(storageOpts[key]);
                        break;

                    case 'transcriptLanguage':
                        setRenderTranscriptLanguage(storageOpts[key]);
                        break;

                    case 'maxComments':
                        setRenderMaxComments(storageOpts[key]);
                        break;

                    case 'filterButtons':
                        setRenderFilterButtons(storageOpts[key]);
                        break;

                    case 'youtubeApiKey':
                        setRenderYoutubeApiKey(storageOpts[key]);
                        break;

                    case 'youtubeApiEnabled':
                        setRenderYoutubeApiEnabled(storageOpts[key]);
                        break;

                    case 'youtubeApiInstantSearch':
                        setRenderYoutubeApiInstantSearch(storageOpts[key]);
                        break;

                    default:
                        break;
                }
            }
        }

        // Initialize filter buttons events once after initial render
        initFilterButtonsEvents();

        // Initialize YouTube API key events
        initYoutubeApiKeyEvents();
        updateAutoloadInstantVisual();

        const elAutoload = document.getElementsByClassName('ycs_inner_wrap')[0];
        elAutoload?.addEventListener('click', async (e: Event) => {
            console.log('Event options: ', e);

            switch ((e.target as HTMLInputElement).id) {
                case 'y_opts_autoload':
                    optSetAutoload(e.target as HTMLInputElement);
                    break;

                case 'y_opts_highlight':
                    optSetHighlightText(e.target as HTMLInputElement);
                    break;

                case 'y_opts_highlight_exact':
                    optSetHighlightExact(e.target as HTMLInputElement);
                    break;

                case 'y_opts_cache':
                    optSetCache(e.target as HTMLInputElement);
                    break;

                case 'ycs_opts_btn_cache':
                    (e.target as HTMLButtonElement).disabled = true;

                    await btnClearAllCache();

                    (e.target as HTMLButtonElement).disabled = false;

                    break;

                case 'y_opts_hidden_by_default':
                    optSetHiddenByDefault(e.target as HTMLInputElement);
                    break;

                case 'y_opts_sort_timestamp':
                    optSetSortTimestamp(e.target as HTMLInputElement);
                    break;

                case 'y_opts_auto_expand_reply_context':
                    optSetAutoExpandReplyContext(e.target as HTMLInputElement);
                    break;

                case 'y_opts_hidden_by_default_shorts':
                    optSetHiddenByDefaultShorts(e.target as HTMLInputElement);
                    break;

                case 'y_opts_enable_shorts_support':
                    optSetEnableShortsSupport(e.target as HTMLInputElement);
                    break;

                case 'y_opts_sidebar_by_default':
                    optSetSidebarByDefault(e.target as HTMLInputElement);
                    break;

                case 'y_opts_show_sidebar_toggle':
                    optSetShowSidebarToggle(e.target as HTMLInputElement);
                    break;

                case 'ycs_opts_btn_reset_filters':
                    await resetFilterButtonsToDefault();
                    break;

                case 'y_opts_youtube_api_enabled':
                    optSetYoutubeApiEnabled((e.target as HTMLInputElement).checked);
                    break;

                case 'y_opts_youtube_api_instant_search':
                    optSetYoutubeApiInstantSearch((e.target as HTMLInputElement).checked);
                    break;

                default:
                    break;
            }
        });

        const elCacheQuota = document.getElementById('y_opts_cache_quota') as HTMLInputElement;
        elCacheQuota?.addEventListener('input', optSetAutoClearCache);

        const elMaxComments = document.getElementById('y_opts_max_comments_input') as HTMLInputElement;
        elMaxComments?.addEventListener('input', optSetMaxComments);

        const transcriptLanguageSelect = document.getElementById(
            'y_opts_transcript_language_select'
        ) as HTMLSelectElement | null;
        const transcriptLanguageInput = document.getElementById(
            'y_opts_transcript_language'
        ) as HTMLInputElement | null;

        const handleTranscriptLanguageSelectChange = (event: Event): void => {
            const target = event.target as HTMLSelectElement | null;
            if (!target) return;
            const nextValue = target.value.trim();
            // Clear input when select changes
            if (transcriptLanguageInput) {
                transcriptLanguageInput.value = '';
            }
            optSetTranscriptLanguage(nextValue);
        };

        const handleTranscriptLanguageInputChange = (event: Event): void => {
            const target = event.target as HTMLInputElement | null;
            if (!target) return;
            const nextValue = target.value.trim();
            // Clear select when input changes (set to default)
            if (transcriptLanguageSelect) {
                transcriptLanguageSelect.value = '';
            }
            optSetTranscriptLanguage(nextValue);
        };

        transcriptLanguageSelect?.addEventListener('change', handleTranscriptLanguageSelectChange);
        transcriptLanguageInput?.addEventListener('input', handleTranscriptLanguageInputChange);
        transcriptLanguageInput?.addEventListener('change', handleTranscriptLanguageInputChange);

        const elPageCache = document.getElementById('ycs_opts_btn_export_page') as HTMLElement;
        elPageCache.onclick = () => {
            try {
                chrome.tabs.create({ url: chrome.runtime.getURL('./options/export.html') });
            } catch (err) {
                console.error(err);
            }
        };

        await showUsageMemory();

        // Initialize filter buttons events (if not loaded from storage settings)
        if (!storageOpts.filterButtons) {
            setRenderFilterButtons(options.filterButtons);
        }
    } catch (err) {
        console.error(err);
    }
};
