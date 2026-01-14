import type Fuse from '../../../../node_modules/fuse.js/dist/fuse';

type FuseOptions = Fuse.IFuseOptions<unknown>;
type NullableFuseOptions = FuseOptions | null | undefined;

const BASE_FUSE_OPTIONS: FuseOptions = {
    isCaseSensitive: false,
    findAllMatches: false,
    includeMatches: false,
    includeScore: true,
    ignoreLocation: true,
    useExtendedSearch: false,
    minMatchCharLength: 1,
    shouldSort: true,
    threshold: 0.15,
    distance: 100000,
    fieldNormWeight: 0.1
};

export function cloneFuseOptions(): Fuse.IFuseOptions<any> {
    return JSON.parse(JSON.stringify(BASE_FUSE_OPTIONS));
}

export function buildKeysSignature(keys: FuseOptions['keys']): string {
    return Array.isArray(keys) ? JSON.stringify(keys) : String(keys ?? '');
}

export function buildOptionsSignature(options: NullableFuseOptions): string {
    if (!options) {
        return 'no-options';
    }

    const { keys: _keys, ...rest } = options;
    const normalized = Object.keys(rest as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = (rest as Record<string, unknown>)[key];
            return acc;
        }, {});

    return JSON.stringify(normalized);
}
