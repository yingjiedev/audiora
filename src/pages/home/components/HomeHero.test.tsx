import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { resolveThemeColors } from "@/utils/themeColors";
import { blendOver, contrastRatio } from "@/utils/colorContrast";
import HomeHero from "./HomeHero";

const song: IMusic.IMusicItem = { id: "one", platform: "remote", title: "Real song", artist: "Real artist", album: "Album", duration: 180, artwork: "cover" };
const mockNavigate = jest.fn();
const mockOpen = jest.fn();
const mockPlay = jest.fn();
const mockPause = jest.fn();
let mockCurrent: IMusic.IMusicItem | null = null;
let mockPaused = true;
let mockProgress = { position: 0, duration: 0 };
let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);

jest.mock("@/components/base/fastImage", () => "FastImage");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: 1 } }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/core/pluginManager", () => ({ usePluginDisplayNameResolver: () => () => "Source label" }));
jest.mock("@/core/playerOverlay", () => ({ openPlayer: () => mockOpen() }));
jest.mock("@/core/router", () => ({ ROUTE_PATH: { LOCAL: "local" }, useNavigate: () => mockNavigate }));
jest.mock("@/core/trackPlayer", () => ({
    __esModule: true,
    default: { play: (...args: unknown[]) => mockPlay(...args), pause: () => mockPause() },
    useCurrentMusic: () => mockCurrent, useMusicState: () => null, useProgress: () => mockProgress,
}));
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value, fontRpx: (value: number) => value }));
jest.mock("@/utils/trackUtils", () => ({ musicIsPaused: () => mockPaused }));
jest.mock("@/utils/mediaUtils", () => ({ isSameMediaItem: (a: IMusic.IMusicItem, b?: IMusic.IMusicItem) => !!b && a.id === b.id && a.platform === b.platform }));

describe("Home listening card", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    const render = (music?: IMusic.IMusicItem) => act(() => {
        renderer = TestRenderer.create(<HomeHero music={music} />);
    });
    const press = (label: string) => act(() => renderer.root.findByProps({ accessibilityLabel: label }).props.onPress());
    beforeEach(() => {
        jest.clearAllMocks();
        mockCurrent = null;
        mockPaused = true;
        mockProgress = { position: 0, duration: 0 };
        mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
    });
    afterEach(() => act(() => renderer?.unmount()));

    it("opens local music from both empty card controls", () => {
        render();
        expect(renderer.root.findAllByType("FastImage" as any)).toHaveLength(0);
        press("home.localMusic");
        press("musicDetail.a11y.play");
        expect(mockNavigate).toHaveBeenCalledTimes(2);
        expect(mockNavigate).toHaveBeenLastCalledWith("local");
        expect(mockPlay).not.toHaveBeenCalled();
    });

    it("resumes a historical song without applying the current track's progress", () => {
        mockCurrent = { ...song, id: "different" };
        mockProgress = { position: 90, duration: 240 };
        render(song);
        const cover = renderer.root.findByType("FastImage" as any);
        expect(cover.props.source).toBe("cover");
        const times = renderer.root.findAllByType("ThemeText" as any);
        expect(times.some(node => node.props.children.join?.("") === "0:00 / 3:00")).toBe(true);
        press("home.continueListening · Real song");
        expect(mockPlay).toHaveBeenCalledWith(song);
        expect(mockOpen).not.toHaveBeenCalled();
    });

    it("opens the existing player and pauses only the currently playing song", () => {
        mockCurrent = song;
        mockPaused = false;
        render(song);
        press("home.continueListening · Real song");
        press("musicDetail.a11y.pause");
        expect(mockOpen).toHaveBeenCalledTimes(1);
        expect(mockPause).toHaveBeenCalledTimes(1);
        expect(mockPlay).not.toHaveBeenCalled();
    });

    it("resumes a paused current song and clamps progress to its duration", () => {
        mockCurrent = song;
        mockProgress = { position: 250, duration: 180 };
        render(song);
        press("musicDetail.a11y.play");
        expect(mockPlay).toHaveBeenCalledWith(song);
        const times = renderer.root.findAllByType("ThemeText" as any);
        expect(times.some(node => node.props.children.join?.("") === "3:00 / 3:00")).toBe(true);
    });

    it.each([
        ["light", lightColors, false],
        ["dark", darkColors, true],
        ["custom", { ...lightColors, primary: "#7459C7" }, false],
        ["transparent", { ...lightColors, card: "rgba(255,255,255,0.72)", surface: "rgba(238,244,255,0.8)" }, false],
    ])("uses neutral controls on the actual %s surface", (_mode, colors, dark) => {
        mockColors = resolveThemeColors({ ...colors, background: colors.pageBackground }, dark);
        render(song);
        const play = renderer.root.findByProps({ accessibilityLabel: "musicDetail.a11y.play" });
        const target = StyleSheet.flatten(play.props.style);
        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
        const icon = play.findByType("Icon" as any);
        expect(icon.props.color).toBe(mockColors.text);
        const actualCard = blendOver(mockColors.card, mockColors.pageBackground);
        const actualSurface = blendOver(mockColors.surface, actualCard);
        expect(contrastRatio(blendOver(mockColors.text, actualSurface), actualSurface)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(blendOver(mockColors.text, actualCard), actualCard)).toBeGreaterThanOrEqual(4.5);
    });
});
