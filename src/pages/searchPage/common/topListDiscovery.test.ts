import type { Plugin } from "@/core/pluginManager";
import { loadChartDiscovery } from "./topListDiscovery";

jest.mock("@/utils/getOrCreateMMKV", () => ({ __esModule: true, default: () => ({}) }));

function makePlugin(hash = "source") {
    return {
        hash,
        methods: {
            getTopLists: jest.fn(async () => [{ title: "Charts", data: [{ id: "hot", title: "热歌榜" }, { id: "new", title: "新歌榜" }] }]),
            getTopListDetail: jest.fn(async board => ({ musicList: [{ title: `Song ${board.id}`, artist: "Artist" }] })),
        },
    } as unknown as Plugin;
}

describe("chart songs for search discovery", () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it("reuses known chart groups, deduplicates concurrent loads, and caches successful songs", async () => {
        const plugin = makePlugin();
        const groups: Record<string, IMusic.IMusicSheetGroupItem[]> = { source: [{ title: "Cached", data: [{ id: "cached", title: "热歌榜", platform: "source" }] }] };
        const [first, second] = await Promise.all([loadChartDiscovery([plugin], groups), loadChartDiscovery([plugin], groups)]);
        expect(first).toEqual([{ title: "Song cached", artist: "Artist" }]);
        expect(second).toEqual(first);
        expect(plugin.methods.getTopLists).not.toHaveBeenCalled();
        expect(plugin.methods.getTopListDetail).toHaveBeenCalledTimes(1);
        expect(await loadChartDiscovery([plugin])).toEqual(first);
        expect(plugin.methods.getTopListDetail).toHaveBeenCalledTimes(1);
    });

    it("bounds provider, board and song counts and keeps other charts when one fails", async () => {
        const first = makePlugin("one");
        const second = makePlugin("two");
        const unused = makePlugin("three");
        (first.methods.getTopListDetail as jest.Mock).mockRejectedValueOnce(new Error("network unavailable"));
        (second.methods.getTopListDetail as jest.Mock).mockResolvedValue({ musicList: Array.from({ length: 100 }, (_, index) => ({ title: `Song ${index}`, artist: "Artist" })) });
        const songs = await loadChartDiscovery([first, second, unused]);
        expect(songs).toHaveLength(61);
        expect(first.methods.getTopListDetail).toHaveBeenCalledTimes(2);
        expect(second.methods.getTopListDetail).toHaveBeenCalledTimes(2);
        expect(unused.methods.getTopLists).not.toHaveBeenCalled();
    });

    it("expires the pool after five minutes and retries failures on the next visit", async () => {
        jest.useFakeTimers();
        const plugin = makePlugin();
        (plugin.methods.getTopLists as jest.Mock).mockRejectedValueOnce(new Error("offline"));
        expect(await loadChartDiscovery([plugin])).toEqual([]);
        expect(await loadChartDiscovery([plugin])).toHaveLength(2);
        jest.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);
        expect(await loadChartDiscovery([plugin])).toHaveLength(2);
        expect(plugin.methods.getTopLists).toHaveBeenCalledTimes(3);
    });

    it("times out stalled index and detail calls without blocking local suggestions", async () => {
        jest.useFakeTimers();
        const indexPlugin = makePlugin("stalled-index");
        (indexPlugin.methods.getTopLists as jest.Mock).mockImplementation(() => new Promise(() => {}));
        const indexLoad = loadChartDiscovery([indexPlugin]);
        await jest.advanceTimersByTimeAsync(5000);
        expect(await indexLoad).toEqual([]);
        const detailPlugin = makePlugin("stalled-detail");
        (detailPlugin.methods.getTopListDetail as jest.Mock).mockImplementation(() => new Promise(() => {}));
        const detailLoad = loadChartDiscovery([detailPlugin]);
        await jest.advanceTimersByTimeAsync(5000);
        expect(await detailLoad).toEqual([]);
        expect(jest.getTimerCount()).toBe(0);
    });

    it("handles sources with no charts and malformed or blank song lists", async () => {
        expect(await loadChartDiscovery([])).toEqual([]);
        const plugin = makePlugin();
        (plugin.methods.getTopLists as jest.Mock).mockResolvedValueOnce([]);
        expect(await loadChartDiscovery([plugin])).toEqual([]);
        (plugin.methods.getTopListDetail as jest.Mock).mockResolvedValueOnce({ musicList: null }).mockResolvedValueOnce({ musicList: [null, { title: " " }, { title: "Valid", artist: "Artist" }] });
        expect(await loadChartDiscovery([plugin])).toEqual([{ title: "Valid", artist: "Artist" }]);
    });
});
