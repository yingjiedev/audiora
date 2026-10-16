export interface SearchPage<T> {
    data: T[];
    isEnd?: boolean;
}

export interface SearchSource<T> {
    key: string;
    search(query: string, page: number): Promise<SearchPage<T>>;
}

export interface SourceSearchResult<T> {
    state: "loading" | "ready" | "finished" | "error";
    data: T[];
    /** Last successfully loaded page. Failed requests do not advance it. */
    page: number;
    requestedPage: number;
    /** Replacement generation; append pages preserve it. */
    dataVersion: number;
}

export type SearchOperation = "ensure" | "next" | "retry" | "refresh";

interface SearchTask {
    run(): Promise<void>;
    cancel(): void;
}

/** Shared session and scheduler; a timeout never claims to abort plugin I/O. */
export class AggregateSearch<T> {
    query = "";
    results: Record<string, SourceSearchResult<T>> = {};
    private session = 0;
    private queue: SearchTask[] = [];
    private active = new Set<SearchTask>();
    private dataKeys = new Map<string, Set<string>>();

    constructor(
        private onChange: () => void,
        private getKey: (item: T) => string,
        private concurrency = 3,
        private timeoutMs = 10_000,
        private requestBudgetMs = 15_000,
    ) {}

    reset(query = "") {
        this.session += 1;
        this.query = query;
        for (const task of [...this.queue, ...this.active]) task.cancel();
        this.queue = [];
        this.active.clear();
        this.results = {};
        this.dataKeys.clear();
        this.onChange();
    }

    request(sources: SearchSource<T>[], operation: SearchOperation, explicitPage?: number) {
        const session = this.session;
        const query = this.query;
        const deadline = Date.now() + this.requestBudgetMs;
        const requests: Promise<void>[] = [];
        for (const source of sources) {
            const previous = this.results[source.key];
            if (previous?.state === "loading") continue;
            if (operation === "ensure" && previous) continue;
            if (operation === "retry" && previous?.state !== "error") continue;
            if (operation === "next" && (previous?.state === "error" || previous?.state === "finished")) continue;
            const page = explicitPage ?? (operation === "retry" ? previous!.requestedPage
                : operation === "refresh" ? 1 : (previous?.page ?? 0) + 1);
            const result: SourceSearchResult<T> = {
                state: "loading",
                data: previous?.data ?? [],
                page: previous?.page ?? 0,
                requestedPage: page,
                dataVersion: previous?.dataVersion ?? 0,
            };
            this.results = { ...this.results, [source.key]: result };
            let finish!: () => void;
            let cancelWait: (() => void) | undefined;
            let cancelled = false;
            requests.push(new Promise<void>(resolve => {
                finish = resolve;
            }));
            const task: SearchTask = {
                cancel() {
                    cancelled = true;
                    cancelWait?.();
                    finish();
                },
                run: async () => {
                    try {
                        if (Date.now() >= deadline) throw new Error("Search budget exhausted");
                        const response = await new Promise<SearchPage<T> | null>((resolve, reject) => {
                            const timer = setTimeout(() => reject(new Error("Search timed out")), Math.min(this.timeoutMs, deadline - Date.now()));
                            cancelWait = () => {
                                clearTimeout(timer); resolve(null);
                            };
                            Promise.resolve().then(() => cancelled ? null : source.search(query, page)).then(
                                value => {
                                    clearTimeout(timer); resolve(value);
                                },
                                error => {
                                    clearTimeout(timer); reject(error);
                                },
                            );
                        });
                        if (cancelled || session !== this.session) return;
                        if (!response || !Array.isArray(response.data)) throw new Error("Invalid search response");
                        const existing = page === 1 ? [] : result.data;
                        const keys = page === 1 ? new Set<string>() : this.dataKeys.get(source.key) ?? new Set(existing.map(this.getKey));
                        const incoming = new Set<string>();
                        const additions = response.data.filter(item => {
                            const key = this.getKey(item);
                            if (keys.has(key) || incoming.has(key)) return false;
                            incoming.add(key);
                            return true;
                        });
                        for (const key of incoming) keys.add(key);
                        this.dataKeys.set(source.key, keys);
                        this.results = {
                            ...this.results,
                            [source.key]: {
                                state: response.isEnd === false && additions.length > 0 ? "ready" : "finished",
                                data: page !== 1 && !additions.length ? existing : [...existing, ...additions],
                                page,
                                requestedPage: page,
                                dataVersion: result.dataVersion + (page === 1 ? 1 : 0),
                            },
                        };
                    } catch {
                        if (cancelled || session !== this.session) return;
                        this.results = { ...this.results, [source.key]: { ...result, state: "error" } };
                    } finally {
                        if (!cancelled && session === this.session) this.onChange();
                        finish();
                    }
                },
            };
            this.queue.push(task);
        }
        this.onChange();
        this.drain();
        return Promise.all(requests).then(() => undefined);
    }

    private drain() {
        while (this.active.size < this.concurrency && this.queue.length) {
            const task = this.queue.shift()!;
            this.active.add(task);
            task.run().finally(() => {
                this.active.delete(task);
                this.drain();
            });
        }
    }
}
