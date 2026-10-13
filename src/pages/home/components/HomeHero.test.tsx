import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { resolveThemeColors } from "@/utils/themeColors";
import { blendOver, contrastRatio } from "@/utils/colorContrast";
import HomeHero from "./HomeHero";
import type { HomeFeatureAppearance } from "./homeFeatureAppearance";

const song: IMusic.IMusicItem = { id: "one", platform: "remote", title: "Real song", artist: "Real artist", album: "Album", duration: 180, artwork: "cover" };
const mockNavigate = jest.fn();
const mockOpen = jest.fn();
const mockPlay = jest.fn();
const mockPause = jest.fn();
let mockCurrent: IMusic.IMusicItem | null = null;
let mockPaused = true;
let mockAssociatedArtwork: string | undefined;
let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);

jest.mock("@/components/base/fastImage", () => "FastImage");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("react-native-linear-gradient", () => "LinearGradient");
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: 1, homeDiscoveryStudio: 7 } }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/core/pluginManager", () => ({ usePluginDisplayNameResolver: () => () => "Source label" }));
jest.mock("@/core/playerOverlay", () => ({ openPlayer: () => mockOpen() }));
jest.mock("@/core/router", () => ({ ROUTE_PATH: { LOCAL: "local" }, useNavigate: () => mockNavigate }));
jest.mock("@/core/trackPlayer", () => ({
    __esModule: true,
    default: { play: (...args: unknown[]) => mockPlay(...args), pause: () => mockPause() },
    useCurrentMusic: () => mockCurrent, useMusicState: () => null,
}));
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value, fontRpx: (value: number) => value }));
jest.mock("@/utils/trackUtils", () => ({ musicIsPaused: () => mockPaused }));
jest.mock("@/utils/mediaUtils", () => ({ isSameMediaItem: (a: IMusic.IMusicItem, b?: IMusic.IMusicItem) => !!b && a.id === b.id && a.platform === b.platform }));
jest.mock("@/utils/artwork", () => ({ resolveArtwork: (music?: IMusic.IMusicItem) => mockAssociatedArtwork || music?.artwork || undefined }));

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
        mockAssociatedArtwork = undefined;
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

    it("resumes the actual historical song with its artwork and source", () => {
        mockCurrent = { ...song, id: "different" };
        render(song);
        const cover = renderer.root.findByType("FastImage" as any);
        expect(cover.props.source).toBe("cover");
        const times = renderer.root.findAllByType("ThemeText" as any);
        expect(times.some(node => node.props.children === "Real artist · Source label")).toBe(true);
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

    it("resumes the paused current song through its independent play control", () => {
        mockCurrent = song;
        render(song);
        press("musicDetail.a11y.play");
        expect(mockPlay).toHaveBeenCalledWith(song);
        expect(mockPause).not.toHaveBeenCalled();
    });

    it.each(["window", "record"] as const)("uses the same associated artwork as the song row for local tracks in %s", appearance => {
        mockAssociatedArtwork = "file:///actual-associated-cover.jpg";
        act(() => {
            renderer = TestRenderer.create(<HomeHero music={{ ...song, platform: "local", artwork: "" }} appearance={appearance} />);
        });
        expect(renderer.root.findByType("FastImage" as any).props.source).toBe(mockAssociatedArtwork);
    });

    it("keeps the existing image fallback when a real song has no cover", () => {
        render({ ...song, artwork: "" });
        const cover = renderer.root.findByType("FastImage" as any);
        expect(cover.props.source).toBeUndefined();
        expect(cover.props.placeholderSource).toBe(1);
    });

    it.each([
        ["light", lightColors, false],
        ["dark", darkColors, true],
        ["custom", { ...lightColors, primary: "#7459C7" }, false],
        ["transparent", { ...lightColors, card: "rgba(255,255,255,0.72)", surface: "rgba(238,244,255,0.8)" }, false],
    ].flatMap(row => ["window", "record"].map(appearance => [...row, appearance])))
    ("keeps the media card and play control readable in the %s theme / %s", (_mode, colors, dark, appearance) => {
        const palette = colors as typeof lightColors;
        mockColors = resolveThemeColors({ ...palette, background: palette.pageBackground }, dark as boolean);
        act(() => {
            renderer = TestRenderer.create(<HomeHero music={song} appearance={appearance as HomeFeatureAppearance} />);
        });
        const play = renderer.root.findByProps({ accessibilityLabel: "musicDetail.a11y.play" });
        const target = StyleSheet.flatten(play.props.style);
        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
        const icon = play.findByType("Icon" as any);
        const record = appearance === "record";
        const actualCard = record ? mockColors.featuredRecordSurface : mockColors.featuredWindowSurface;
        const buttonSurface = record ? mockColors.inverseSurface : mockColors.featuredActionSurface;
        expect(contrastRatio(blendOver(icon.props.color, buttonSurface), buttonSurface)).toBeGreaterThanOrEqual(3);
        renderer.root.findAllByType("ThemeText" as any).forEach(node => {
            const background = node.props.children === "home.continueListening" ? mockColors.featuredRecordSurface : actualCard;
            const backgrounds = record ? mockColors.featuredRecordGradient : [background];
            backgrounds.forEach(surface => expect(contrastRatio(node.props.color, surface)).toBeGreaterThanOrEqual(4.5));
        });
        press("home.continueListening · Real song");
        press("musicDetail.a11y.play");
        expect(mockPlay).toHaveBeenCalledWith(song);
    });

    it("reuses the studio photograph with an opaque heading backing and compact layout", () => {
        act(() => {
            renderer = TestRenderer.create(<HomeHero music={song} appearance="record" />);
        });
        const lighting = renderer.root.findByProps({ testID: "home-record-lighting" });
        expect(lighting.props.colors).toEqual(mockColors.featuredRecordGradient);
        expect(lighting.props.pointerEvents).toBe("none");
        const artwork = renderer.root.findByProps({ testID: "home-record-art-stage" });
        expect(artwork.props.pointerEvents).toBe("none");
        const rim = renderer.root.findByProps({ testID: "home-record-rim" });
        expect(rim.props.pointerEvents).toBe("none");
        expect(StyleSheet.flatten(rim.props.style).borderColor).toBe(mockColors.featuredRecordRim);
        const title = renderer.root.findByProps({ children: song.title });
        const titleStyle = StyleSheet.flatten(title.props.style);
        const backing = StyleSheet.flatten(renderer.root.findByProps({ testID: "home-record-copy-surface" }).props.style);
        expect(backing.backgroundColor).toBe(mockColors.featuredRecordSurface);
        expect(parseFloat(backing.width)).toBeGreaterThan(parseFloat(titleStyle.maxWidth));
        const fade = renderer.root.findByProps({ testID: "home-record-art-fade" });
        expect(StyleSheet.flatten(fade.props.style).left).toBe(backing.width);
        expect(fade.props.colors).toEqual(mockColors.featuredRecordArtworkFade);
        const photo = artwork.findAll(node => node.props.source === 7)[0];
        expect(photo.props.resizeMode).toBe("cover");
        const compactHeight = StyleSheet.flatten(renderer.root.findByProps({ testID: "home-hero-record" }).props.style).minHeight;
        act(() => {
            renderer.update(<HomeHero music={song} appearance="window" />);
        });
        expect(compactHeight).toBeLessThan(StyleSheet.flatten(renderer.root.findByProps({ testID: "home-hero-window" }).props.style).minHeight);
    });
});
