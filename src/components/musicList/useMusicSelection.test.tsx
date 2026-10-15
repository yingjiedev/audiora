import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import useMusicSelection from "./useMusicSelection";

jest.mock("@/utils/mediaUtils", () => ({ getMediaUniqueKey: (item: IMusic.IMusicItem) => `${item.platform}@${item.id}` }));

const one = { id: "1", platform: "a", title: "One", artist: "Artist" } as IMusic.IMusicItem;
const otherSource = { ...one, platform: "b" };
const two = { ...one, id: "2" };

describe("inline music selection", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    let result: ReturnType<typeof useMusicSelection>;
    function Probe({ scope, songs }: { scope: string; songs: IMusic.IMusicItem[] }) {
        result = useMusicSelection(scope, songs);
        return null;
    }
    function render(songs = [one, otherSource], scope = "favorite") {
        act(() => {
            renderer = TestRenderer.create(<Probe scope={scope} songs={songs} />);
        });
    }
    afterEach(() => act(() => renderer.unmount()));

    it("selects by platform and id, retains current list order and clears when editing finishes", () => {
        render();
        expect(result!.selection).toBeUndefined();
        act(() => result.start());
        act(() => result.selection!.onToggle(otherSource));
        expect(result!.selectedItems).toEqual([otherSource]);
        act(() => result.selection!.onToggle(one));
        expect(result!.selectedItems).toEqual([one, otherSource]);
        expect(result!.allSelected).toBe(true);
        act(() => result.finish());
        expect(result!.editing).toBe(false);
        expect(result!.selectedItems).toEqual([]);
        act(() => result.start());
        expect(result!.selectedItems).toEqual([]);
    });

    it("toggles all and handles an empty playlist", () => {
        render();
        act(() => result.start());
        act(() => result.toggleAll());
        expect(result!.selectedItems).toEqual([one, otherSource]);
        act(() => result.toggleAll());
        expect(result!.selectedItems).toEqual([]);
        act(() => renderer.update(<Probe scope="favorite" songs={[]} />));
        act(() => result.toggleAll());
        expect(result!.allSelected).toBe(false);
        expect(result!.selectedItems).toEqual([]);
    });

    it("keeps identity across refresh and reorder, prunes removed songs and leaves new songs unselected", () => {
        render();
        act(() => result.start());
        act(() => result.toggleAll());
        const refreshedOne = { ...one, title: "Updated" };
        act(() => renderer.update(<Probe scope="favorite" songs={[otherSource, refreshedOne, two]} />));
        expect(result!.selectedItems).toEqual([otherSource, refreshedOne]);
        expect(result!.allSelected).toBe(false);
        act(() => renderer.update(<Probe scope="favorite" songs={[refreshedOne, two]} />));
        expect([...result!.selection!.selectedKeys]).toEqual(["a@1"]);
        act(() => renderer.update(<Probe scope="favorite" songs={[otherSource, refreshedOne, two]} />));
        expect(result!.selectedItems).toEqual([refreshedOne]);
    });

    it("resets the selection when the same screen switches to another playlist", () => {
        render();
        act(() => result.start());
        act(() => result.toggleAll());
        act(() => renderer.update(<Probe scope="another-sheet" songs={[one]} />));
        expect(result!.editing).toBe(false);
        expect(result!.selection).toBeUndefined();
        expect(result!.selectedItems).toEqual([]);
    });
});
