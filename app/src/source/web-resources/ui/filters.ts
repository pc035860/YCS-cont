import { IParamSearch, ISelectedSort } from '../../utils/interfaces/i_types';
import { resetSearchCounts, WebResourcesState } from '../state';
import { options } from '../../config/options';

export type FilterParamKey = Exclude<keyof IParamSearch, 'sortOrder'>;

export interface FilterButtonConfig {
    elementId: string;
    param: FilterParamKey;
}

export const FILTER_BUTTONS: FilterButtonConfig[] = [
    { elementId: 'ycs_btn_timestamps', param: 'timestamp' },
    { elementId: 'ycs_btn_timestamp_viz', param: 'timestampViz' },
    { elementId: 'ycs_btn_author', param: 'author' },
    { elementId: 'ycs_btn_heart', param: 'heart' },
    { elementId: 'ycs_btn_verified', param: 'verified' },
    { elementId: 'ycs_btn_links', param: 'links' },
    { elementId: 'ycs_btn_members', param: 'members' },
    { elementId: 'ycs_btn_donated', param: 'donated' },
    { elementId: 'ycs_btn_random', param: 'random' },
    { elementId: 'ycs_btn_comments', param: 'quickComments' },
    { elementId: 'ycs_btn_quick_chat', param: 'quickChat' },
    { elementId: 'ycs_btn_quick_transcript', param: 'quickTranscript' },
    { elementId: 'ycs_btn_origin', param: 'origin' },
    { elementId: 'ycs_btn_emoji', param: 'emoji' }
];

export interface RegisterFilterButtonsOptions {
    state: {
        get(): WebResourcesState;
        set(next: WebResourcesState): void;
    };
    executeSearch(param: IParamSearch): void;
    setActiveFilter(param: FilterParamKey | null, element?: HTMLElement): void;
    buttonConfigs: FilterButtonConfig[];
}

export interface FilterButtonRegistry {
    codeToId: Record<FilterParamKey, string>;
    idToCode: Record<string, FilterParamKey>;
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

    buttonConfigs.forEach((config) => {
        const button = document.getElementById(config.elementId) as HTMLElement | null;
        if (!button) return;

        // Remove old event listeners (if they exist)
        const oldHandler = (button as any).__ycsClickHandler;
        if (oldHandler) {
            button.removeEventListener('click', oldHandler);
        }

        const clickHandler = (event: Event) => {
            try {
                const currentTarget = event.currentTarget as HTMLElement;
                setActiveFilter(config.param, currentTarget);

                const nextState = resetSearchCounts(state.get());
                state.set(nextState);

                const activeEls = Array.from(document.querySelectorAll('.ycs_btn_active')) as HTMLElement[];
                const searchParam: IParamSearch = {};
                for (const el of activeEls) {
                    searchParam[idToCode[el.id]] = true;
                }
                const elSelectSortSearch = document.getElementById('ycs_sort_select') as HTMLSelectElement;
                searchParam.sortOrder = elSelectSortSearch
                    ? (elSelectSortSearch.options[elSelectSortSearch.options.selectedIndex].value as ISelectedSort)
                    : 'relevance';
                // If search type is specified, force use that type
                executeSearch(searchParam);
            } catch (error) {
                console.error(error);
            }
        };

        // Store event handler reference for later removal
        (button as any).__ycsClickHandler = clickHandler;
        button.addEventListener('click', clickHandler);
    });

    return {
        codeToId,
        idToCode
    };
}

// Generate button configurations dynamically based on user settings
function getDynamicFilterButtonConfigs(filterButtons?: Array<{ id: string; enabled: boolean }>): FilterButtonConfig[] {
    try {
        const buttonsToUse = filterButtons || options.filterButtons;

        // Only return enabled button configurations
        const enabledButtons = buttonsToUse.filter((button: { id: string; enabled: boolean }) => button.enabled);

        return FILTER_BUTTONS.filter((config) =>
            enabledButtons.some((button: { id: string; enabled: boolean }) => button.id === config.elementId)
        );
    } catch (err) {
        console.error('Error loading filter buttons settings:', err);
        // If loading fails, use default settings
        return FILTER_BUTTONS.filter((config) =>
            options.filterButtons.some((button) => button.id === config.elementId && button.enabled)
        );
    }
}

export { getDynamicFilterButtonConfigs };
