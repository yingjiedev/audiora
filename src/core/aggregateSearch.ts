import { classifySearchError, SearchFailure, SearchRequestError } from "./searchError";

export interface SearchPage<T> {
    data: T[];
    isEnd?: boolean;
}

export interface SearchSource<T> {
    key: string;
    search(query: string, page: number): Promise<SearchPage<T>>;
}

export interface SourceSearchResult<T> {
    state: "queued" | "loading" | "ready" | "finished" | "error" | "deferred";
    data: T[];
    /** Last successfully loaded page. Failed requests do not advance it. */
    page: number;
    requestedPage: number;
    /** Replacement generation; append pages preserve it. */
    dataVersion: number;
    error?: SearchFailure;
    waitMs?: number;
    elapsedMs?: number;
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
    private inFlight = new Map<string, { page: number; promise: Promise<SearchPage<T>> }>();

    constructor(
        private onChange: () => void,
        private getKey: (item: T) => string,
        private concurrency = 3,
        private timeoutMs = 10_000,
        private requestBudgetMs = 45_000,
    ) {}

    reset(query = "") {
        this.session += 1;
        this.query = query;
        for (const task of [...this.queue, ...this.active]) task.cancel();
        this.queue = [];
        this.active.clear();
        this.results = {};
        this.dataKeys.clear();
        this.inFlight.clear();
        this.onChange();
    }

    request(sources: SearchSource<T>[], operation: SearchOperation, explicitPage?: number) {
        const session = this.session;
        const query = this.query;
        const deadline = Date.now() + this.requestBudgetMs;
        const requests: Promise<void>[] = [];
        for (const source of sources) {
            const previous = this.results[source.key];
            if (previous?.state === "loading" || previous?.state === "queued") continue;
            if (operation === "ensure" && previous) continue;
            if (operation === "retry" && previous?.state !== "error" && previous?.state !== "deferred") continue;
            if (operation === "next" && (previous?.state === "error" || previous?.state === "deferred" || previous?.state === "finished")) continue;
            const page = explicitPage ?? (operation === "retry" ? previous!.requestedPage
                : operation === "refresh" ? 1 : (previous?.page ?? 0) + 1);
            const result: SourceSearchResult<T> = {
                state: "queued",
                data: previous?.data ?? [],
                page: previous?.page ?? 0,
                requestedPage: page,
                dataVersion: previous?.dataVersion ?? 0,
            };
            this.results = { ...this.results, [source.key]: result };
            let finish!: () => void;
            let cancelWait: (() => void) | undefined;
            let cancelled = false;
            const queuedAt = Date.now();
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
                    let startedAt: number | undefined;
                    try {
                        // Only admit work with a full execution window remaining. Queue time
                        // never shortens a source's timeout or becomes a source failure.
                        if (Date.now() + this.timeoutMs > deadline) {
                            this.results = { ...this.results, [source.key]: { ...result, state: "deferred", waitMs: Date.now() - queuedAt } };
                            return;
                        }
                        startedAt = Date.now();
                        this.results = { ...this.results, [source.key]: { ...result, state: "loading", waitMs: startedAt - queuedAt } };
                        this.onChange();
                        const response = await new Promise<SearchPage<T> | null>((resolve, reject) => {
                            const timer = setTimeout(() => reject(new SearchRequestError({ kind: "timeout", retryable: true })), this.timeoutMs);
                            cancelWait = () => {
                                clearTimeout(timer); resolve(null);
                            };
                            // A timeout stops host waiting, not plugin I/O. Retrying the
                            // same page observes the existing call instead of duplicating it.
                            let flight = this.inFlight.get(source.key);
                            if (!flight || flight.page !== page) {
                                const promise = Promise.resolve().then(() => cancelled || session !== this.session ? { data: [], isEnd: true } : source.search(query, page));
                                flight = { page, promise };
                                this.inFlight.set(source.key, flight);
                                const current = flight;
                                const clear = () => {
                                    if (this.inFlight.get(source.key) === current) this.inFlight.delete(source.key);
                                };
                                promise.then(clear, clear);
                            }
                            flight.promise.then(
                                value => {
                                    clearTimeout(timer); resolve(value);
                                },
                                error => {
                                    clearTimeout(timer); reject(error);
                                },
                            );
                        });
                        if (cancelled || session !== this.session) return;
                        if (!response || !Array.isArray(response.data)) throw new SearchRequestError({ kind: "invalidResponse", retryable: false });
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
                                waitMs: startedAt - queuedAt,
                                elapsedMs: Date.now() - startedAt,
                            },
                        };
                    } catch (error) {
                        if (cancelled || session !== this.session) return;
                        this.results = { ...this.results, [source.key]: {
                            ...result, state: "error", error: classifySearchError(error),
                            waitMs: (startedAt ?? Date.now()) - queuedAt,
                            elapsedMs: startedAt === undefined ? 0 : Date.now() - startedAt,
                        } };
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
