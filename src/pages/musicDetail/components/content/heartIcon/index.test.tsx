import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import HeartIcon from ".";
import Icon from "@/components/base/icon";
import MusicSheet from "@/core/musicSheet";
import Toast from "@/utils/toast";
const song = { id: "1", platform: "B" } as IMusic.IMusicItem;
let mockMusic: IMusic.IMusicItem | null = song;
jest.mock("@/core/trackPlayer", () => ({ useCurrentMusic: () => mockMusic }));
jest.mock("@/core/musicSheet", () => ({ __esModule: true, default: { favorites: { groupFor: () => ({ id: "g" }), toggle: jest.fn() } }, useFavorite: () => true }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/hooks/useColors", () => () => ({ mediaFavorite: "favorite" }));
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { warn: jest.fn() } }));
describe("player group favorite action", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    beforeEach(() => {
        jest.clearAllMocks(); mockMusic = song;
    });
    afterEach(() => act(() => renderer?.unmount()));
    function render() {
        act(() => {
            renderer = TestRenderer.create(<HeartIcon />);
        });
    }
    it("routes the actual source through the shared favorite queue and guards repeated taps", async () => {
        let finish!: () => void;
        (MusicSheet.favorites.toggle as jest.Mock).mockImplementationOnce(() => new Promise<void>(yes => {
            finish = yes;
        }));
        render();
        const toggle = renderer.root.findByType(Icon).props.onPress;
        let pending!: Promise<void>;
        act(() => {
            pending = toggle(); toggle();
        });
        expect(MusicSheet.favorites.toggle).toHaveBeenCalledTimes(1);
        expect(MusicSheet.favorites.toggle).toHaveBeenCalledWith(song);
        expect(renderer.root.findByType(Icon).props.accessibilityState.disabled).toBe(true);
        await act(async () => {
            finish(); await pending;
        });
        expect(renderer.root.findByType(Icon).props.accessibilityState.disabled).toBe(false);
    });
    it("handles persistence failure and missing current music", async () => {
        (MusicSheet.favorites.toggle as jest.Mock).mockRejectedValueOnce(new Error("disk"));
        render(); await act(async () => renderer.root.findByType(Icon).props.onPress());
        expect(Toast.warn).toHaveBeenCalledWith("aggregate.updateFailed");
        mockMusic = null; act(() => renderer.update(<HeartIcon />));
        await act(async () => renderer.root.findByType(Icon).props.onPress());
        expect(MusicSheet.favorites.toggle).toHaveBeenCalledTimes(1);
    });
});
