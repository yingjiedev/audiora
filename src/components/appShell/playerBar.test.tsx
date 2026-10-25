import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";
import PlayerBar from "./playerBar";
import TrackPlayer from "@/core/trackPlayer";
import MusicSheet from "@/core/musicSheet";
import { openPlayer } from "@/core/playerOverlay";
import { showPanel } from "@/components/panels/usePanel";
import { contrastRatio } from "@/utils/colorContrast";

const mockSong = { id: "one", platform: "test", title: "Song", artist: "Artist" };
let mockPaused = true;
let mockFavorite = false;
let mockDark = false;
let mockOverride = {};
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { play: jest.fn(), pause: jest.fn(), skipToNext: jest.fn(), skipToPrevious: jest.fn() }, useCurrentMusic: () => mockSong, useMusicState: () => mockPaused }));
jest.mock("@/core/musicSheet", () => ({ __esModule: true, default: { defaultSheet: { id: "favorites" }, addMusic: jest.fn(), removeMusic: jest.fn() }, useFavorite: () => mockFavorite }));
jest.mock("@/core/playerOverlay", () => ({ openPlayer: jest.fn() }));
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/utils/mediaExtra", () => ({ useMediaExtraProperty: jest.fn() }));
jest.mock("@/utils/artwork", () => ({ resolveArtwork: () => "cover.jpg" }));
jest.mock("@/utils/trackUtils", () => ({ musicIsPaused: (state: boolean) => state }));
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: 1 } }));
jest.mock("@/components/base/fastImage", () => "FastImage");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/pages/musicDetail/components/bottom/seekBar", () => "SeekBar");
jest.mock("@/hooks/useColors", () => () => {
    const palette = require("@/constants/colorPalette");
    return require("@/utils/themeColors").resolveThemeColors({ ...(mockDark ? palette.darkColors : palette.lightColors), ...mockOverride }, mockDark);
});

describe("tablet playback bar", () => {
    const renderers: TestRenderer.ReactTestRenderer[] = [];
    const onSelectPane = jest.fn();
    function render(canShowPane = true) {
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<PlayerBar expanded bottom={16} canShowPane={canShowPane} paneOpen={false} onSelectPane={onSelectPane} />);
        });
        renderers.push(renderer);
        return renderer;
    }
    function press(renderer: TestRenderer.ReactTestRenderer, label: string) {
        const node = renderer.root.findAllByProps({ accessibilityLabel: label }).find(item => typeof item.type !== "string" || typeof item.props.onPress === "function");
        act(() => node!.props.onPress());
    }
    beforeEach(() => {
        jest.clearAllMocks(); mockPaused = true; mockFavorite = false; mockDark = false; mockOverride = {};
    });
    afterEach(() => act(() => renderers.splice(0).forEach(renderer => renderer.unmount())));

    it("uses existing transport, favorites and full-player actions", () => {
        const renderer = render();
        press(renderer, "musicDetail.a11y.play");
        press(renderer, "musicDetail.a11y.skipToPrevious");
        press(renderer, "musicDetail.a11y.skipToNext");
        press(renderer, "musicDetail.a11y.favorite");
        press(renderer, "musicBar.a11y.openDetail");
        expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.skipToPrevious).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.skipToNext).toHaveBeenCalledTimes(1);
        expect(MusicSheet.addMusic).toHaveBeenCalledWith("favorites", mockSong);
        expect(openPlayer).toHaveBeenCalledTimes(1);
    });

    it("opens a non-modal supporting pane only when space permits", () => {
        const renderer = render();
        press(renderer, "musicBar.a11y.playlist"); press(renderer, "adaptive.lyric");
        expect(onSelectPane.mock.calls).toEqual([["queue"], ["lyric"]]);
        expect(showPanel).not.toHaveBeenCalled();
        press(render(false), "musicBar.a11y.playlist");
        expect(showPanel).toHaveBeenCalledWith("PlayList");
    });

    it.each([false, true])("uses readable player foregrounds on the real surface (dark=%s)", dark => {
        mockDark = dark;
        mockOverride = { musicBar: "#121527", primary: "#7b38e8" };
        const renderer = render();
        const surface = StyleSheet.flatten(renderer.root.findByProps({ testID: "tablet-player-bar" }).props.style).backgroundColor;
        for (const text of renderer.root.findAllByType("ThemeText" as React.ElementType)) {
            expect(contrastRatio(text.props.color, surface)).toBeGreaterThanOrEqual(4.5);
        }
    });
});
