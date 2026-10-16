import { groupTracks, interleaveTracks, trackSourceKey, TrackGroupIndex } from "./trackGroup";
import * as metadata from "@/utils/sheetMerge";

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

describe("incremental search grouping", () => {
    afterEach(() => jest.restoreAllMocks());
    it("only normalizes new songs and reuses untouched rows across appends and status updates", () => {
        const normalize = jest.spyOn(metadata, "normalizeTrackTitle");
        const index = new TrackGroupIndex();
        const firstPage = Array.from({ length: 1000 }, (_, i) => song("A", 200, { id: String(i), title: `Song ${i}` }));
        const first = index.sync([{ key: "a", data: firstPage, dataVersion: 1 }]);
        const calls = normalize.mock.calls.length;
        expect(index.sync([{ key: "a", data: firstPage, dataVersion: 1 }])).toBe(first);
        expect(normalize).toHaveBeenCalledTimes(calls);
        const next = index.sync([{ key: "a", data: [...firstPage, song("A", 200, { id: "next", title: "Next" })], dataVersion: 1 }]);
        expect(normalize).toHaveBeenCalledTimes(calls + 1);
        expect(next).toHaveLength(1001);
        expect(next[0]).toBe(first[0]);
        expect(first).toHaveLength(1000);
        normalize.mockRestore();
    });
    it("merges a late source into the existing anchor without mutating a published row", () => {
        const index = new TrackGroupIndex();
        const a = song("A"), b = song("B");
        const bData = [b];
        const normalize = jest.spyOn(metadata, "normalizeTrackTitle");
        const first = index.sync([{ key: "a", data: [], dataVersion: 0 }, { key: "b", data: bData, dataVersion: 1 }]);
        normalize.mockClear();
        const next = index.sync([{ key: "a", data: [a], dataVersion: 1 }, { key: "b", data: bData, dataVersion: 1 }]);
        expect(normalize).toHaveBeenCalledTimes(1);
        expect(next[0].key).toBe(first[0].key);
        expect(next[0].candidates).toEqual([b, a]);
        expect(first[0].candidates).toEqual([b]);
    });
    it("rebuilds on refresh, including same-ID metadata changes, and prunes removed sources", () => {
        const index = new TrackGroupIndex();
        const a = song("A"), b = song("B");
        index.sync([{ key: "a", data: [a], dataVersion: 1 }, { key: "b", data: [b], dataVersion: 1 }]);
        const changed = { ...a, title: "Different" };
        const next = index.sync([{ key: "a", data: [changed], dataVersion: 2 }, { key: "b", data: [b], dataVersion: 1 }]);
        expect(next).toHaveLength(2);
        expect(next[0].candidates[0]).toBe(changed);
        expect(index.sync([{ key: "a", data: [changed], dataVersion: 2 }]).flatMap(group => group.candidates)).toEqual([changed]);
    });
    it("snapshots source descriptors even when a caller reuses their containing array", () => {
        const index = new TrackGroupIndex();
        const a = song("A"), other = song("A", 200, { id: "2", title: "Other" });
        const sources = [{ key: "a", data: [a], dataVersion: 1 }];
        index.sync(sources);
        sources[0].data = [a, other];
        expect(index.sync(sources)).toHaveLength(2);
    });
    it("keeps the duration boundary and distinct versions when additions arrive in separate batches", () => {
        const index = new TrackGroupIndex();
        const sources = [song("A"), song("B", 204), song("C", 208), song("D", 200, { title: "Song (Live)" })];
        let groups = [];
        for (let count = 1; count <= sources.length; count += 1) {
            groups = index.sync(sources.slice(0, count).map(item => ({ key: item.platform, data: [item], dataVersion: 1 })));
        }
        expect(groups.map(group => group.candidates.length)).toEqual([2, 1, 1]);
    });
});
