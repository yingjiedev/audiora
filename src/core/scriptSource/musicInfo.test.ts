import { inferSourceProvider, resolveSourceProvider, toScriptMusicInfo } from "./musicInfo";

describe("platform-native song conversion", () => {
    const base: any = { id: "42", title: "Song", artist: "Artist", album: "Album", duration: 125, platform: "catalog" };

    it("uses explicit bindings and song-level platform identifiers", () => {
        expect(resolveSourceProvider({ ...base, providerId: "tx" }, "wy")).toBe("wy");
        expect(resolveSourceProvider({ ...base, providerId: "tx" })).toBe("tx");
        expect(resolveSourceProvider(base, undefined, "kw")).toBe("kw");
        expect(inferSourceProvider("网易云音乐插件")).toBe("wy");
        expect(inferSourceProvider("custom-tx-service")).toBeUndefined();
        expect(() => resolveSourceProvider(base)).toThrow("解析平台");
    });

    it("preserves the queue object and its existing quality source map", () => {
        const source = Object.freeze({ "320k": { url: "https://example.invalid/old" } });
        const item = Object.freeze({ ...base, source, privateField: { token: "fixture" } });
        const result = toScriptMusicInfo(item, "wy");
        expect(result).toMatchObject({ source: "wy", songmid: "42", name: "Song", singer: "Artist", albumName: "Album", interval: "02:05" });
        expect(item.source).toBe(source);
        expect((result as any).privateField).toEqual(item.privateField);
    });

    it("keeps QQ numeric ID, song mid and media mid distinct", () => {
        const result = toScriptMusicInfo({ ...base, id: 123, songmid: "song-mid", strMediaMid: "media-mid", albumMid: "album-mid" }, "tx");
        expect(result).toMatchObject({ id: 123, songmid: "song-mid", strMediaMid: "media-mid", albumMid: "album-mid" });
        expect(result.meta).toMatchObject({ songId: "song-mid", strMediaMid: "media-mid" });
    });

    it("preserves per-quality hashes and nested provider metadata", () => {
        const result = toScriptMusicInfo({ ...base, hash: "base-hash", "320hash": "high-hash", sqhash: "lossless-hash",
            meta: { albumId: 7 }, types: [{ type: "flac24bit", hash: "24-bit-hash" }],
        }, "kg");
        expect(result._types["320k"].hash).toBe("high-hash");
        expect(result._types.flac.hash).toBe("lossless-hash");
        expect(result._types.flac24bit.hash).toBe("24-bit-hash");
        expect(result.hash).toBe("base-hash");
        expect(result.albumId).toBe(7);
    });

    it("uses copyright and song IDs without dropping zero-valued identifiers", () => {
        expect(toScriptMusicInfo({ ...base, copyrightId: "copyright" }, "mg").songmid).toBe("copyright");
        expect(toScriptMusicInfo({ ...base, id: 0 }, "kw").songmid).toBe(0);
        expect(() => toScriptMusicInfo({ ...base, id: "" }, "wy")).toThrow("歌曲信息不足");
    });

    it("normalizes explicit native RIDs and tolerates missing duration and malformed optional quality arrays", () => {
        const result = toScriptMusicInfo({ ...base, rid: "MUSIC_123", duration: Infinity, types: {} }, "kw");
        expect(result.songmid).toBe("123");
        expect(result.interval).toBe("00:00");
        expect(result.types).toEqual([]);
    });
});
