import { trackSourceKey } from "@/utils/trackGroup";

export interface LinkedSource {
    item: IMusic.IMusicItem;
    source: IPlugin.IMediaSourceResult;
    quality: IMusic.IQualityKey;
}

/** End the host wait on timeout/navigation; plugin work may continue in the background. */
export function waitForSource<T>(work: () => Promise<T>, isCurrent: () => boolean, timeoutMs: number): Promise<T | null> {
    return new Promise(resolve => {
        let finished = false;
        const complete = (value: T | null) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer); clearInterval(poll);
            resolve(isCurrent() ? value : null);
        };
        const timer = setTimeout(() => complete(null), Math.max(0, timeoutMs));
        const poll = setInterval(() => {
            if (!isCurrent()) complete(null);
        }, 50);
        Promise.resolve().then(() => isCurrent() ? work() : null).then(complete, () => complete(null));
    });
}

export async function findLinkedSource(
    items: IMusic.IMusicItem[],
    resolve: (item: IMusic.IMusicItem) => Promise<Omit<LinkedSource, "item"> | null>,
    isCurrent: () => boolean,
    attempted: Set<string>,
    budgetMs = 8000,
    perSourceMs = 2500,
): Promise<LinkedSource | null> {
    const deadline = Date.now() + budgetMs;
    for (const item of items) {
        const key = trackSourceKey(item);
        if (!isCurrent() || Date.now() >= deadline) return null;
        if (attempted.has(key)) continue;
        attempted.add(key);
        const result = await waitForSource(() => resolve(item), isCurrent, Math.min(perSourceMs, deadline - Date.now()));
        if (result?.source?.url && isCurrent()) return { ...result, item };
    }
    return null;
}

/** Keep the logical queue position/order markers while metadata uses the actual source. */
export function replaceLinkedQueueItem(queue: IMusic.IMusicItem[], from: IMusic.IMusicItem, to: IMusic.IMusicItem) {
    const fromKey = trackSourceKey(from);
    const toKey = trackSourceKey(to);
    const original = queue.find(item => trackSourceKey(item) === fromKey);
    const replacement = { ...to };
    if (original) for (const key of Object.getOwnPropertySymbols(original)) replacement[key] = original[key];
    const result = queue.filter(item => trackSourceKey(item) !== toKey || trackSourceKey(item) === fromKey)
        .map(item => trackSourceKey(item) === fromKey ? replacement : item);
    return original ? result : [...result, replacement];
}
