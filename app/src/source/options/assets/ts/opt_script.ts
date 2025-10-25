import { options } from '../../../config/options';
import { formatBytes } from '../../../utils/formatting';
import { isNumeric } from '../../../utils/common';
import { idb } from '../../../utils/libs';

import { IStorageEstimate } from '../../../utils/interfaces/i_types';

const STORE_CACHE_YCS = 'STORE_CACHE_YCS';

window.onload = async (): Promise<void> => {
    try {
        const setRenderAutoloadOpt = (param: boolean): void => {
            if (typeof param !== 'boolean') return;

            (document.getElementById('y_opts_autoload') as HTMLInputElement).checked = param;
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

        const setRenderFilterButtons = (filterButtons: Array<{ id: string; enabled: boolean }>): void => {
            if (!Array.isArray(filterButtons)) return;

            const listContainer = document.getElementById('ycs_filter_buttons_list');
            if (!listContainer) return;

            // 清空現有內容
            listContainer.innerHTML = '';

            // 根據設定重新渲染列表
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

            // 重新綁定事件
            initFilterButtonsEvents();
        };

        const getButtonDisplayName = (buttonId: string): string => {
            const nameMap: Record<string, string> = {
                ycs_btn_timestamps: 'Timestamps',
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
                ycs_btn_quick_chat: 'Chat',
                ycs_btn_quick_transcript: 'Transcript'
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

            // 拖曳開始
            listContainer.addEventListener('dragstart', (e: DragEvent) => {
                draggedElement = e.target as HTMLElement;
                if (draggedElement) {
                    draggedElement.classList.add('dragging');
                }
            });

            // 拖曳結束
            listContainer.addEventListener('dragend', (e: DragEvent) => {
                if (draggedElement) {
                    draggedElement.classList.remove('dragging');
                    draggedElement = null;
                }
            });

            // 拖曳經過
            listContainer.addEventListener('dragover', (e: DragEvent) => {
                e.preventDefault();
                const afterElement = getDragAfterElement(listContainer, e.clientY);
                if (draggedElement && afterElement == null) {
                    listContainer.appendChild(draggedElement);
                } else if (draggedElement && afterElement) {
                    listContainer.insertBefore(draggedElement, afterElement);
                }
            });

            // 拖曳放下
            listContainer.addEventListener('drop', (e: DragEvent) => {
                e.preventDefault();
                saveFilterButtons();
            });

            // Checkbox 變更事件
            listContainer.addEventListener('change', (e: Event) => {
                const target = e.target as HTMLInputElement;
                if (target.type === 'checkbox') {
                    saveFilterButtons();
                }
            });
        };

        const getDragAfterElement = (container: HTMLElement, y: number): HTMLElement | null => {
            const draggableElements = [...container.querySelectorAll('.ycs_filter_button_item:not(.dragging)')];

            return draggableElements.reduce((closest: HTMLElement | null, child: Element) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;

                if (offset < 0 && offset > (closest ? closest.getBoundingClientRect().top - y : -Infinity)) {
                    return child as HTMLElement;
                }
                return closest;
            }, null);
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

                    case 'filterButtons':
                        setRenderFilterButtons(storageOpts[key]);
                        break;

                    default:
                        break;
                }
            }
        }

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

                case 'ycs_opts_btn_reset_filters':
                    await resetFilterButtonsToDefault();
                    break;

                default:
                    break;
            }
        });

        const elCacheQuota = document.getElementById('y_opts_cache_quota') as HTMLInputElement;
        elCacheQuota?.addEventListener('input', optSetAutoClearCache);

        const elPageCache = document.getElementById('ycs_opts_btn_export_page') as HTMLElement;
        elPageCache.onclick = () => {
            try {
                chrome.tabs.create({ url: chrome.runtime.getURL('./options/export.html') });
            } catch (err) {
                console.error(err);
            }
        };

        await showUsageMemory();

        // 初始化 filter buttons 事件（如果沒有從 storage 載入設定）
        if (!storageOpts.filterButtons) {
            setRenderFilterButtons(options.filterButtons);
        }
    } catch (err) {
        console.error(err);
    }
};
