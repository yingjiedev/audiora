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
});
