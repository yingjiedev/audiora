import Color from "color";
import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { useProgress } from "@/core/trackPlayer";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { blendOver, contrastRatio } from "@/utils/colorContrast";
import { resolveThemeColors } from "@/utils/themeColors";
import CompactPlaybackButton from "./compactPlaybackButton";

const mockSong: IMusic.IMusicItem = { id: "song", platform: "test", title: "Song", artist: "Artist", album: "Album", duration: 120, artwork: "" };
let mockActiveTrack: Record<string, unknown> | undefined;
let mockProgress = { position: 30, duration: 120 };
let mockDark = false;
let mockThemeOverrides: Record<string, string> = {};

jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@react-native-masked-view/masked-view", () => "MaskedView");
jest.mock("react-native-linear-gradient", () => "LinearGradient");
jest.mock("react-native-track-player", () => ({ useActiveTrack: () => mockActiveTrack }));
jest.mock("@/core/trackPlayer", () => ({ useProgress: jest.fn(() => mockProgress) }));
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value / 2 }));
jest.mock("@/utils/mediaUtils", () => ({ getMediaUniqueKey: (item: typeof mockSong) => `${item.platform}@${item.id}` }));
jest.mock("@/hooks/useColors", () => () => {
    const { resolveThemeColors: resolve } = require("@/utils/themeColors");
    const { lightColors: light, darkColors: dark } = require("@/constants/colorPalette");
    return resolve({ ...(mockDark ? dark : light), background: "transparent", ...mockThemeOverrides }, mockDark);
});

function element(paused = true, onPress = jest.fn()) {
    const palette = mockDark ? darkColors : lightColors;
    return <CompactPlaybackButton musicItem={mockSong} paused={paused} label={paused ? "Play" : "Pause"} color={palette.musicBarText} onPress={onPress} />;
}

function render() {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(element());
    });
    return renderer!;
}

function fraction(renderer: TestRenderer.ReactTestRenderer) {
    const base = renderer.root.findByProps({ testID: "compact-playback-base" });
    const progress = renderer.root.findByProps({ testID: "compact-playback-progress" });
    const height = StyleSheet.flatten(progress.props.style).height;
    const inset = base.props.name === "play" ? 3.75 : 4.5;
    return height > 0 ? (height / base.props.size * 24 - inset) / (24 - inset * 2) : 0;
}

describe("CompactPlaybackButton", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockActiveTrack = { ...mockSong, url: "file:///song.mp3" };
        mockProgress = { position: 30, duration: 120 };
        mockDark = false;
        mockThemeOverrides = {};
    });

    it("keeps the 48dp playback target and exposes progress on the same accessible button", () => {
        const renderer = render();
        const onPress = jest.fn();
        act(() => renderer.update(element(true, onPress)));
        const button = renderer.root.findByProps({ testID: "compact-playback-button" });
        const style = StyleSheet.flatten(button.props.style({ pressed: false }));
        expect(style.minWidth).toBeGreaterThanOrEqual(48);
        expect(style.minHeight).toBeGreaterThanOrEqual(48);
        expect(button.props.accessibilityRole).toBe("button");
        expect(button.props.accessibilityLabel).toBe("Play");
        expect(button.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 25 });
        act(() => button.props.onPress());
        expect(onPress).toHaveBeenCalledTimes(1);
        expect(fraction(renderer)).toBeCloseTo(0.25);
        expect(useProgress).toHaveBeenCalledWith(250);
        act(() => renderer.update(element(false, onPress)));
        expect(button.props.accessibilityLabel).toBe("Pause");
        expect(fraction(renderer)).toBeCloseTo(0.25);
        act(() => renderer.unmount());
    });

    it("follows forward seeks, backward seeks and replay without animating through stale progress", () => {
        const renderer = render();
        for (const [position, expected] of [[90, 0.75], [10, 1 / 12], [150, 1], [0, 0], [-5, 0]]) {
            mockProgress = { position, duration: 120 };
            act(() => renderer.update(element()));
            expect(fraction(renderer)).toBeCloseTo(expected);
            expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "compact-playback-progress" }).props.style).height > 0).toBe(expected > 0);
        }
        act(() => renderer.unmount());
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("shows only the original icon for invalid duration %s", duration => {
        mockProgress = { position: 30, duration };
        const renderer = render();
        expect(fraction(renderer)).toBe(0);
        expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "compact-playback-progress" }).props.style).height).toBe(0);
        expect(renderer.root.findByProps({ testID: "compact-playback-button" }).props.accessibilityValue).toBeUndefined();
        act(() => renderer.unmount());
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY])("never sends a nonfinite position %s to the fill clip", position => {
        mockProgress = { position, duration: 120 };
        const renderer = render();
        expect(fraction(renderer)).toBe(0);
        act(() => renderer.unmount());
    });

    it.each([
        undefined,
        { ...mockSong, id: "previous", url: "file:///previous.mp3" },
        { ...mockSong, platform: "another-source", url: "file:///song.mp3" },
        { ...mockSong, url: "audiora://next" },
    ])("hides another track or placeholder's progress while the selected song loads (%s)", track => {
        mockActiveTrack = track;
        const renderer = render();
        expect(fraction(renderer)).toBe(0);
        expect(renderer.root.findByProps({ testID: "compact-playback-button" }).props.accessibilityValue).toBeUndefined();
        mockActiveTrack = { ...mockSong, url: "file:///song.mp3" };
        mockProgress = { position: 5, duration: 100 };
        act(() => renderer.update(element()));
        expect(fraction(renderer)).toBeCloseTo(0.05);
        act(() => renderer.unmount());
    });

    it.each([false, true])("keeps the original icon and progress readable on the actual dock (dark=%s)", dark => {
        mockDark = dark;
        const palette = dark ? darkColors : lightColors;
        const variants: Record<string, string>[] = [{}, { primary: "#FECB4A" }, { primary: "rgba(112, 64, 216, 0.3)", musicBar: Color(palette.musicBar).alpha(0.65).toString() }];
        for (const overrides of variants) {
            mockThemeOverrides = overrides;
            const input = { ...palette, background: "transparent", ...overrides };
            const colors = resolveThemeColors(input, dark);
            const background = blendOver(dark ? colors.tabBar ?? colors.surface ?? colors.card : colors.musicBar ?? colors.card, colors.pageBackground);
            const renderer = render();
            const fill = renderer.root.findByType("LinearGradient");
            const base = renderer.root.findByProps({ testID: "compact-playback-base" });
            expect(fill.props.colors).toEqual(colors.compactPlaybackProgressGradient);
            expect(Math.min(...fill.props.colors.map((stop: string) => contrastRatio(stop, background)))).toBeGreaterThanOrEqual(3);
            expect(contrastRatio(base.props.color, background)).toBeGreaterThanOrEqual(3);
            expect(input).toEqual({ ...palette, background: "transparent", ...overrides });
            act(() => renderer.unmount());
        }
    });
});
