import { buildSearchDiscovery, getDiscoveryBatch } from "./searchDiscovery";

describe("search discovery from existing music", () => {
    it("interleaves recent and favorite keywords and removes blanks and duplicate searches", () => {
        const items = buildSearchDiscovery(
            [{ title: "  Sea  ", artist: "Artist" }, { title: "ＳＥＡ", artist: " " }],
            [{ title: "Favorite", artist: "artist" }, { title: "", artist: "Other" }],
            [" Sea "],
        );
        expect(items).toEqual([
            { query: "Artist", source: "recent" },
            { query: "Favorite", source: "favorite" },
            { query: "Other", source: "favorite" },
        ]);
    });

    it("uses an empty state for new listeners and bounds the source scan", () => {
        expect(buildSearchDiscovery([], [], [])).toEqual([]);
        const recent = Array.from({ length: 41 }, (_, index) => ({ title: `Song ${index}`, artist: "Same artist" }));
        const items = buildSearchDiscovery(recent, [], []);
        expect(items).toHaveLength(41);
        expect(items.some(item => item.query === "Song 40")).toBe(false);
    });

    it("cycles all batches including the shorter final batch without duplicate rows", () => {
        const items = buildSearchDiscovery(Array.from({ length: 5 }, (_, index) => ({ title: `Song ${index}`, artist: `Artist ${index}` })), [], []);
        expect(getDiscoveryBatch(items, 0)).toEqual(items.slice(0, 8));
        expect(getDiscoveryBatch(items, 1)).toEqual(items.slice(8));
        expect(getDiscoveryBatch(items, 2)).toEqual(items.slice(0, 8));
        expect(getDiscoveryBatch([], 1)).toEqual([]);
        expect(getDiscoveryBatch(items, 0, 0)).toEqual([]);
    });

    it("adds chart song titles without repeating history, personal keywords, or artists", () => {
        const items = buildSearchDiscovery([{ title: "Local", artist: "Artist" }], [], ["History"], [
            { title: " LOCAL ", artist: "Other" },
            { title: "History", artist: "Other" },
            { title: "Chart song", artist: "Chart artist" },
            { title: "chart SONG", artist: "Duplicate artist" },
        ]);
        expect(items.filter(item => item.source === "chart")).toEqual([{ query: "Chart song", source: "chart" }]);
        expect(items.some(item => item.query === "Chart artist")).toBe(false);
    });

    it("randomly inserts two chart songs while keeping personal suggestions and their order", () => {
        const items = buildSearchDiscovery(Array.from({ length: 5 }, (_, index) => ({ title: `Local ${index}`, artist: `Artist ${index}` })), [], [],
            Array.from({ length: 10 }, (_, index) => ({ title: `Chart ${index}`, artist: "Chart artist" })));
        const first = getDiscoveryBatch(items, 0, 8, () => 0);
        const second = getDiscoveryBatch(items, 0, 8, () => 0.99);
        expect(first.filter(item => item.source === "chart")).toHaveLength(2);
        expect(first.filter(item => item.source !== "chart")).toEqual(items.slice(0, 6));
        expect(new Set(first.map(item => item.query)).size).toBe(8);
        expect(first).not.toEqual(second);
        expect(items).toHaveLength(20);
    });

    it("fills available slots with charts for new listeners and handles a one-item batch", () => {
        const items = buildSearchDiscovery([], [], [], [{ title: "One", artist: "A" }, { title: "Two", artist: "B" }]);
        expect(getDiscoveryBatch(items, 0, 8, () => 0)).toHaveLength(2);
        expect(getDiscoveryBatch(items, 0, 1, () => 0)).toHaveLength(1);
    });
});
