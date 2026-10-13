/** Missing/disabled sources must not silently fall back to searching every source. */
export function scopeSearchPlugins<T extends { hash: string }>(plugins: T[], pluginHash?: string): T[] {
    return pluginHash ? plugins.filter(plugin => plugin.hash === pluginHash) : plugins;
}
