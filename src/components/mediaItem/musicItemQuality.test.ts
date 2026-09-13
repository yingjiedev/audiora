import { getQualityBadge } from "./musicItemQuality";

function createMusicItem(
    overrides: Partial<IMusic.IMusicItem> = {},
): IMusic.IMusicItem {
    return {
        id: "song-id",
        platform: "source-plugin",
        title: "Song",
        artist: "Artist",
        duration: 1,
        album: "Album",
        artwork: "",
        ...overrides,
    };
}

describe("getQualityBadge", () => {
    it("prefers downloaded file metadata over retained online qualities", () => {
        const requestedItem = createMusicItem({
            qualities: {
                master: { size: 10 },
                flac: { size: 8 },
                "320k": { size: 4 },
            },
        });
        const localMusicItem = createMusicItem({
            ...requestedItem,
            $: {
                localPath: "/tmp/downloaded.mp3",
                audioMeta: { codec: "mp3", bitrate: 128000 },
            },
        });

        expect(getQualityBadge(requestedItem, localMusicItem)).toEqual({
            type: "quality",
            text: "LQ",
        });
    });

    it("does not fall back to online badges for local files with unknown metadata", () => {
        const requestedItem = createMusicItem({
            qualities: { flac: { size: 8 } },
        });
        const localMusicItem = createMusicItem({
            ...requestedItem,
            $: { localPath: "/tmp/unknown.m4a" },
        });

        expect(getQualityBadge(requestedItem, localMusicItem)).toBeNull();
    });
});
