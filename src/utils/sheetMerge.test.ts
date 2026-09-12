import { describe, expect, it } from "@jest/globals";
import {
    isSameTrack,
    mergeMusicSheetsByPriority,
    normalizeTrackArtist,
    normalizeTrackTitle,
    SAME_TRACK_DURATION_TOLERANCE_MS,
} from "./sheetMerge";

function item(
    id: string,
    platform: string,
    title: string,
    artist: string,
    duration: number | undefined,
): IMusic.IMusicItem {
    return {
        id,
        platform,
        title,
        artist,
        duration: duration ?? 0,
        album: "",
        artwork: "",
    } as IMusic.IMusicItem;
}

describe("track normalization", () => {
    it("normalizes title width, case and whitespace", () => {
        expect(normalizeTrackTitle("  Hello   World ")).toBe("hello world");
        expect(normalizeTrackTitle("Ｌｏｖｅ　ｙｏｕ")).toBe("love you");
    });

    it("normalizes artist order across common separators", () => {
        expect(normalizeTrackArtist("周杰伦/费玉清")).toBe(
            normalizeTrackArtist("费玉清、周杰伦"),
        );
        expect(normalizeTrackArtist("A feat. B")).toBe(
            normalizeTrackArtist("B & A"),
        );
    });
});

describe("isSameTrack", () => {
    it("matches equal normalized metadata within the duration tolerance", () => {
        expect(
            isSameTrack(
                item("1", "A", "Ｈｅｌｌｏ", "Artist A / Artist B", 269),
                item("2", "B", "hello", "artist b & artist a", 274),
            ),
        ).toBe(true);
    });

    it("includes exactly five seconds and rejects anything beyond it", () => {
        const toleranceSeconds = SAME_TRACK_DURATION_TOLERANCE_MS / 1000;
        const base = item("1", "A", "晴天", "周杰伦", 269);
        expect(
            isSameTrack(
                base,
                item("2", "B", "晴天", "周杰伦", 269 + toleranceSeconds),
            ),
        ).toBe(true);
        expect(
            isSameTrack(
                base,
                item(
                    "3",
                    "B",
                    "晴天",
                    "周杰伦",
                    269 + toleranceSeconds + 0.001,
                ),
            ),
        ).toBe(false);
    });

    it("does not merge different artists or versions", () => {
        expect(
            isSameTrack(
                item("1", "A", "晴天", "周杰伦", 269),
                item("2", "B", "晴天", "沈以诚", 269),
            ),
        ).toBe(false);
        expect(
            isSameTrack(
                item("1", "A", "晴天", "周杰伦", 269),
                item("2", "B", "晴天 (Live)", "周杰伦", 269),
            ),
        ).toBe(false);
    });

    it("keeps tracks when either duration is missing", () => {
        expect(
            isSameTrack(
                item("1", "A", "晴天", "周杰伦", 0),
                item("2", "B", "晴天", "周杰伦", 269),
            ),
        ).toBe(false);
    });
});

describe("mergeMusicSheetsByPriority", () => {
    it("keeps the higher-priority source and supplements from lower sources", () => {
        const result = mergeMusicSheetsByPriority([
            {
                pluginHash: "h-qq",
                pluginName: "自定义QQ",
                musicList: [
                    item("1", "qq", "晴天", "周杰伦", 269),
                    item("2", "qq", "七里香", "周杰伦", 296),
                ],
            },
            {
                pluginHash: "h-ne",
                pluginName: "网易云",
                musicList: [
                    item("n1", "netease", "晴天", "周杰伦", 270),
                    item("n2", "netease", "告白气球", "周杰伦", 215),
                ],
            },
        ]);

        expect(result.mergedList.map(track => track.id)).toEqual([
            "1",
            "2",
            "n2",
        ]);
        expect(result.stats).toEqual([
            {
                pluginHash: "h-qq",
                pluginName: "自定义QQ",
                total: 2,
                kept: 2,
                duplicates: 0,
                uncertain: 0,
            },
            {
                pluginHash: "h-ne",
                pluginName: "网易云",
                total: 2,
                kept: 1,
                duplicates: 1,
                uncertain: 0,
            },
        ]);
    });

    it("changes the retained version when source priority changes", () => {
        const result = mergeMusicSheetsByPriority([
            {
                pluginHash: "b",
                pluginName: "B",
                musicList: [item("b1", "B", "歌", "歌手", 200)],
            },
            {
                pluginHash: "a",
                pluginName: "A",
                musicList: [item("a1", "A", "歌", "歌手", 200)],
            },
        ]);

        expect(result.mergedList.map(track => track.id)).toEqual(["b1"]);
        expect(result.stats[1].duplicates).toBe(1);
    });

    it("deduplicates a source by platform and id before merging", () => {
        const result = mergeMusicSheetsByPriority([
            {
                pluginHash: "a",
                pluginName: "A",
                musicList: [
                    item("1", "A", "歌", "歌手", 200),
                    item("1", "A", "另一标题", "另一歌手", 100),
                    item("1", "B", "另一首歌", "歌手", 200),
                ],
            },
        ]);

        expect(result.mergedList).toHaveLength(2);
        expect(result.stats[0].total).toBe(2);
    });

    it("conservatively keeps and counts missing-duration matches", () => {
        const result = mergeMusicSheetsByPriority([
            {
                pluginHash: "a",
                pluginName: "A",
                musicList: [item("a1", "A", "歌", "歌手", 0)],
            },
            {
                pluginHash: "b",
                pluginName: "B",
                musicList: [
                    item("b1", "B", "歌", "歌手", 200),
                    item("b2", "B", "另一首", "歌手", 0),
                ],
            },
        ]);

        expect(result.mergedList.map(track => track.id)).toEqual([
            "a1",
            "b1",
            "b2",
        ]);
        expect(result.stats[0].uncertain).toBe(1);
        expect(result.stats[1].uncertain).toBe(2);
    });

    it("uses the indexed duration ranges for a large same-metadata list", () => {
        const firstSource = Array.from({ length: 2000 }, (_, index) =>
            item(`${index}`, "A", "同名歌曲", "歌手", index * 20 + 10),
        );
        const duplicateSource = firstSource.map((track, index) =>
            item(`duplicate-${index}`, "B", track.title, track.artist, track.duration),
        );

        const result = mergeMusicSheetsByPriority([
            {
                pluginHash: "a",
                pluginName: "A",
                musicList: firstSource,
            },
            {
                pluginHash: "b",
                pluginName: "B",
                musicList: duplicateSource,
            },
        ]);

        expect(result.mergedList).toHaveLength(2000);
        expect(result.stats[1].duplicates).toBe(2000);
    });
});
