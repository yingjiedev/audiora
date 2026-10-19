/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import MusicSheet from "./index";
import { FavoriteGroups } from "@/core/favoriteGroups";
import { ResumeMode } from "@/constants/commonConst";

const mockStores = new Map<string, Map<string, string>>();
jest.mock("@/utils/getOrCreateMMKV", () => (name: string) => {
    if (!mockStores.has(name)) mockStores.set(name, new Map());
    const data = mockStores.get(name)!;
    return { getString: (key: string) => data.get(key), set: (key: string, value: string) => data.set(key, value), remove: (key: string) => data.delete(key) };
});
jest.mock("@/utils/nanoid", () => ({ nanoid: () => "generated" }));
jest.mock("@/utils/backgroundImage", () => ({ removeBackgroundImage: async () => {} }));
jest.mock("./migrate", () => ({ __esModule: true, default: async () => {}, migrateV2: { migrate() {}, done() {} } }));
jest.mock("./storage", () => ({ __esModule: true, default: {
    getSheets: () => undefined, getMusicList: () => [], getStarredSheets: () => [], getSheetMeta: () => undefined,
    setSheets: jest.fn(async () => {}), setMusicList: jest.fn(async () => {}), setSheetMeta: jest.fn(),
} }));
jest.mock("@/utils/mediaUtils", () => ({ isSameMediaItem: (a, b) => !!a && !!b && a.platform === b.platform && String(a.id) === String(b.id) }));
jest.mock("@/constants/commonConst", () => ({ localPluginPlatform: "本地", ResumeMode: { Append: "append" }, SortType: { None: "None", Title: "title", Artist: "artist", Album: "album", Newest: "newest", Oldest: "oldest" } }));

const a = { id: "1", platform: "A", title: "Song", artist: "Artist", duration: 200, artwork: "a", album: "" };
const b = { ...a, platform: "B", artwork: "b" };
const c = { ...a, platform: "C" };
describe("favorite service wired into music sheets", () => {
    beforeEach(async () => {
        mockStores.clear();
        MusicSheet.injectDependencies({ getConfig: () => undefined } as any);
        await MusicSheet.setup();
    });
    it("cleans relationships and corrects raw counts after legacy indexed deletion and group heart removal", async () => {
        await MusicSheet.favorites.link([a, b, c], a);
        expect(MusicSheet.backupSheets()[0].worksNum).toBe(3);
        await MusicSheet.removeMusicByIndex("favorite", 0);
        expect(MusicSheet.favorites.linkedSources(b).map(item => item.platform)).toEqual(["B", "C"]);
        expect(MusicSheet.backupSheets()[0].worksNum).toBe(2);
        await MusicSheet.favorites.toggle(b);
        expect(MusicSheet.backupSheets()[0]).toMatchObject({ worksNum: 0, musicList: [] });
        expect(FavoriteGroups.get().groups).toEqual([]);
    });
    it("imports old favorites without inventing a confirmed source association", async () => {
        await MusicSheet.resumeSheets([{ id: "favorite", platform: "本地", musicList: [a, b] }], ResumeMode.Append);
        expect(MusicSheet.favorites.isFavorite(a)).toBe(true);
        expect(MusicSheet.favorites.isFavorite(b)).toBe(true);
        expect(MusicSheet.favorites.groupFor(a)).toBeUndefined();
        expect(MusicSheet.favorites.displayGroups()).toHaveLength(1);
        expect(MusicSheet.favorites.displayGroups()[0].groupId).toBeUndefined();
    });
    it("publishes changes after persistence for UI and notification subscribers", async () => {
        const updates: boolean[] = [];
        const unsubscribe = MusicSheet.subscribeFavorites(() => updates.push(MusicSheet.favorites.isFavorite(a)));
        await MusicSheet.favorites.link([a, b], a);
        await MusicSheet.removeMusic("favorite", a);
        unsubscribe();
        expect(updates).toEqual([true, false]);
        expect(MusicSheet.favorites.isFavorite(b)).toBe(true);
    });
});
