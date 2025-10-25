import { iconSortDown, iconSortUp } from '../../utils/icons';
import { IParamSearch, ISelectedSearch } from '../../utils/interfaces/i_types';
import { resetSearchCounts, WebResourcesState } from '../state';
import { options } from '../../config/options';

export type FilterParamKey = Exclude<keyof IParamSearch, 'sortOrder'>;

export interface FilterButtonConfig {
    elementId: string;
    param: FilterParamKey;
    supportsSort?: boolean;
    searchType?: ISelectedSearch;
}

export const FILTER_BUTTONS: FilterButtonConfig[] = [
    { elementId: 'ycs_btn_timestamps', param: 'timestamp', supportsSort: true },
    { elementId: 'ycs_btn_author', param: 'author', supportsSort: true },
    { elementId: 'ycs_btn_heart', param: 'heart', supportsSort: true },
    { elementId: 'ycs_btn_verified', param: 'verified', supportsSort: true },
    { elementId: 'ycs_btn_links', param: 'links', supportsSort: true },
    { elementId: 'ycs_btn_likes', param: 'likes' },
    { elementId: 'ycs_btn_replied_comments', param: 'replied' },
    { elementId: 'ycs_btn_members', param: 'members', supportsSort: true },
    { elementId: 'ycs_btn_donated', param: 'donated', supportsSort: true },
    { elementId: 'ycs_btn_random', param: 'random' },
    { elementId: 'ycs_btn_sort_first', param: 'sortFirst', supportsSort: true },
    { elementId: 'ycs_btn_quick_chat', param: 'quickChat', supportsSort: true, searchType: 'chat' },
    { elementId: 'ycs_btn_quick_transcript', param: 'quickTranscript', supportsSort: true, searchType: 'video' }
];

export interface RegisterFilterButtonsOptions {
    state: {
        get(): WebResourcesState;
        set(next: WebResourcesState): void;
    };
    executeSearch(param: IParamSearch, forceType?: ISelectedSearch): void;
    setActiveFilter(param: FilterParamKey | null, element?: HTMLElement): void;
    buttonConfigs: FilterButtonConfig[];
}

export interface FilterButtonRegistry {
    codeToId: Record<FilterParamKey, string>;
    idToCode: Record<string, FilterParamKey>;
    sortButtonIds: string[];
}

type SortDatasetKey = 'sort' | 'sortChat' | 'sortTrp';
type SortOrder = 'newest' | 'oldest';

const SORT_DATASET_KEYS: SortDatasetKey[] = ['sort', 'sortChat', 'sortTrp'];

function extractBaseLabel(html: string): string {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    // Remove all .ycs-icons elements to extract base label
    temp.querySelectorAll('.ycs-icons').forEach((el) => el.remove());
    return temp.innerHTML.trim();
}

function getCurrentSortOrder(button: HTMLElement): SortOrder {
    for (const key of SORT_DATASET_KEYS) {
        const value = button.dataset[key] as SortOrder | undefined;
        if (value === 'newest' || value === 'oldest') {
            return value;
        }
    }

    return 'newest';
}

function toggleSortDatasets(button: HTMLElement): SortOrder {
    let order: SortOrder = 'newest';

    for (const key of SORT_DATASET_KEYS) {
        const current = button.dataset[key] as SortOrder | undefined;
        if (current === 'newest' || current === 'oldest') {
            const next = current === 'newest' ? 'oldest' : 'newest';
            button.dataset[key] = next;
            order = next;
        }
    }

    return order;
}

export function updateSortIndicator(button: HTMLElement, order: SortOrder): void {
    const baseLabel = button.dataset.labelHtml ?? extractBaseLabel(button.innerHTML);
    button.dataset.labelHtml = baseLabel;

    const icon = order === 'oldest' ? iconSortUp() : iconSortDown();
    button.innerHTML = `${baseLabel} ${icon}`;
}

export function toggleFilter(button: HTMLElement, supportsSort: boolean, wasActive: boolean): SortOrder | undefined {
    if (!supportsSort) {
        return undefined;
    }

    const order = wasActive ? toggleSortDatasets(button) : getCurrentSortOrder(button);
    updateSortIndicator(button, order);

    return order;
}

export function registerFilterButtons({
    state,
    executeSearch,
    setActiveFilter,
    buttonConfigs
}: RegisterFilterButtonsOptions): FilterButtonRegistry {
    const codeToId = buttonConfigs.reduce<Record<FilterParamKey, string>>(
        (acc, config) => {
            acc[config.param] = config.elementId;
            return acc;
        },
        {} as Record<FilterParamKey, string>
    );

    const idToCode = buttonConfigs.reduce<Record<string, FilterParamKey>>(
        (acc, config) => {
            acc[config.elementId] = config.param;
            return acc;
        },
        {} as Record<string, FilterParamKey>
    );

    const sortButtonIds = buttonConfigs.filter((config) => config.supportsSort).map((config) => config.elementId);

    buttonConfigs.forEach((config) => {
        const button = document.getElementById(config.elementId) as HTMLElement | null;
        if (!button) return;

        // 移除舊的事件監聽器（如果存在）
        const oldHandler = (button as any).__ycsClickHandler;
        if (oldHandler) {
            button.removeEventListener('click', oldHandler);
        }

        if (config.supportsSort) {
            SORT_DATASET_KEYS.forEach((key) => {
                const value = button.dataset[key];
                if (value !== 'newest' && value !== 'oldest') {
                    button.dataset[key] = 'newest';
                }
            });
        }

        const clickHandler = (event: Event) => {
            try {
                const currentTarget = event.currentTarget as HTMLElement;
                const wasActive = currentTarget.classList.contains('ycs_btn_active');
                const sortOrder = toggleFilter(currentTarget, !!config.supportsSort, wasActive);

                setActiveFilter(config.param, currentTarget);

                const nextState = resetSearchCounts(state.get());
                state.set(nextState);

                const searchParam: IParamSearch = { [config.param]: true } as IParamSearch;
                if (sortOrder) {
                    searchParam.sortOrder = sortOrder;
                }

                // 如果有指定搜尋類型，則強制使用該類型
                executeSearch(searchParam, config.searchType);
            } catch (error) {
                console.error(error);
            }
        };

        // 儲存事件處理器引用以便後續移除
        (button as any).__ycsClickHandler = clickHandler;
        button.addEventListener('click', clickHandler);
    });

    return {
        codeToId,
        idToCode,
        sortButtonIds
    };
}

// 根據使用者設定動態生成按鈕配置
function getDynamicFilterButtonConfigs(filterButtons?: Array<{ id: string; enabled: boolean }>): FilterButtonConfig[] {
    try {
        const buttonsToUse = filterButtons || options.filterButtons;

        // 只返回已啟用的按鈕配置
        const enabledButtons = buttonsToUse.filter((button: { id: string; enabled: boolean }) => button.enabled);

        return FILTER_BUTTONS.filter((config) =>
            enabledButtons.some((button: { id: string; enabled: boolean }) => button.id === config.elementId)
        );
    } catch (err) {
        console.error('Error loading filter buttons settings:', err);
        // 如果載入失敗，使用預設設定
        return FILTER_BUTTONS.filter((config) =>
            options.filterButtons.some((button) => button.id === config.elementId && button.enabled)
        );
    }
}

export { getDynamicFilterButtonConfigs };
