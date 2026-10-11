import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { View } from "react-native";
import MusicItem from "./musicItem";
import TrackPlayer from "@/core/trackPlayer";
import MusicSheet from "@/core/musicSheet";
import { showPanel } from "@/components/panels/usePanel";
import Toast from "@/utils/toast";
import Badge from "@/components/base/badge";
import ThemeText from "@/components/base/themeText";

const song = { id: "one", platform: "plugin", title: "Song", artist: "Artist", album: "Album", duration: 180 } as IMusic.IMusicItem;
let mockFavorite = false;
let mockCurrent: IMusic.IMusicItem | null = null;
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { play: jest.fn(), addNext: jest.fn() }, useCurrentMusic: () => mockCurrent }));
jest.mock("@/core/musicSheet", () => ({ __esModule: true, default: { defaultSheet: { id: "favorite" }, addMusic: jest.fn(async () => {}), removeMusic: jest.fn(async () => {}) }, useFavorite: () => mockFavorite }));
jest.mock("@/core/localMusicSheet", () => ({ __esModule: true, default: { useIsLocal: () => false } }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/fastImage", () => "FastImage");
jest.mock("@/components/base/badge", () => "Badge");
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { success: jest.fn(), warn: jest.fn() } }));
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: 1 } }));
jest.mock("@/hooks/useColors", () => () => ({ text: "black", textSecondary: "gray", primary: "blue", danger: "red", listActive: "lightgray" }));
jest.mock("@/utils/artwork", () => ({ resolveArtwork: () => undefined }));
jest.mock("@/core/pluginManager", () => ({ __esModule: true, default: { getByMedia: () => ({ supportedMethods: new Set(["getMvSource"]) }) } }));
jest.mock("@/utils/mediaUtils", () => ({ isSameMediaItem: (a: IMusic.IMusicItem, b: IMusic.IMusicItem) => !!b && a.id === b.id && a.platform === b.platform }));

describe("shared song row interactions", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    beforeEach(() => {
        jest.clearAllMocks(); mockFavorite = false; mockCurrent = null;
    });
    afterEach(() => act(() => renderer?.unmount()));
    function render(props: Partial<React.ComponentProps<typeof MusicItem>> = {}) {
        act(() => {
            renderer = TestRenderer.create(<MusicItem musicItem={song} {...props} />);
        });
    }
    function button(label: string) {
        return renderer.root.findAllByProps({ accessibilityLabel: label }).find(node => typeof node.props.onPress === "function")!;
    }

    it("keeps row playback separate from next-play and contextual menu actions", () => {
        const sheet = { id: "sheet", title: "Sheet", platform: "plugin" } as IMusic.IMusicSheetItem;
        render({ musicSheet: sheet });
        const play = button("Song - Artist");
        const next = button("musicListEditor.addToNextPlay");
        const more = button("musicDetail.a11y.more");
        expect(play.parent).not.toBe(next.parent);
        expect(play.findAll(node => node.props.accessibilityLabel === "musicListEditor.addToNextPlay")).toHaveLength(0);
        act(() => {
            next.props.onPress(); more.props.onPress();
        });
        expect(TrackPlayer.play).not.toHaveBeenCalled();
        expect(TrackPlayer.addNext).toHaveBeenCalledWith(song);
        expect(showPanel).toHaveBeenCalledWith("MusicItemOptions", { musicItem: song, musicSheet: sheet });
        act(() => play.props.onPress());
        expect(TrackPlayer.play).toHaveBeenCalledWith(song);
    });
    it("preserves caller playback and long-press handlers", () => {
        const onItemPress = jest.fn(); const onItemLongPress = jest.fn();
        render({ onItemPress, onItemLongPress });
        act(() => {
            button("Song - Artist").props.onPress(); button("Song - Artist").props.onLongPress();
        });
        expect(onItemPress).toHaveBeenCalledWith(song);
        expect(onItemLongPress).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.play).not.toHaveBeenCalled();
    });
    it("allows editing mode to select the row without playback actions", () => {
        const select = jest.fn();
        render({ left: <View testID="selection" />, actions: [], onItemPress: select });
        expect(renderer.root.findAll(node => node.props.accessibilityLabel === "musicDetail.a11y.more")).toHaveLength(0);
        expect(renderer.root.findByProps({ testID: "selection" })).toBeDefined();
        act(() => button("Song - Artist").props.onPress());
        expect(select).toHaveBeenCalledWith(song);
    });
    it("adds and removes the actual song in favorites without playing it", async () => {
        render({ actions: ["favorite"] });
        await act(async () => button("musicDetail.a11y.favorite").props.onPress());
        expect(MusicSheet.addMusic).toHaveBeenCalledWith("favorite", song);
        mockFavorite = true;
        act(() => renderer.update(<MusicItem musicItem={song} actions={["favorite"]} />));
        await act(async () => button("musicDetail.a11y.unfavorite").props.onPress());
        expect(MusicSheet.removeMusic).toHaveBeenCalledWith("favorite", song);
        expect(TrackPlayer.play).not.toHaveBeenCalled();
    });
    it("ignores repeated favorite taps while saving", async () => {
        let complete!: () => void;
        (MusicSheet.addMusic as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => {
            complete = resolve;
        }));
        render({ actions: ["favorite"] });
        const toggle = button("musicDetail.a11y.favorite").props.onPress;
        let pending!: Promise<void>;
        act(() => {
            pending = toggle(); toggle();
        });
        expect(MusicSheet.addMusic).toHaveBeenCalledTimes(1);
        expect(button("musicDetail.a11y.favorite").props.disabled).toBe(true);
        await act(async () => {
            complete(); await pending;
        });
        expect(button("musicDetail.a11y.favorite").props.disabled).toBe(false);
    });
    it("recovers from favorite persistence failure", async () => {
        (MusicSheet.addMusic as jest.Mock).mockRejectedValueOnce(new Error("disk"));
        render({ actions: ["favorite"] });
        await act(async () => button("musicDetail.a11y.favorite").props.onPress());
        expect(Toast.warn).toHaveBeenCalledWith("panel.addToMusicSheet.toast.fail");
        expect(button("musicDetail.a11y.favorite").props.disabled).toBe(false);
    });
    it("tracks the current song by platform and id and only shows real badges", () => {
        mockCurrent = { ...song };
        render({ musicItem: { ...song, fee: 1, mv: 42 } });
        expect(button("Song - Artist").props.accessibilityState.selected).toBe(true);
        expect(renderer.root.findAllByType(Badge).map(node => node.props.children)).toEqual(["VIP", "MV"]);
        mockCurrent = { ...song, platform: "another" };
        act(() => renderer.update(<MusicItem musicItem={song} />));
        expect(button("Song - Artist").props.accessibilityState.selected).toBe(false);
        expect(renderer.root.findAllByType(Badge)).toHaveLength(0);
    });
    it("highlights matching title words without losing suffixes", () => {
        render({ musicItem: { ...song, title: "Song (Live)" }, highlightText: "Song" });
        const texts = renderer.root.findAllByType(ThemeText);
        expect(texts.some(node => node.props.children === "Song" && node.props.fontColor === "primary")).toBe(true);
        expect(texts.some(node => node.props.children === " (Live)" && node.props.fontColor === "text")).toBe(true);
    });
});
