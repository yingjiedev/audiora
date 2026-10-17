/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import { getDefaultStore } from "jotai";
import { resetSearch, runSearch } from "./searchController";
import { searchResultsAtom } from "./atoms";

const mockPlugins = ["a", "b", "c", "d"].map(hash => ({ hash, instance: { platform: hash, userVariables: [] as IPlugin.IUserVariable[] }, methods: { search: jest.fn() } }));
let mockOrder = mockPlugins;
jest.mock("@/core/pluginManager", () => ({ __esModule: true, default: { getSearchablePlugins: () => mockPlugins, getSortedSearchablePlugins: () => mockOrder, getUserVariables: () => ({}) } }));
jest.mock("@/constants/commonConst", () => ({ RequestStateCode: { PENDING_FIRST_PAGE: 2, PENDING_REST_PAGE: 3, PARTLY_DONE: 4, FINISHED: 8, ERROR: 128 } }));
const store = getDefaultStore();
const flush = async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
};
const item = (platform: string) => ({ platform, id: "1", title: "Song" });

describe("search publications", () => {
    let finish: Array<(value: unknown) => void>;
    beforeEach(() => {
        jest.useFakeTimers(); jest.clearAllMocks(); resetSearch();
        mockOrder = mockPlugins;
        mockPlugins.forEach(plugin => {
            plugin.instance.userVariables = [];
        });
        finish = [];
        mockPlugins.forEach((plugin, index) => plugin.methods.search.mockImplementation(() => new Promise(resolve => {
            finish[index] = resolve;
        })));
    });
    afterEach(() => {
        resetSearch(); jest.useRealTimers();
    });
    it("publishes the first result immediately, coalesces bursts and flushes completion", async () => {
        let notifications = 0;
        const unsubscribe = store.sub(searchResultsAtom, () => {
            notifications += 1;
        });
        const pending = runSearch("song", 1);
        await flush();
        finish[0]({ data: [item("a")], isEnd: true }); await flush();
        expect(store.get(searchResultsAtom).music.a.data).toHaveLength(1);
        const first = notifications;
        finish[1]({ data: [item("b")], isEnd: true }); await flush();
        finish[2]({ data: [item("c")], isEnd: true }); await flush();
        expect(notifications).toBe(first);
        jest.advanceTimersByTime(50);
        expect(notifications).toBe(first + 1);
        expect(store.get(searchResultsAtom).music.c.data).toHaveLength(1);
        finish[3]({ data: [item("d")], isEnd: true }); await pending;
        expect(store.get(searchResultsAtom).music.d.data).toHaveLength(1);
        expect(jest.getTimerCount()).toBe(0);
        unsubscribe();
    });
    it("keeps untouched source and media-type references stable", async () => {
        const pending = runSearch("song", 1);
        await flush();
        finish[0]({ data: [item("a")], isEnd: true }); await flush();
        const first = store.get(searchResultsAtom);
        finish[1]({ data: [item("b")], isEnd: true }); await flush();
        jest.advanceTimersByTime(50);
        const next = store.get(searchResultsAtom);
        expect(next.music.a).toBe(first.music.a);
        expect(next.album).toBe(first.album);
        expect(next.music).not.toBe(first.music);
        resetSearch(); await pending;
    });
    it("cancels an unpublished old batch on a new query", async () => {
        const pending = runSearch("old", 1);
        await flush();
        finish[0]({ data: [item("a")], isEnd: true }); await flush();
        finish[1]({ data: [item("b")], isEnd: true }); await flush();
        resetSearch("new"); await pending;
        const next = store.get(searchResultsAtom);
        jest.advanceTimersByTime(100);
        expect(store.get(searchResultsAtom)).toBe(next);
        expect(next.music).toEqual({});
        expect(jest.getTimerCount()).toBe(0);
    });
    it("dispatches the user's preferred sources first while retaining all sources", async () => {
        mockOrder = [mockPlugins[3], mockPlugins[2], mockPlugins[1], mockPlugins[0]];
        const pending = runSearch("song", 1);
        await flush();
        expect(mockPlugins[3].methods.search).toHaveBeenCalledTimes(1);
        expect(mockPlugins[0].methods.search).not.toHaveBeenCalled();
        expect(Object.keys(store.get(searchResultsAtom).music)).toEqual(["d", "c", "b", "a"]);
        resetSearch(); await pending;
    });
    it("preflights required settings and excludes configuration failures from bulk retries", async () => {
        mockPlugins[0].instance.userVariables = [{ key: "url", required: true }];
        mockPlugins[1].methods.search.mockRejectedValueOnce({ code: "ERR_NETWORK" }).mockResolvedValueOnce({ data: [], isEnd: true });
        mockPlugins[2].methods.search.mockResolvedValue({ data: [], isEnd: true });
        mockPlugins[3].methods.search.mockResolvedValue({ data: [], isEnd: true });
        await runSearch("song", 1);
        expect(mockPlugins[0].methods.search).not.toHaveBeenCalled();
        expect(store.get(searchResultsAtom).music.a).toMatchObject({ phase: "error", error: { kind: "configuration", retryable: false } });
        await runSearch(undefined, undefined, "music", undefined, undefined, "retry");
        expect(mockPlugins[1].methods.search).toHaveBeenCalledTimes(2);
        expect(mockPlugins[2].methods.search).toHaveBeenCalledTimes(1);
        expect(mockPlugins[0].methods.search).not.toHaveBeenCalled();
        await runSearch(undefined, undefined, "music", "a", undefined, "retry");
        expect(store.get(searchResultsAtom).music.a.error?.kind).toBe("configuration");
        expect(jest.getTimerCount()).toBe(0);
    });
});
