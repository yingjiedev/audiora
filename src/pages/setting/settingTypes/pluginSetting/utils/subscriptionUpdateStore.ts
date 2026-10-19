import { IInstallPluginResult } from "@/types/core/pluginManager";
import installPluginFromUrl, { SubscriptionInstallOptions } from "./installPluginFromUrl";
import { Subscription } from "./subscriptions";

export interface SubscriptionUpdate {
    phase: "queued" | "fetching" | "updating" | "finished" | "cancelled" | "timedOut";
    total?: number;
    results: IInstallPluginResult[];
    finishedAt?: number;
}

export interface SubscriptionUpdateState {
    running: boolean;
    cancelling: boolean;
    updates: Record<string, SubscriptionUpdate>;
}

type Installer = (url: string, options: SubscriptionInstallOptions) => Promise<IInstallPluginResult[]>;
type History = Record<string, SubscriptionUpdate>;

export function createSubscriptionUpdateStore({ install = installPluginFromUrl, read = () => ({}), save = () => {} }: {
    install?: Installer;
    read?: () => History;
    save?: (history: History) => void;
} = {}) {
    let state: SubscriptionUpdateState = { running: false, cancelling: false, updates: read() };
    let controller: AbortController | undefined;
    let pending: Promise<void> | undefined;
    const listeners = new Set<() => void>();
    const publish = (next: SubscriptionUpdateState) => {
        state = next;
        listeners.forEach(listener => listener());
    };
    const update = (url: string, value: SubscriptionUpdate) => publish({ ...state, updates: { ...state.updates, [url]: value } });
    function start(items: Subscription[], retryOnly = false): Promise<void> {
        if (pending) {
            return pending;
        }
        const uniqueItems = [...new Map(items.map(item => [item.url, item])).values()];
        if (!uniqueItems.length) {
            return Promise.resolve();
        }
        const previous = state.updates;
        const currentController = new AbortController();
        controller = currentController;
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            publish({ ...state, cancelling: true });
            currentController.abort();
        }, 120_000);
        publish({ ...state, running: true, cancelling: false, updates: {
            ...state.updates,
            ...Object.fromEntries(uniqueItems.map(item => [item.url, { phase: "queued", results: [] }])),
        } });
        pending = Promise.resolve().then(async () => {
            for (const item of uniqueItems) {
                if (currentController.signal.aborted) {
                    break;
                }
                const old = previous[item.url];
                const failedUrls = old?.results.filter(result => !result.success).map(result => result.pluginUrl).filter((url): url is string => !!url);
                const pluginUrls = retryOnly && failedUrls?.length && !failedUrls.includes(item.url) ? failedUrls : undefined;
                const kept = pluginUrls ? old?.results.filter(result => result.success) ?? [] : [];
                update(item.url, { phase: "fetching", results: kept });
                try {
                    const results = await install(item.url, {
                        signal: currentController.signal,
                        pluginUrls,
                        onProgress(progress) {
                            update(item.url, { ...progress, total: progress.total === undefined ? undefined : progress.total + kept.length, results: [...kept, ...progress.results] });
                        },
                    });
                    if (!results.length && !currentController.signal.aborted) {
                        throw new Error("Empty subscription update result");
                    }
                    update(item.url, {
                        ...state.updates[item.url],
                        phase: currentController.signal.aborted ? timedOut ? "timedOut" : "cancelled" : "finished",
                        results: [...kept, ...results],
                        finishedAt: Date.now(),
                    });
                } catch (e: any) {
                    update(item.url, {
                        phase: currentController.signal.aborted ? timedOut ? "timedOut" : "cancelled" : "finished",
                        results: [...state.updates[item.url].results, ...(!currentController.signal.aborted ? [{ success: false, pluginUrl: item.url, message: e?.message ?? "" }] : [])],
                        finishedAt: Date.now(),
                    });
                }
            }
        }).finally(() => {
            clearTimeout(timer);
            const updates = { ...state.updates };
            for (const item of uniqueItems) {
                if (updates[item.url].phase === "queued") {
                    updates[item.url] = { phase: timedOut ? "timedOut" : "cancelled", results: [], finishedAt: Date.now() };
                }
            }
            controller = undefined;
            pending = undefined;
            publish({ running: false, cancelling: false, updates });
            try {
                save(Object.fromEntries(Object.entries(updates).sort((a, b) => (b[1].finishedAt ?? 0) - (a[1].finishedAt ?? 0)).slice(0, 50)));
            } catch {
                // The in-memory result remains available when persistence fails.
            }
        });
        return pending;
    }
    return {
        getSnapshot: () => state,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        start,
        cancel() {
            if (controller && !state.cancelling) {
                publish({ ...state, cancelling: true });
                controller.abort();
            }
        },
    };
}
