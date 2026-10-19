/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import { FavoriteCollection } from "./favoriteCollection";
import { FavoriteGroups } from "./favoriteGroups";
import { favoriteDisplayGroups, linkFavoriteGroups, parseFavoriteGroups, emptyFavoriteGroups, mergeRestoredFavoriteGroups } from "./favoriteGroupsModel";
import { trackSourceKey } from "@/utils/trackGroup";

const mockData = new Map<string, string>();
jest.mock("@/utils/getOrCreateMMKV", () => () => ({
    getString: (key: string) => mockData.get(key),
    set: (key: string, value: string) => mockData.set(key, value),
    remove: (key: string) => mockData.delete(key),
}));
jest.mock("@/utils/nanoid", () => ({ nanoid: () => "new-group" }));
const a = { id: 1, platform: "A", title: "Song", artist: "Artist", duration: 200, album: "", artwork: "", aid: 7 } as unknown as IMusic.IMusicItem;
const b = { ...a, id: "001", platform: "B" };
const c = { ...a, id: "3", platform: "C" };

describe("durable multi-source favorites", () => {
    let items: IMusic.IMusicItem[];
    let favorites: FavoriteCollection;
    let add: jest.Mock;
    beforeEach(() => {
        mockData.clear(); items = []; FavoriteGroups.setup(items);
        add = jest.fn(async incoming => {
            const map = new Map([...items, ...incoming].map(item => [trackSourceKey(item), item]));
            items = [...map.values()];
        });
        favorites = new FavoriteCollection({
            get: () => items, add,
            remove: async incoming => {
                const keys = new Set(incoming.map(trackSourceKey)); items = items.filter(item => !keys.has(trackSourceKey(item)));
            },
        });
    });
    it("links full original objects, persists preference and recovers after restart", async () => {
        await favorites.link([a, b], b);
        expect(items).toEqual([a, b]);
        expect(items[0].id).toBe(1); expect(items[0].aid).toBe(7);
        expect(favorites.linkedSources(a)).toEqual([b, a]);
        FavoriteGroups.setup(items);
        expect(favorites.displayGroups()[0].groupId).toBe("new-group");
        await favorites.prefer(a); FavoriteGroups.setup(items);
        expect(favorites.linkedSources(b)).toEqual([a, b]);
    });
    it("removes the whole group from any heart and does not recreate it from stale relationships", async () => {
        await favorites.link([a, b], a);
        const old = FavoriteGroups.get();
        expect(await favorites.toggle(b)).toBe(false);
        expect(items).toEqual([]); expect(FavoriteGroups.get().groups).toEqual([]);
        await favorites.restore(old);
        expect(items).toEqual([]); expect(FavoriteGroups.get().groups).toEqual([]);
    });
    it("removes one source independently and leaves the others saved", async () => {
        await favorites.link([a, b, c], a);
        await favorites.mutate(async () => {
            items = [b, c];
        });
        expect(favorites.isFavorite(a)).toBe(false);
        expect(favorites.isFavorite(b)).toBe(true);
        expect(favorites.linkedSources(b)).toEqual([b, c]);
    });
    it("splits without deleting songs and remembers the decision across restarts", async () => {
        await favorites.link([a, b], a);
        await favorites.split("new-group"); FavoriteGroups.setup(items);
        expect(items).toEqual([a, b]);
        expect(favorites.displayGroups()).toHaveLength(2);
        expect(favorites.displayGroups().every(group => !group.groupId)).toBe(true);
        await favorites.link([a, b], b);
        expect(FavoriteGroups.get().separatedKeys).toEqual([]);
        expect(favorites.displayGroups()).toHaveLength(1);
    });
    it("includes existing members in the preview before merging overlapping groups", async () => {
        await favorites.link([a, b], a);
        expect(favorites.linkPreview([b, c])).toEqual([b, c, a]);
        await favorites.link([b, c], c);
        expect(FavoriteGroups.get().groups).toHaveLength(1);
        expect(favorites.linkedSources(a)).toEqual([c, b, a]);
    });
    it("serializes competing actions and keeps the queue usable after a failed write", async () => {
        add.mockRejectedValueOnce(new Error("disk"));
        await expect(favorites.toggle(a)).rejects.toThrow("disk");
        const one = favorites.link([a, b], a);
        const two = favorites.toggle(b);
        await Promise.all([one, two]);
        expect(items).toEqual([]);
        expect(mockData.has("pending")).toBe(false);
        await favorites.toggle(c); expect(favorites.isFavorite(c)).toBe(true);
    });
    it("recovers a relationship journal only for songs that actually survived", () => {
        const state = linkFavoriteGroups(emptyFavoriteGroups(), [a, b].map(trackSourceKey), trackSourceKey(a), "g");
        FavoriteGroups.prepare(state); FavoriteGroups.setup([a, b]);
        expect(FavoriteGroups.get().groups).toHaveLength(1);
        FavoriteGroups.prepare(state); FavoriteGroups.setup([a]);
        expect(FavoriteGroups.get().groups).toEqual([]);
        expect(mockData.has("pending")).toBe(false);
    });
    it("preserves local split decisions on restore", async () => {
        await favorites.link([a, b], a); await favorites.split("new-group");
        const incoming = linkFavoriteGroups(emptyFavoriteGroups(), [a, b].map(trackSourceKey), trackSourceKey(b), "old");
        await favorites.restore(incoming);
        expect(favorites.displayGroups()).toHaveLength(2);
        const other = { ...c, id: "4", platform: "D" };
        items = [a, b, c, other];
        await favorites.link([c, other], c);
        expect(favorites.displayGroups()).toHaveLength(3);
        expect(items).toHaveLength(4);
    });
    it("remaps colliding UUIDs without merging unrelated recordings or changing preference", () => {
        const d = { ...c, platform: "D" };
        const local = linkFavoriteGroups(emptyFavoriteGroups(), [a, b].map(trackSourceKey), trackSourceKey(a), "same-id");
        const incoming = linkFavoriteGroups(emptyFavoriteGroups(), [c, d].map(trackSourceKey), trackSourceKey(d), "same-id");
        const merged = mergeRestoredFavoriteGroups(local, incoming, () => "restored-id");
        expect(merged.groups.map(group => group.id)).toEqual(["same-id", "restored-id"]);
        expect(merged.groups[1].memberKeys).toEqual([c, d].map(trackSourceKey));
        expect(merged.groups[1].preferredKey).toBe(trackSourceKey(d));
    });
    it("discards corrupt relationship metadata without touching original songs", () => {
        const originals = [a, b]; mockData.set("state", "{broken");
        FavoriteGroups.setup(originals);
        expect(FavoriteGroups.get().groups).toEqual([]);
        expect(originals).toEqual([a, b]);
    });
    it.each([
        { version: 2, groups: [], separatedKeys: [] },
        { version: 1, groups: [{ id: "g", memberKeys: [trackSourceKey(a), trackSourceKey(a)], preferredKey: trackSourceKey(a) }], separatedKeys: [] },
        { version: 1, groups: [{ id: "g", memberKeys: [trackSourceKey(a), trackSourceKey(b)], preferredKey: "missing" }], separatedKeys: [] },
    ])("rejects malformed or ambiguous relationships: %j", state => {
        expect(() => parseFavoriteGroups(state)).toThrow();
    });
    it("displays suggestions without changing or saving them", () => {
        const state = emptyFavoriteGroups();
        expect(favoriteDisplayGroups([a, b], state)).toHaveLength(1);
        expect(state.groups).toEqual([]);
        expect(FavoriteGroups.get().groups).toEqual([]);
    });
});
