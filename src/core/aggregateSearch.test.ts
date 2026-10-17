import { AggregateSearch, SearchPage } from "./aggregateSearch";

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes; reject = no;
    });
    return { promise, resolve, reject };
}

const flush = async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

describe("aggregate search sessions", () => {
    let search: AggregateSearch<string>;
    beforeEach(() => {
        jest.useFakeTimers();
        search = new AggregateSearch(() => {}, item => item, 3, 100);
        search.reset("song");
    });
    afterEach(() => {
        search.reset(); jest.useRealTimers();
    });

    it("bounds concurrency, streams early successes and deduplicates repeated requests", async () => {
        const waits = Array.from({ length: 5 }, () => deferred<SearchPage<string>>());
        const sources = waits.map((wait, index) => ({ key: String(index), search: jest.fn(() => wait.promise) }));
        const done = search.request(sources, "ensure");
        await flush();
        expect(sources.filter(source => source.search.mock.calls.length)).toHaveLength(3);
        await search.request(sources, "ensure");
        waits[0].resolve({ data: ["early"], isEnd: true });
        await flush();
        expect(search.results["0"].data).toEqual(["early"]);
        expect(sources[3].search).toHaveBeenCalledTimes(1);
        for (const wait of waits) wait.resolve({ data: [], isEnd: true });
        await done;
        expect(sources.every(source => source.search.mock.calls.length === 1)).toBe(true);
    });

    it("keeps successful pages and retries exactly the failed page", async () => {
        const source = { key: "a", search: jest.fn()
            .mockResolvedValueOnce({ data: ["one"], isEnd: false })
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce({ data: ["one", "two"], isEnd: true }) };
        await search.request([source], "ensure");
        await search.request([source], "next");
        expect(search.results.a).toMatchObject({ state: "error", page: 1, requestedPage: 2, data: ["one"] });
        await search.request([source], "next");
        expect(source.search).toHaveBeenCalledTimes(2);
        await search.request([source], "retry");
        expect(source.search.mock.calls.map(call => call[1])).toEqual([1, 2, 2]);
        expect(search.results.a.data).toEqual(["one", "two"]);
    });

    it("honors an explicit second page", async () => {
        const source = { key: "a", search: jest.fn(async () => ({ data: ["two"], isEnd: true })) };
        await search.request([source], "ensure", 2);
        expect(source.search).toHaveBeenCalledWith("song", 2);
    });

    it("retains old data on refresh failure and retries page one", async () => {
        const source = { key: "a", search: jest.fn().mockResolvedValue({ data: ["one"], isEnd: false }) };
        await search.request([source], "ensure");
        source.search.mockRejectedValueOnce(new Error("offline"));
        await search.request([source], "refresh");
        expect(search.results.a.data).toEqual(["one"]);
        await search.request([source], "retry");
        expect(source.search.mock.calls.map(call => call[1])).toEqual([1, 1, 1]);
    });

    it.each(["resolve", "reject"] as const)("ignores a previous A session's late %s after A → B → A", async outcome => {
        const old = deferred<SearchPage<string>>();
        const source = { key: "a", search: jest.fn().mockImplementationOnce(() => old.promise)
            .mockResolvedValue({ data: ["new"], isEnd: true }) };
        const cancelled = search.request([source], "ensure");
        await flush();
        search.reset("other"); search.reset("song");
        await search.request([source], "ensure");
        if (outcome === "resolve") old.resolve({ data: ["old"] });
        else old.reject(new Error("old error"));
        await cancelled; await flush();
        expect(search.results.a).toMatchObject({ state: "finished", data: ["new"] });
    });

    it("times out a hung source, frees the scheduler and ignores a late response", async () => {
        search = new AggregateSearch(() => {}, item => item, 1, 100);
        search.reset("song");
        const old = deferred<SearchPage<string>>();
        const sources = [{ key: "a", search: () => old.promise }, { key: "b", search: jest.fn(async () => ({ data: ["b"] })) }];
        const done = search.request(sources, "ensure");
        await flush();
        jest.advanceTimersByTime(100); await done;
        expect(search.results.a.state).toBe("error");
        expect(search.results.b.data).toEqual(["b"]);
        old.resolve({ data: ["late"] }); await flush();
        expect(search.results.a.state).toBe("error");
    });

    it.each([{ data: [] }, { data: ["one"] }])("stops pagination when a page adds no new items: %j", async ({ data: duplicatePage }) => {
        const source = { key: "a", search: jest.fn()
            .mockResolvedValueOnce({ data: ["one"], isEnd: false })
            .mockResolvedValueOnce({ data: duplicatePage, isEnd: false }) };
        await search.request([source], "ensure");
        await search.request([source], "next");
        expect(search.results.a.state).toBe("finished");
        await search.request([source], "next");
        expect(source.search).toHaveBeenCalledTimes(2);
    });

    it("cancels queued calls on exit and settles their callers", async () => {
        const never = deferred<SearchPage<string>>();
        const sources = Array.from({ length: 5 }, (_, i) => ({ key: String(i), search: jest.fn(() => never.promise) }));
        const done = search.request(sources, "ensure");
        await flush(); search.reset(); await done;
        expect(sources[3].search).not.toHaveBeenCalled();
        expect(search.results).toEqual({});
    });
    it("defers unstarted sources at the batch limit without calling them failed and allows continuation", async () => {
        search = new AggregateSearch(() => {}, item => item, 2, 100, 150);
        search.reset("song");
        const sources = Array.from({ length: 8 }, (_, i) => ({ key: String(i), search: jest.fn(() => new Promise<SearchPage<string>>(() => {})) }));
        const done = search.request(sources, "ensure");
        await flush();
        jest.advanceTimersByTime(100); await flush();
        jest.advanceTimersByTime(50); await done;
        expect(Object.values(search.results).filter(result => result.state === "error")).toHaveLength(2);
        expect(Object.values(search.results).filter(result => result.state === "deferred")).toHaveLength(6);
        expect(search.results["7"].error).toBeUndefined();
        expect(sources.filter(source => source.search.mock.calls.length)).toHaveLength(2);
        sources[7].search.mockResolvedValueOnce({ data: ["recovered"], isEnd: true });
        await search.request([sources[7]], "retry");
        expect(search.results["7"].data).toEqual(["recovered"]);
        expect(jest.getTimerCount()).toBe(0);
    });
    it("searches 24 healthy sources taking three seconds each without queue-induced failures", async () => {
        search = new AggregateSearch(() => {}, item => item);
        search.reset("song");
        const sources = Array.from({ length: 24 }, (_, i) => ({ key: String(i), search: jest.fn(() => new Promise<SearchPage<string>>(resolve => {
            setTimeout(() => resolve({ data: [String(i)], isEnd: true }), 3000);
        })) }));
        const done = search.request(sources, "ensure");
        await jest.advanceTimersByTimeAsync(24_000);
        await done;
        expect(Object.values(search.results).every(result => result.state === "finished")).toBe(true);
        expect(sources.every(source => source.search.mock.calls.length === 1)).toBe(true);
        expect(search.results["23"]).toMatchObject({ waitMs: 21_000, elapsedMs: 3000 });
        expect(jest.getTimerCount()).toBe(0);
    });
    it("gives an admitted queued source its complete execution timeout", async () => {
        search = new AggregateSearch(() => {}, item => item, 1, 100, 250);
        search.reset("song");
        const source = (key: string, delay: number) => ({ key, search: () => new Promise<SearchPage<string>>(resolve => {
            setTimeout(() => resolve({ data: [key] }), delay);
        }) });
        const done = search.request([source("first", 90), source("second", 90), source("third", 1)], "ensure");
        await jest.advanceTimersByTimeAsync(180);
        await done;
        expect(search.results.second).toMatchObject({ state: "finished", waitMs: 90, elapsedMs: 90 });
        expect(search.results.third.state).toBe("deferred");
    });
    it("does not duplicate plugin I/O when a timed-out page is retried before it settles", async () => {
        const wait = deferred<SearchPage<string>>();
        const source = { key: "a", search: jest.fn(() => wait.promise) };
        const first = search.request([source], "ensure");
        await flush();
        await jest.advanceTimersByTimeAsync(100);
        await first;
        expect(search.results.a.error).toEqual({ kind: "timeout", retryable: true });
        const retry = search.request([source], "retry");
        await flush();
        expect(source.search).toHaveBeenCalledTimes(1);
        wait.resolve({ data: ["recovered"], isEnd: true });
        await retry;
        expect(search.results.a).toMatchObject({ state: "finished", data: ["recovered"] });
        expect(search.results.a.error).toBeUndefined();
        expect(jest.getTimerCount()).toBe(0);
    });
    it("exposes queued and executing states and preserves safe failure diagnostics", async () => {
        search = new AggregateSearch(() => {}, item => item, 1, 100);
        search.reset("song");
        const first = deferred<SearchPage<string>>();
        const done = search.request([{ key: "a", search: () => first.promise }, { key: "b", search: async () => {
            throw { response: { status: 401 }, message: "password=secret", config: { authorization: "secret" } };
        } }], "ensure");
        await flush();
        expect(search.results.a.state).toBe("loading");
        expect(search.results.b.state).toBe("queued");
        first.resolve({ data: [] });
        await done;
        expect(search.results.a).toMatchObject({ state: "finished", data: [] });
        expect(search.results.b.error).toEqual({ kind: "authentication", status: 401, retryable: false });
        expect(JSON.stringify(search.results)).not.toContain("secret");
    });
    it("retains identity indexes on appends and only changes the replacement version on refresh success", async () => {
        const identity = jest.fn((item: string) => item);
        search = new AggregateSearch(() => {}, identity);
        search.reset("song");
        const source = { key: "a", search: jest.fn().mockResolvedValueOnce({ data: ["a", "b"], isEnd: false })
            .mockResolvedValueOnce({ data: ["b", "c"], isEnd: false })
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce({ data: ["new"], isEnd: true }) };
        await search.request([source], "ensure");
        const version = search.results.a.dataVersion;
        identity.mockClear();
        await search.request([source], "next");
        expect(identity).toHaveBeenCalledTimes(2);
        expect(search.results.a).toMatchObject({ data: ["a", "b", "c"], dataVersion: version });
        await search.request([source], "refresh");
        expect(search.results.a.dataVersion).toBe(version);
        await search.request([source], "retry");
        expect(search.results.a).toMatchObject({ data: ["new"], dataVersion: version + 1 });
    });
});
