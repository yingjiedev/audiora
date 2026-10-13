import { groupLocalMusic } from "./libraryBrowser";

jest.mock("@/utils/mediaExtra", () => ({ getMediaExtraProperty: (item: any) => item?.extraLocalPath ?? null }));
jest.mock("@/constants/commonConst", () => ({ internalSerializeKey: "$", localPluginPlatform: "local" }));

function song(id: string, values: Partial<IMusic.IMusicItem> = {}) {
    return { id, platform: "local", title: id, artist: "Artist", album: "Album", duration: 180, artwork: "", ...values } as IMusic.IMusicItem;
}

describe("local library grouping", () => {
    it("keeps all members beyond the old six-item preview without changing the source", () => {
        const items = Array.from({ length: 20 }, (_, index) => song(String(index)));
        const result = groupLocalMusic(items, "artists", "en-US");
        expect(result).toHaveLength(1);
        expect(result[0].musicList).toEqual(items);
        expect(result[0].musicList[19]).toBe(items[19]);
        expect(items[0].artist).toBe("Artist");
    });

    it("separates equal folder labels using full paths", () => {
        const result = groupLocalMusic([song("a", { localPath: "/A/Music/a.mp3" }), song("b", { localPath: "/B/Music/b.mp3" })], "folders", "en-US");
        expect(result.map(group => group.name)).toEqual(["Music", "Music"]);
        expect(new Set(result.map(group => group.key)).size).toBe(2);
        expect(result.map(group => group.detail)).toEqual(["/A/Music", "/B/Music"]);
        expect(result.map(group => group.musicList.map(item => item.id))).toEqual([["a"], ["b"]]);
    });

    it("reads legacy, symbol, extra, file-URL and Windows paths", () => {
        const symbolSong = song("symbol");
        symbolSong[Symbol.for("$")] = { localPath: "/Music/symbol.mp3" };
        const result = groupLocalMusic([
            song("legacy", { $: { localPath: "/Music/legacy.mp3" } }), symbolSong,
            song("extra", { extraLocalPath: "/Music/extra.mp3" }),
            song("url", { url: "file:///Music/url.mp3" }),
            song("windows", { localPath: "D:\\Collection\\song.mp3" }),
            song("encoded", { localPath: "file:///My%20Music/song.mp3" }),
        ], "folders", "en-US");
        expect(result.find(group => group.name === "Music")?.musicList).toHaveLength(4);
        expect(result.find(group => group.name === "Collection")?.detail).toBe("D:/Collection");
        expect(result.find(group => group.name === "My Music")?.detail).toBe("/My Music");
    });

    it("resolves filesystem SAF IDs and keeps opaque content IDs uncategorized", () => {
        const result = groupLocalMusic([
            song("saf", { url: "content://provider/tree/primary%3AMusic/document/primary%3AMusic%2Fa.mp3" }),
            song("raw", { localPath: "/storage/emulated/0/Music/b.mp3" }),
            song("opaque", { url: "content://media/external/audio/media/22" }),
            song("document", { url: "content://downloads/document/22" }),
        ], "folders", "en-US");
        expect(result.find(group => group.name === "Music")?.musicList.map(item => item.id)).toEqual(["saf", "raw"]);
        expect(result.find(group => !group.name)?.musicList.map(item => item.id)).toEqual(["opaque", "document"]);
    });

    it("keeps albums with equal names distinct and honors an album artist", () => {
        const result = groupLocalMusic([
            song("a", { artist: "A" }), song("b", { artist: "B" }),
            song("c", { artist: "C", albumArtist: "Compilation" }), song("d", { artist: "D", albumArtist: "Compilation" }),
        ], "albums", "en-US");
        expect(result).toHaveLength(3);
        expect(result.find(group => group.detail === "Compilation")?.musicList.map(item => item.id)).toEqual(["c", "d"]);
    });

    it("includes missing metadata in counts and handles prototype-like artist names", () => {
        const result = groupLocalMusic([song("a", { artist: " " }), song("b", { artist: "" }), song("c", { artist: "__proto__" })], "artists", "en-US");
        expect(result.find(group => !group.name)?.musicList).toHaveLength(2);
        expect(result.find(group => group.name === "__proto__")?.musicList).toHaveLength(1);
        expect(groupLocalMusic([], "albums", "zh-CN")).toEqual([]);
    });
});
