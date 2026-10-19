import { FavoriteGroupDecorator, emptyFavoriteGroups, linkFavoriteGroups } from "./favoriteGroupsModel";
import { groupTracks, trackSourceKey } from "@/utils/trackGroup";

const a = { platform: "A", id: "1", title: "Song", artist: "Artist", duration: 200 } as IMusic.IMusicItem;
const b = { ...a, platform: "B" };

describe("indexed favorite decoration", () => {
    it("finds a shared saved group and keeps unchanged rows stable as other results arrive", () => {
        const state = linkFavoriteGroups(emptyFavoriteGroups(), [a, b].map(trackSourceKey), trackSourceKey(b), "g");
        const decorator = new FavoriteGroupDecorator();
        const groups = groupTracks([a, b]);
        const first = decorator.sync(groups, state);
        expect(first[0]).toMatchObject({ groupId: "g", preferredKey: trackSourceKey(b) });
        expect(decorator.sync(groups, state)).toBe(first);
        const other = groupTracks([{ ...a, id: "2", title: "Other" }])[0];
        const next = decorator.sync([...groups, other], state);
        expect(next[0]).toBe(first[0]);
        expect(next[1]).toBe(other);
    });
    it("invalidates cached preferences and associations after favorite edits", () => {
        const state = linkFavoriteGroups(emptyFavoriteGroups(), [a, b].map(trackSourceKey), trackSourceKey(b), "g");
        const decorator = new FavoriteGroupDecorator();
        const groups = groupTracks([a, b]);
        decorator.sync(groups, state);
        const next = decorator.sync(groups, { ...state, groups: [{ ...state.groups[0], preferredKey: trackSourceKey(a) }] });
        expect(next[0].preferredKey).toBe(trackSourceKey(a));
        expect(decorator.sync(groups, emptyFavoriteGroups())[0].groupId).toBeUndefined();
    });
    it("does not label a suggestion spanning different confirmed groups as a saved association", () => {
        const state = linkFavoriteGroups(emptyFavoriteGroups(), [a, b].map(trackSourceKey), trackSourceKey(a), "g");
        const groups = groupTracks([a, { ...b, platform: "C" }]);
        expect(new FavoriteGroupDecorator().sync(groups, state)[0].groupId).toBeUndefined();
    });
});
