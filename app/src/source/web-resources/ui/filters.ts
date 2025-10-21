import { iconSortDown, iconSortUp } from '../../utils/icons';
import { IParamSearch } from '../../utils/interfaces/i_types';
import { resetSearchCounts, WebResourcesState } from '../state';

export type FilterParamKey = Exclude<keyof IParamSearch, 'sortOrder'>;

export interface FilterButtonConfig {
    id: string;
    param: FilterParamKey;
    supportsSort?: boolean;
}

export interface RegisterFilterButtonsOptions {
    state: {
        get(): WebResourcesState;
        set(next: WebResourcesState): void;
    };
    executeSearch(param: IParamSearch): void;
    setActiveFilter(code: string | null, element?: HTMLElement): void;
    buttonConfigs: FilterButtonConfig[];
}

type SortDatasetKey = 'sort' | 'sortChat' | 'sortTrp';
type SortOrder = 'newest' | 'oldest';

const SORT_DATASET_KEYS: SortDatasetKey[] = ['sort', 'sortChat', 'sortTrp'];

function extractBaseLabel(html: string): string {
    return html.replace(iconSortDown(), '').replace(iconSortUp(), '').trim();
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
}: RegisterFilterButtonsOptions): void {
    buttonConfigs.forEach((config) => {
        const button = document.getElementById(config.id) as HTMLElement | null;
        if (!button) return;

        button.addEventListener('click', (event: Event) => {
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

                executeSearch(searchParam);
            } catch (error) {
                console.error(error);
            }
        });
    });
}
