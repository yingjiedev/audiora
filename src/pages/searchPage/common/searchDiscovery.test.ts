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
});
