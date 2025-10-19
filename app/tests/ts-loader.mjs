export async function resolve(specifier, context, nextResolve) {
    try {
        return await nextResolve(specifier, context);
    } catch (error) {
        if (
            (specifier.startsWith('./') || specifier.startsWith('../')) &&
            !specifier.endsWith('.ts')
        ) {
            const tsSpecifier = `${specifier}.ts`;
            return nextResolve(tsSpecifier, context);
        }
        throw error;
    }
}
