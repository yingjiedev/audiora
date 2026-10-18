/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import { getDefaultStore } from "jotai";
import { RequestStateCode } from "@/constants/commonConst";
import { getMusicListSource, MusicListSource, registerMusicListSource, releaseMusicListSource } from "./musicListSource";
import { mergeEditorMusicList } from "@/pages/musicListEditor/store/atom";

jest.mock("@/utils/mediaExtra", () => ({}));
jest.mock("@/utils/motion", () => ({ motionDuration: jest.fn(), motionEasing: {} }));
const first = { id: "one", platform: "A", title: "First", artist: "Artist" } as IMusic.IMusicItem;
const second = { ...first, id: "two" };
const store = getDefaultStore();

describe("shared paginated music source", () => {
    it("shares appended data, deduplicates pages, and serializes simultaneous loads", async () => {
        let finish!: () => void;
        const loader = jest.fn(() => new Promise<void>(resolve => {
            finish = resolve;
        }));
        const source = new MusicListSource({ musicList: [first], state: RequestStateCode.PARTLY_DONE }, loader);
        const id = registerMusicListSource(source);
        const pending = source.loadMore();
        await source.loadMore();
        expect(loader).toHaveBeenCalledTimes(1);
        expect(store.get(source.snapshotAtom).state).toBe(RequestStateCode.PENDING_REST_PAGE);
        source.update({ musicList: [first, first, second], state: RequestStateCode.FINISHED });
        finish();
        await pending;
        expect(store.get(getMusicListSource(id)!.snapshotAtom).musicList).toEqual([first, second]);
        await source.loadMore();
        expect(loader).toHaveBeenCalledTimes(1);
        releaseMusicListSource(id);
        expect(getMusicListSource(id)).toBeUndefined();
    });

    it("keeps loaded items after failure and retries only when explicitly requested", async () => {
        const loader = jest.fn().mockRejectedValueOnce(new Error("offline")).mockImplementationOnce(async () => {
            source.update({ musicList: [first, second], state: RequestStateCode.FINISHED });
        });
        const source = new MusicListSource({ musicList: [first], state: RequestStateCode.PARTLY_DONE }, loader);
        await source.loadMore();
        expect(store.get(source.snapshotAtom)).toEqual({ musicList: [first], state: RequestStateCode.ERROR });
        await source.loadMore();
        expect(loader).toHaveBeenCalledTimes(1);
        await source.loadMore(true);
        expect(store.get(source.snapshotAtom).musicList).toEqual([first, second]);
    });

    it("ignores late updates after its owner closes", async () => {
        const loader = jest.fn();
        const source = new MusicListSource({ musicList: [first], state: RequestStateCode.PARTLY_DONE }, loader);
        source.dispose();
        source.update({ musicList: [second], state: RequestStateCode.FINISHED });
        await source.loadMore();
        expect(loader).not.toHaveBeenCalled();
        expect(store.get(source.snapshotAtom).musicList).toEqual([first]);
    });

    it("preserves existing checks and order, leaves appended songs unchecked, and distinguishes sources", () => {
        const selected = { musicItem: second, checked: true };
        const otherSource = { ...first, platform: "B" };
        const merged = mergeEditorMusicList([selected], [first, second, first, otherSource]);
        expect(merged).toEqual([
            selected,
            { musicItem: first, checked: false },
            { musicItem: otherSource, checked: false },
        ]);
        expect(merged[0]).toBe(selected);
    });
});
