export interface FilterButtonSetting {
    id: string;
    enabled: boolean;
}

// The stored filterButtons array overrides the defaults, so buttons added to the defaults in a
// later version would stay invisible to upgraded users unless merged in here.
// Missing default ids are inserted after their nearest preceding default neighbor present in
// the stored array (or at the front); stored order, enabled flags and unknown ids are kept.
export function mergeFilterButtonsWithDefaults(
    stored: unknown,
    defaults: FilterButtonSetting[]
): FilterButtonSetting[] {
    if (!Array.isArray(stored)) {
        return defaults.map((button) => ({ ...button }));
    }

    const result: FilterButtonSetting[] = [...stored];
    defaults.forEach((def, i) => {
        if (result.some((button) => button.id === def.id)) return;

        let pos = 0;
        for (let j = i - 1; j >= 0; j--) {
            const anchorIndex = result.findIndex((button) => button.id === defaults[j].id);
            if (anchorIndex !== -1) {
                pos = anchorIndex + 1;
                break;
            }
        }
        result.splice(pos, 0, { id: def.id, enabled: def.enabled });
    });
    return result;
}
