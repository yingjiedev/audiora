export interface IRefreshCurrentSourceOptions<TSource> {
    isTargetCurrent(): boolean;
    getProgress(): Promise<number>;
    getShouldPlay(): Promise<boolean>;
    getFreshSource(): Promise<TSource | null | undefined>;
    adaptSource(source: TSource): Promise<TSource>;
    applySource(source: TSource, shouldPlay: boolean): Promise<void>;
    restoreProgress(position: number): Promise<void>;
}

/**
 * Refresh the active track without allowing an asynchronous result to affect a
 * track selected afterwards. A stale operation is treated as complete because
 * its cache was still cleared successfully; it simply has nothing left to
 * refresh.
 */
export async function refreshCurrentSource<TSource>(
    options: IRefreshCurrentSourceOptions<TSource>,
): Promise<boolean> {
    if (!options.isTargetCurrent()) {
        return true;
    }

    try {
        const position = await options.getProgress();
        if (!options.isTargetCurrent()) {
            return true;
        }

        const shouldPlay = await options.getShouldPlay();
        if (!options.isTargetCurrent()) {
            return true;
        }

        const source = await options.getFreshSource();
        if (!options.isTargetCurrent()) {
            return true;
        }
        if (!source) {
            return false;
        }

        const adaptedSource = await options.adaptSource(source);
        if (!options.isTargetCurrent()) {
            return true;
        }

        await options.applySource(adaptedSource, shouldPlay);
        if (!options.isTargetCurrent()) {
            return true;
        }

        await options.restoreProgress(position);
        return true;
    } catch {
        // A failure belonging to a track that has since changed must not show a
        // misleading error for the newly selected track.
        return !options.isTargetCurrent();
    }
}
