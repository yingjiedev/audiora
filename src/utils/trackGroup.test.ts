import { groupTracks, interleaveTracks, trackSourceKey } from "./trackGroup";

const song = (platform: string, duration = 200, patch = {}) => ({
    id: "1", platform, title: "Song", artist: "Artist", duration, ...patch,
}) as IMusic.IMusicItem;

describe("non-destructive track grouping", () => {
    it("keeps original source objects and plugin-specific fields", () => {
        const a = song("A", 200, { aid: 123 });
        const b = song("B", 205);
        const groups = groupTracks([a, b]);
        expect(groups).toHaveLength(1);
        expect(groups[0].candidates[0]).toBe(a);
        expect(groups[0].candidates[1]).toBe(b);
        expect(groups[0].candidates[0].aid).toBe(123);
    });
    it("does not transitively chain 200, 204 and 208 second recordings", () => {
        expect(groupTracks([song("A"), song("B", 204), song("C", 208)]).map(group => group.candidates.length)).toEqual([2, 1]);
    });
    it.each([
        { title: "Song (Live)" }, { title: "Song (Remix)" }, { artist: "Other" },
        { title: "" }, { artist: "" }, { duration: 0 }, { duration: NaN }, { duration: undefined }, { duration: 205.001 },
    ])("keeps ambiguous or distinct versions separate: %j", patch => {
        expect(groupTracks([song("A"), song("B", 200, patch)])).toHaveLength(2);
    });
    it("deduplicates identity strings without rewriting numeric plugin IDs", () => {
        const numeric = song("A", 200, { id: 1 });
        const groups = groupTracks([numeric, song("A")]);
        expect(groups).toHaveLength(1);
        expect(groups[0].candidates[0].id).toBe(1);
        expect(trackSourceKey(song("A@B", 200, { id: "C" }))).not.toBe(trackSourceKey(song("A", 200, { id: "B@C" })));
    });
    it("keeps different same-source IDs separate", () => {
        expect(groupTracks([song("A"), song("A", 200, { id: "2" })])).toHaveLength(2);
    });
    it("preserves visible anchors when earlier-ranked slow sources arrive", () => {
        const b = song("B");
        const other = song("B", 300, { id: "2", title: "Other" });
        const previous = groupTracks([b, other]);
        const groups = groupTracks([song("A"), b, other], previous);
        expect(groups.map(group => group.key)).toEqual(previous.map(group => group.key));
        expect(groups[0].candidates[0]).toBe(b);
        expect(groups[0].candidates).toHaveLength(2);
        expect(previous[0].candidates).toHaveLength(1);
    });
    it("interleaves by source rank and accepts empty sources", () => {
        const a = song("A"), b = song("B"), c = song("A", 300, { id: "2" });
        expect(interleaveTracks([[a, c], [], [b]])).toEqual([a, b, c]);
        expect(interleaveTracks([])).toEqual([]);
    });
});
