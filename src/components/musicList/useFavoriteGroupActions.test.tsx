import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import useFavoriteGroupActions from "./useFavoriteGroupActions";
import MusicSheet from "@/core/musicSheet";
import { showDialog } from "@/components/dialogs/useDialog";
import { trackSourceKey } from "@/utils/trackGroup";
const a = { id: "1", platform: "A", title: "Song", artist: "Artist" } as IMusic.IMusicItem;
const b = { ...a, platform: "B" };
const c = { ...a, platform: "C" };
jest.mock("@/core/musicSheet", () => ({ __esModule: true, default: { defaultSheet: { id: "favorite" }, removeMusic: jest.fn(async () => {}), favorites: {
    linkPreview: jest.fn(), link: jest.fn(async () => {}), split: jest.fn(async () => {}), prefer: jest.fn(async () => {}),
} } }));
jest.mock("@/core/favoriteGroups", () => ({ useFavoriteGroups: () => ({ groups: [] }), FavoriteGroups: { get: () => ({ groups: [{ id: "g", memberKeys: ["one", "two", "three"] }] }) } }));
jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: jest.fn() }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string, values?: any) => `${key}:${values?.count ?? ""}` }) }));
jest.mock("@/core/pluginManager", () => ({ usePluginDisplayNameResolver: () => (name: string) => name }));
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { warn: jest.fn() } }));
describe("explicit source association actions", () => {
    let actions: ReturnType<typeof useFavoriteGroupActions>["actions"];
    let renderer: TestRenderer.ReactTestRenderer;
    beforeEach(() => {
        jest.clearAllMocks();
        (MusicSheet.favorites.linkPreview as jest.Mock).mockReturnValue([a, b, c]);
        function Harness() {
            actions = useFavoriteGroupActions().actions; return null;
        }
        act(() => {
            renderer = TestRenderer.create(<Harness />);
        });
    });
    afterEach(() => act(() => renderer.unmount()));
    it("previews all existing members and only persists after explicit confirmation", async () => {
        actions.link({ key: trackSourceKey(a), candidates: [a, b] }, b);
        expect(MusicSheet.favorites.link).not.toHaveBeenCalled();
        const dialog = (showDialog as jest.Mock).mock.calls[0][1];
        expect(dialog.content).toContain("aggregate.linkConfirm:3");
        expect(dialog.content).toContain("C · Song · Artist");
        await dialog.onOk(); await dialog.onOk();
        expect(MusicSheet.favorites.link).toHaveBeenCalledTimes(1);
        expect(MusicSheet.favorites.link).toHaveBeenCalledWith([a, b, c], b);
    });
    it("confirms splitting every saved member and keeps single-source removal separate", async () => {
        actions.split({ key: "saved", groupId: "g", candidates: [a, b] });
        const dialog = (showDialog as jest.Mock).mock.calls[0][1];
        expect(dialog.content).toBe("aggregate.splitConfirm:3");
        expect(MusicSheet.favorites.split).not.toHaveBeenCalled();
        await dialog.onOk(); expect(MusicSheet.favorites.split).toHaveBeenCalledWith("g");
        await actions.removeSource(a); expect(MusicSheet.removeMusic).toHaveBeenCalledWith("favorite", a);
    });
});
