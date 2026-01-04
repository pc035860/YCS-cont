import { CommentSortOrder, type CommentSortOption } from '../../utils/interfaces/i_types';
import type {
    clearComments,
    getController,
    getSelectedCommentSortOrder,
    resetController,
    setSelectedCommentSortOrder
} from '../state';

// ============================================
// Constants
// ============================================

const SORT_OPTIONS: CommentSortOption[] = [
    { value: CommentSortOrder.NewestFirst, label: 'Newest (full, default)' },
    { value: CommentSortOrder.TopComments, label: 'Top (filtered)' }
];

// ============================================
// Dependency Injection Interfaces
// ============================================

export interface CommentSortOrderSelectorStateDeps {
    getState: () => any;
    setState: (state: any) => void;
    getSelectedCommentSortOrder: typeof getSelectedCommentSortOrder;
    setSelectedCommentSortOrder: typeof setSelectedCommentSortOrder;
    clearComments: typeof clearComments;
    getController: typeof getController;
    resetController: typeof resetController;
}

export interface CommentSortOrderSelectorElements {
    elSortOrderButton: HTMLElement | null;
    elSortOrderMenu: HTMLElement | null;
    elLoadComments?: HTMLElement | null;
}

export interface CommentSortOrderSelectorCallbacks {
    closeAllDropdowns: (except?: HTMLElement | null) => void;
    setMenuVisibility: (menu: HTMLElement | null, visible: boolean) => void;
}

export interface CommentSortOrderSelectorDeps {
    state: CommentSortOrderSelectorStateDeps;
    elements: CommentSortOrderSelectorElements;
    callbacks: CommentSortOrderSelectorCallbacks;
}

// ============================================
// CommentSortOrderSelector Class
// ============================================

export class CommentSortOrderSelector {
    private deps: CommentSortOrderSelectorDeps;

    constructor(deps: CommentSortOrderSelectorDeps) {
        this.deps = deps;
    }

    // ----------------------------------------
    // State accessors
    // ----------------------------------------

    private get state(): any {
        return this.deps.state.getState();
    }

    private set state(newState: any) {
        this.deps.state.setState(newState);
    }

    private get elements(): CommentSortOrderSelectorElements {
        return this.deps.elements;
    }

    // ----------------------------------------
    // Public methods
    // ----------------------------------------

    /**
     * Render sort order dropdown menu
     * @param selected - Currently selected sort order
     */
    renderSortOrderMenu(selected: CommentSortOrder): void {
        const { elSortOrderMenu } = this.elements;
        if (!elSortOrderMenu) return;

        elSortOrderMenu.innerHTML = '';

        const createItem = (option: CommentSortOption) => {
            const item = document.createElement('div');
            item.className = 'ycs_dropdown_item';
            item.dataset.value = String(option.value);
            item.textContent = option.label;
            if (option.value === selected) {
                item.classList.add('ycs_dropdown_item--active');
            }
            item.addEventListener('click', () => {
                this.state = this.deps.state.setSelectedCommentSortOrder(this.state, option.value);
                this.deps.callbacks.closeAllDropdowns();
                this.deps.callbacks.setMenuVisibility(elSortOrderMenu, false);

                // Trigger comment reload by clicking load button
                const { elLoadComments } = this.elements;
                if (elLoadComments instanceof HTMLElement) {
                    elLoadComments.click();
                }
            });
            return item;
        };

        SORT_OPTIONS.forEach((option) => {
            const item = createItem(option);
            elSortOrderMenu.appendChild(item);
        });
    }

    /**
     * Set up the sort order dropdown button handler
     * @param button - The dropdown trigger button
     */
    setupSortOrderDropdown(button: HTMLElement): void {
        const { elSortOrderMenu } = this.elements;

        const toggleMenu = () => {
            if (!elSortOrderMenu) return;
            const shouldShow = !elSortOrderMenu.classList.contains('show');
            this.deps.callbacks.closeAllDropdowns(elSortOrderMenu);
            this.deps.callbacks.setMenuVisibility(elSortOrderMenu, shouldShow);
        };

        button.addEventListener('click', () => {
            const selectedSortOrder = this.deps.state.getSelectedCommentSortOrder(this.state);
            this.renderSortOrderMenu(selectedSortOrder);
            toggleMenu();
        });
    }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create and initialize a CommentSortOrderSelector instance
 */
export function createCommentSortOrderSelector(deps: CommentSortOrderSelectorDeps): CommentSortOrderSelector {
    const selector = new CommentSortOrderSelector(deps);
    const { elSortOrderButton } = deps.elements;

    if (elSortOrderButton) {
        selector.setupSortOrderDropdown(elSortOrderButton);
    }

    return selector;
}
