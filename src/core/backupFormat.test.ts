import {
    BACKUP_SCHEMA,
    BACKUP_VERSION,
    createBackupFileName,
    createBackupPayload,
    parseBackupPayload,
} from "./backupFormat.ts";
import { emptyFavoriteGroups, linkFavoriteGroups } from "./favoriteGroupsModel";
import { trackSourceKey } from "@/utils/trackGroup";
import { createUserPreset, defaultSettings, presetBands } from "./audioEffects/model";

function fixtureMusic(id: string | number) {
    return {
        id,
        platform: "fixture",
        title: `Track ${id}`,
        artist: "Fixture artist",
        duration: 180,
        album: "Fixture album",
        artwork: "",
    } as unknown as IMusic.IMusicItem;
}

function fixtureSheet(musicList = [fixtureMusic("one")]) {
    return {
        id: "sheet-fixture",
        platform: "本地",
        title: "Fixture sheet",
        musicList,
    } as IMusic.IMusicSheetItem;
}

describe("backup format", () => {
    it("round-trips sound settings independently of favorite groups and excludes session metadata", () => {
        const effects = createUserPreset(createUserPreset({ ...defaultSettings(), enabled: true, bands: presetBands("vocal"), preampDb: -3 }, "voice", "Vocals"), "night", "Night");
        const raw = createBackupPayload([fixtureSheet()], [], 1234, undefined, effects);
        expect(JSON.parse(raw).version).toBe(BACKUP_VERSION);
        expect(parseBackupPayload(raw).audiora).toEqual({ audioEffects: effects });
        const imported = JSON.parse(raw);
        imported.data.audiora.audioEffects.active = true;
        imported.data.audiora.audioEffects.frequencies = [999];
        expect(parseBackupPayload(imported).audiora?.audioEffects).toEqual(effects);
    });

    it("rejects damaged sound settings and saved curves before restore", () => {
        const raw = JSON.parse(createBackupPayload([fixtureSheet()], [], 1, undefined, defaultSettings()));
        for (const patch of [
            { enabled: 1 }, { preset: "fake-surround" }, { preampDb: 1 }, { preampDb: null },
            { bands: [] }, { bands: [null] }, { bands: [{ frequencyHz: 60, gainDb: 7 }] },
            { bands: [{ frequencyHz: 60, gainDb: 0 }, { frequencyHz: 60, gainDb: 0 }] },
            { savedCustom: { bands: presetBands("flat"), preampDb: -13 } },
        ]) {
            expect(() => parseBackupPayload({ ...raw, data: { ...raw.data, audiora: { audioEffects: { ...defaultSettings(), ...patch } } } })).toThrow();
        }
        expect(parseBackupPayload(createBackupPayload([fixtureSheet()])).audiora).toBeUndefined();
    });
    it("round-trips a namespaced favorite extension without changing the shared version", () => {
        const a = fixtureMusic(12), b = { ...fixtureMusic("0012"), platform: "other" };
        const sheet = { ...fixtureSheet([a, b]), id: "favorite" };
        const groups = linkFavoriteGroups(emptyFavoriteGroups(), [a, b].map(trackSourceKey), trackSourceKey(b), "group");
        const raw = createBackupPayload([sheet], [], 1234, groups);
        expect(JSON.parse(raw).version).toBe(3);
        expect(parseBackupPayload(raw).audiora?.favoriteGroups).toEqual(groups);
        expect(parseBackupPayload(raw).musicSheets[0].musicList[0].id).toBe(12);
        // A client that drops the optional namespace still has every original source.
        const downgraded = JSON.parse(raw); delete downgraded.data.audiora;
        expect(parseBackupPayload(downgraded).musicSheets[0].musicList).toEqual([a, b]);
    });
    it("rejects a dangling relation before any restore writes can start", () => {
        const a = fixtureMusic("one"), b = fixtureMusic("two");
        const groups = linkFavoriteGroups(emptyFavoriteGroups(), [a, b].map(trackSourceKey), trackSourceKey(a), "group");
        const raw = JSON.parse(createBackupPayload([{ ...fixtureSheet([a, b]), id: "favorite" }], [], 1, groups));
        raw.data.musicSheets[0].musicList.pop();
        expect(() => parseBackupPayload(raw)).toThrow("Invalid favorite group member");
        raw.data.audiora.favoriteGroups.version = 9;
        expect(() => parseBackupPayload(raw)).toThrow("Invalid favorite groups");
    });
    it("writes the shared v3 envelope and preserves plugin ID scalar types", () => {
        const sheet = fixtureSheet([
            fixtureMusic(108175950),
            fixtureMusic("00108175950"),
        ]);
        const serialized = createBackupPayload(
            [sheet],
            [
                {
                    srcUrl: "https://example.com/plugin.js",
                    version: "1.2.3",
                },
            ],
            1234,
        );
        const envelope = JSON.parse(serialized);

        expect(envelope.schema).toBe(BACKUP_SCHEMA);
        expect(envelope.version).toBe(BACKUP_VERSION);
        expect(envelope.createdAt).toBe(1234);
        expect(
            envelope.data.musicSheets[0].musicList.map(item => item.id),
        ).toEqual([108175950, "00108175950"]);
        expect(parseBackupPayload(serialized)).toEqual({
            musicSheets: [sheet],
            plugins: [
                {
                    srcUrl: "https://example.com/plugin.js",
                    version: "1.2.3",
                },
            ],
        });
    });

    it("repairs canonical numeric IDs from BakaMusic v2 backups", () => {
        const serialized = JSON.stringify({
            schema: BACKUP_SCHEMA,
            version: 2,
            createdAt: 1234,
            data: {
                musicSheets: [
                    fixtureSheet([
                        fixtureMusic("108175950"),
                        fixtureMusic("00108175950"),
                        fixtureMusic("track-id"),
                    ]),
                ],
            },
        });

        expect(
            parseBackupPayload(serialized).musicSheets[0].musicList.map(
                item => item.id,
            ),
        ).toEqual([108175950, "00108175950", "track-id"]);
    });

    it("migrates original MusicFree v1 backups with local sheets", () => {
        const musicList = [fixtureMusic(123456)];
        const musicFreeV1Sheet = {
            id: "favorite",
            title: "我喜欢",
            coverImg: null,
            musicList,
        };
        expect(
            parseBackupPayload(
                JSON.stringify({
                    musicSheets: [musicFreeV1Sheet],
                    plugins: [
                        {
                            srcUrl: "https://example.com/legacy.js",
                            version: "1.0.0",
                        },
                    ],
                }),
            ),
        ).toEqual({
            musicSheets: [
                {
                    ...musicFreeV1Sheet,
                    platform: "本地",
                },
            ],
            plugins: [
                {
                    srcUrl: "https://example.com/legacy.js",
                    version: "1.0.0",
                },
            ],
        });
        expect(
            parseBackupPayload(
                JSON.stringify({
                    version: 1,
                    musicSheets: [musicFreeV1Sheet],
                    plugins: [],
                }),
            ).musicSheets[0].musicList[0].id,
        ).toBe(123456);
    });

    it("accepts BakaMusic v3 backups without plugin metadata", () => {
        const legacySheet = fixtureSheet([fixtureMusic(123456)]);
        const bakaPayload = JSON.stringify({
            schema: BACKUP_SCHEMA,
            version: BACKUP_VERSION,
            createdAt: 1234,
            data: { musicSheets: [legacySheet] },
        });
        expect(parseBackupPayload(bakaPayload)).toEqual({
            musicSheets: [legacySheet],
            plugins: [],
        });
    });

    it("drops unusable tracks and plugin entries without blocking playlists", () => {
        const serialized = createBackupPayload(
            [
                fixtureSheet([
                    fixtureMusic("valid"),
                    { id: "missing-platform" } as IMusic.IMusicItem,
                ]),
            ],
            [
                {
                    srcUrl: "file:///invalid/plugin.js",
                    version: "1.0.0",
                },
            ],
            1234,
        );
        const parsed = parseBackupPayload(serialized);

        expect(parsed.musicSheets[0].musicList.map(item => item.id)).toEqual([
            "valid",
        ]);
        expect(parsed.plugins).toEqual([]);
    });

    it("uses timestamped Audiora filenames and rejects unsupported versions", () => {
        expect(createBackupFileName(Date.UTC(2026, 7, 9, 14, 21, 6))).toBe(
            "AudioraBackup-2026-08-09T14-21-06Z.json",
        );
        expect(() =>
            parseBackupPayload(
                JSON.stringify({
                    schema: BACKUP_SCHEMA,
                    version: BACKUP_VERSION + 1,
                    data: { musicSheets: [] },
                }),
            ),
        ).toThrow("Unsupported backup schema or version");
    });
});
