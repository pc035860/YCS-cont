import type Fuse from '../../../../node_modules/fuse.js/dist/fuse';

type FuseOptions = Fuse.IFuseOptions<unknown> | null | undefined;

export function buildOptionsSignature(options: FuseOptions): string {
    if (!options) {
        return 'no-options';
    }

    const { keys, ...rest } = options;
    const normalized = Object.keys(rest as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = (rest as Record<string, unknown>)[key];
            return acc;
        }, {});

    return JSON.stringify(normalized);
}
