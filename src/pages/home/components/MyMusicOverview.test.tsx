import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { showPanel } from "@/components/panels/usePanel";
import { darkColors, lightColors } from "@/constants/colorPalette";
import TrackPlayer from "@/core/trackPlayer";
import { blendOver, contrastRatio } from "@/utils/colorContrast";
import { resolveThemeColors } from "@/utils/themeColors";
import MyMusicOverview from "./MyMusicOverview";

const mockNavigate = jest.fn();
const mockHistorySeed: IMusic.IMusicItem[] = [
    { id: "history-1", platform: "source-a", title: "Evening", artist: "Artist A", album: "Album A", artwork: "cover-a", duration: 180 },
    { id: "history-2", platform: "source-b", title: "Morning", artist: "Artist B", album: "Album B", artwork: "cover-b", duration: 240 },
];
const mockSheetsSeed = [
    { id: "favorite", title: "Favorites", worksNum: 3, platform: "local", coverImg: "favorite-cover" },
    { id: "road-trip", title: "Road Trip", worksNum: 8, platform: "local", coverImg: "trip-cover" },
];
let mockHistory = mockHistorySeed;
let mockSheets: IMusic.IMusicSheetItemBase[] = mockSheetsSeed;
let mockFavoriteMusic = mockHistorySeed;
let mockStarred = [{ id: "starred", platform: "remote" }];
let mockPlugins = [{ name: "source-a" }, { name: "source-b" }];
let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
let mockVersion = "0.3.1-preview.i88.mine.20261011.120000";
let mockDisplayNames: Record<string, string> = {};

jest.mock("@/components/base/fastImage", () => "FastImage");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: 1, logo: 2, quickFavorite: 3 } }));
jest.mock("@/core/i18n", () => ({
    useI18N: () => ({
        t: (key: string, args?: Record<string, string | number>) => {
            if (key === "home.songCount") return `${args?.count ?? 0} songs`;
            if (key === "home.playlistCount") return `${args?.count ?? 0} playlists`;
            if (key === "myMusic.openPlaylist") return `Open ${args?.title}`;
            if (key === "myMusic.playRecent") return `Play ${args?.title} by ${args?.artist}`;
            if (key === "home.currentVersion") return `Version ${args?.version}`;
            if (key === "myMusic.previewVersion") return `${args?.version} · Preview`;
            if (key === "myMusic.pluginCount") return `${args?.count ?? 0} plugins`;
            return key;
        },
    }),
}));
jest.mock("@/core/musicHistory", () => ({ useMusicHistory: () => mockHistory }));
jest.mock("@/core/musicSheet", () => ({
    __esModule: true,
    default: { defaultSheet: { id: "favorite" } },
    useSheetsBase: () => mockSheets,
    useStarredSheets: () => mockStarred,
    useSheetItem: () => ({ musicList: mockFavoriteMusic }),
}));
jest.mock("@/core/pluginManager", () => ({
    usePlugins: () => mockPlugins,
    usePluginDisplayNameResolver: () => (platform: string) => mockDisplayNames[platform] ?? platform,
}));
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { play: jest.fn() } }));
jest.mock("@/core/router", () => ({
    ROUTE_PATH: {
        DOWNLOADING: "downloading", LOCAL_SHEET_DETAIL: "local-sheet-detail",
        SETTING: "setting", SHEET_BROWSER: "sheet-browser", SEARCH_PAGE: "search",
    },
    useNavigate: () => mockNavigate,
}));
jest.mock("react-native-device-info", () => ({ getVersion: () => mockVersion }));
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("@/utils/rpx", () => ({
    __esModule: true,
    default: (value: number) => value,
    fontRpx: (value: number) => value,
    fontRpxRound: (value: number) => Math.round(value),
}));

describe("MyMusicOverview", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    const render = () => act(() => {
        renderer = TestRenderer.create(<MyMusicOverview />);
    });
    const press = (label: string) => act(() => {
        renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
    });
    const textNodes = () => renderer.root.findAll(node => node.type === "ThemeText" as unknown as React.ElementType);

    beforeEach(() => {
        jest.clearAllMocks();
        mockHistory = mockHistorySeed;
        mockSheets = mockSheetsSeed;
        mockFavoriteMusic = mockHistorySeed;
        mockStarred = [{ id: "starred", platform: "remote" }];
        mockPlugins = [{ name: "source-a" }, { name: "source-b" }];
        mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
        mockDisplayNames = {};
        mockVersion = "0.3.1-preview.i88.mine.20261011.120000";
    });
    afterEach(() => act(() => renderer?.unmount()));

    it("retains every existing music, playlist and settings destination", () => {
        render();
        press("common.setting");
        press("home.favoriteSheet");
        press("home.downloadManagement");
        press("home.starredPlaylists");
        press("sidebar.pluginManagement");
        press("sidebar.backupAndResume");
        press("home.aboutAndUpdate");
        press("home.viewAll");
        press("Open Road Trip");
        expect(mockNavigate.mock.calls).toEqual([
            ["setting", { type: "overview" }],
            ["local-sheet-detail", { id: "favorite" }],
            ["downloading"],
            ["sheet-browser", { sheetType: "starred" }],
            ["setting", { type: "plugin" }],
            ["setting", { type: "backup" }],
            ["setting", { type: "about" }],
            ["sheet-browser", { sheetType: "local" }],
            ["local-sheet-detail", { id: "road-trip" }],
        ]);
    });

    it("retains import, play by ID and create actions as separate buttons", () => {
        render();
        press("home.importPlaylist.a11y");
        press("home.playById.a11y");
        press("home.newPlaylist.a11y");
        expect(jest.mocked(showPanel).mock.calls).toEqual([["ImportMusicSheet"], ["PlayById"], ["CreateMusicSheet"]]);
    });

    it("opens the full history drawer from both history entrances", () => {
        render();
        press("home.playHistory");
        press("myMusic.viewRecent");
        expect(showPanel).toHaveBeenNthCalledWith(1, "PlayList", { initialTab: "history" });
        expect(showPanel).toHaveBeenNthCalledWith(2, "PlayList", { initialTab: "history" });
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("bounds the preview without trimming history and plays the original selected source", () => {
        mockHistory = Array.from({ length: 12 }, (_, index) => ({ ...mockHistorySeed[0], id: `song-${index}`, title: `Song ${index}` }));
        const historyBeforeRender = [...mockHistory];
        render();
        expect(TrackPlayer.play).not.toHaveBeenCalled();
        const recentButtons = renderer.root.findAll(node => typeof node.props.accessibilityLabel === "string" && node.props.accessibilityLabel.startsWith("Play Song"));
        expect(new Set(recentButtons.map(node => node.props.accessibilityLabel)).size).toBe(6);
        expect(renderer.root.findByProps({ accessibilityLabel: "home.playHistory" }).props.accessibilityHint).toBe("12 songs");
        press("Play Song 4 by Artist A");
        expect(TrackPlayer.play).toHaveBeenCalledWith(mockHistory[4]);
        expect(mockHistory).toEqual(historyBeforeRender);
        press("myMusic.viewRecent");
        expect(showPanel).toHaveBeenCalledWith("PlayList", { initialTab: "history" });
    });

    it("shows useful empty states while keeping all management functions available", () => {
        mockHistory = [];
        mockSheets = [mockSheetsSeed[0]];
        mockStarred = [];
        render();
        expect(textNodes().some(node => node.props.children === "myMusic.historyEmpty")).toBe(true);
        expect(textNodes().some(node => node.props.children === "myMusic.playlistsHint")).toBe(true);
        expect(renderer.root.findByProps({ accessibilityLabel: "home.starredPlaylists" }).props.accessibilityHint).toBe("0 playlists");
        press("home.exploreMusic");
        press("home.newPlaylist.a11y");
        press("home.importPlaylist.a11y");
        expect(mockNavigate).toHaveBeenCalledWith("search");
        expect(showPanel).toHaveBeenCalledWith("CreateMusicSheet");
        expect(showPanel).toHaveBeenCalledWith("ImportMusicSheet");
    });

    it("never redirects Favorites to a custom playlist before the default sheet is available", () => {
        mockSheets = [mockSheetsSeed[1]];
        render();
        const favorite = renderer.root.findByProps({ accessibilityLabel: "home.favoriteSheet" });
        expect(favorite.props.disabled).toBe(true);
        expect(favorite.props.accessibilityHint).toBe("0 songs");
        press("home.favoriteSheet");
        expect(mockNavigate).not.toHaveBeenCalled();
        press("Open Road Trip");
        expect(mockNavigate).toHaveBeenCalledWith("local-sheet-detail", { id: "road-trip" });
    });

    it("updates collection counts and recent music when the stores change", () => {
        render();
        mockSheets = [{ ...mockSheetsSeed[0], worksNum: 20 }, mockSheetsSeed[1], { ...mockSheetsSeed[1], id: "new-sheet", title: "New Sheet" }];
        mockHistory = [mockHistorySeed[1]];
        mockStarred = [...mockStarred, { id: "new-star", platform: "remote" }];
        act(() => renderer.update(<MyMusicOverview />));
        expect(renderer.root.findByProps({ accessibilityLabel: "home.favoriteSheet" }).props.accessibilityHint).toBe("20 songs");
        expect(renderer.root.findByProps({ accessibilityLabel: "home.playHistory" }).props.accessibilityHint).toBe("1 songs");
        expect(renderer.root.findByProps({ accessibilityLabel: "home.starredPlaylists" }).props.accessibilityHint).toBe("2 playlists");
        expect(textNodes().some(node => node.props.children === "2 playlists")).toBe(true);
        press("Open New Sheet");
        expect(mockNavigate).toHaveBeenCalledWith("local-sheet-detail", { id: "new-sheet" });
    });

    it("uses plugin display names as a fallback without rewriting the playback identity", () => {
        mockHistory = [{ ...mockHistorySeed[0], artist: "" }];
        mockDisplayNames = { "source-a": "My Source" };
        render();
        expect(textNodes().some(node => node.props.children === "My Source")).toBe(true);
        mockDisplayNames = { "source-a": "Renamed Source" };
        act(() => renderer.update(<MyMusicOverview />));
        expect(textNodes().some(node => node.props.children === "Renamed Source")).toBe(true);
        press("Play Evening by musicLibrary.unknownArtist");
        expect(TrackPlayer.play).toHaveBeenCalledWith(mockHistory[0]);
        expect(mockHistory[0].platform).toBe("source-a");
    });

    it("shows a short preview version while retaining its full identity in the About entrance", () => {
        render();
        expect(textNodes().some(node => node.props.children === "0.3.1 · Preview")).toBe(true);
        expect(textNodes().some(node => node.props.children === `Version ${mockVersion}`)).toBe(false);
        expect(renderer.root.findByProps({ accessibilityLabel: "home.aboutAndUpdate" }).props.accessibilityHint).toBe(`Version ${mockVersion}`);
        press("home.aboutAndUpdate");
        expect(mockNavigate).toHaveBeenCalledWith("setting", { type: "about" });
        const imageSources = renderer.root.findAll(node => node.type === "FastImage" as unknown as React.ElementType).map(node => node.props.source);
        expect(imageSources).toEqual(expect.arrayContaining(["favorite-cover", "trip-cover", "cover-a", "cover-b"]));
    });

    it("keeps stable and other version labels intact", () => {
        mockVersion = "0.3.0";
        render();
        expect(textNodes().some(node => node.props.children === "Version 0.3.0")).toBe(true);
        mockVersion = "0.4.0-beta.1";
        act(() => renderer.update(<MyMusicOverview />));
        expect(textNodes().some(node => node.props.children === "Version 0.4.0-beta.1")).toBe(true);
    });

    it("uses actual favorite artwork when sheet metadata has no cover and updates with the collection", () => {
        mockSheets = [{ ...mockSheetsSeed[0], coverImg: undefined }, mockSheetsSeed[1]];
        mockFavoriteMusic = [{ ...mockHistorySeed[0], artwork: "" }, { ...mockHistorySeed[1], artwork: "saved-cover" }];
        render();
        const sources = () => renderer.root.findAll(node => node.type === "FastImage" as unknown as React.ElementType).map(node => node.props.source);
        expect(sources()).toContain("saved-cover");
        mockFavoriteMusic = [{ ...mockHistorySeed[0], artwork: "new-favorite-cover" }];
        act(() => renderer.update(<MyMusicOverview />));
        expect(sources()).toContain("new-favorite-cover");
        expect(sources()).not.toContain("saved-cover");
        press("home.favoriteSheet");
        expect(mockNavigate).toHaveBeenCalledWith("local-sheet-detail", { id: "favorite" });
    });

    it("uses one title line for short and long songs and responds to strip layout changes", () => {
        mockHistory = [mockHistorySeed[0], { ...mockHistorySeed[1], title: "A very long song title across two lines" }];
        render();
        const titles = textNodes().filter(node => mockHistory.some(music => music.title === node.props.children));
        const titleStyles = titles.map(node => StyleSheet.flatten(node.props.style));
        expect(titleStyles[0].height).toBe(titleStyles[1].height);
        expect(titleStyles[0].height).toBe(titleStyles[0].lineHeight);
        expect(titles.every(node => node.props.numberOfLines === 1)).toBe(true);
        const strip = () => renderer.root.findAll(node => node.props.horizontal === true && typeof node.props.onLayout === "function")[0];
        const songButton = () => renderer.root.findByProps({ accessibilityLabel: "Play Evening by Artist A" });
        act(() => strip().props.onLayout({ nativeEvent: { layout: { width: 360 } } }));
        const wideWidth = StyleSheet.flatten(songButton().props.style({ pressed: false })).width;
        act(() => strip().props.onLayout({ nativeEvent: { layout: { width: 250 } } }));
        const narrowWidth = StyleSheet.flatten(songButton().props.style({ pressed: false })).width;
        expect(wideWidth).not.toBe(narrowWidth);
        expect(narrowWidth).toBe(250);
        press("Play Evening by Artist A");
        expect(TrackPlayer.play).toHaveBeenCalledWith(mockHistory[0]);
    });

    it("keeps four shortcuts in order and opens the real plugin manager even with no plugins", () => {
        render();
        const shortcuts = ["home.playHistory", "home.downloadManagement", "home.starredPlaylists", "sidebar.pluginManagement"];
        const quickRow = renderer.root.findByProps({ accessibilityLabel: shortcuts[0] }).parent;
        expect(quickRow?.children.map(child => typeof child === "string" ? child : child.props.accessibilityLabel)).toEqual(shortcuts);
        expect(textNodes().some(node => node.props.children === "2 plugins")).toBe(true);
        mockPlugins = [];
        act(() => renderer.update(<MyMusicOverview />));
        expect(textNodes().some(node => node.props.children === "0 plugins")).toBe(true);
        press("sidebar.pluginManagement");
        expect(mockNavigate).toHaveBeenCalledWith("setting", { type: "plugin" });
    });

    it("groups all six songs into full pages and reflows without losing playback destinations", () => {
        mockHistory = Array.from({ length: 6 }, (_, index) => ({ ...mockHistorySeed[0], id: `song-${index}`, title: `Song ${index}` }));
        render();
        const getStrip = () => renderer.root.findAll(node => node.props.horizontal === true && typeof node.props.onLayout === "function")[0];
        act(() => getStrip().props.onLayout({ nativeEvent: { layout: { width: 600 } } }));
        const strip = getStrip();
        expect(strip.props.pagingEnabled).toBe(true);
        const pages = strip.props.children as React.ReactElement<any>[];
        expect(pages).toHaveLength(2);
        expect(pages.map(page => page.props.children.length)).toEqual([3, 3]);
        const pageStyle = StyleSheet.flatten(pages[0].props.style);
        const coverStyle = StyleSheet.flatten(pages[0].props.children[0].props.style({ pressed: false }));
        expect(coverStyle.width * 3 + pageStyle.gap * 2).toBeCloseTo(pageStyle.width);
        act(() => getStrip().props.onLayout({ nativeEvent: { layout: { width: 400 } } }));
        const twoColumnPages = getStrip().props.children as React.ReactElement<any>[];
        expect(twoColumnPages.map(page => page.props.children.length)).toEqual([2, 2, 2]);
        act(() => getStrip().props.onLayout({ nativeEvent: { layout: { width: 240 } } }));
        const narrowPages = getStrip().props.children as React.ReactElement<any>[];
        expect(narrowPages).toHaveLength(6);
        press("Play Song 5 by Artist A");
        expect(TrackPlayer.play).toHaveBeenCalledWith(mockHistory[5]);
    });

    it("retains the last partial page and full accessible titles without an empty title line", () => {
        mockHistory = Array.from({ length: 5 }, (_, index) => ({ ...mockHistorySeed[0], id: `song-${index}`, title: `Long original song title ${index}` }));
        render();
        const strip = renderer.root.findAll(node => node.props.horizontal === true && typeof node.props.onLayout === "function")[0];
        act(() => strip.props.onLayout({ nativeEvent: { layout: { width: 600 } } }));
        const currentStrip = renderer.root.findAll(node => node.props.horizontal === true && typeof node.props.onLayout === "function")[0];
        const pages = currentStrip.props.children as React.ReactElement<any>[];
        expect(pages.map(page => page.props.children.length)).toEqual([3, 2]);
        press("Play Long original song title 4 by Artist A");
        expect(TrackPlayer.play).toHaveBeenCalledWith(mockHistory[4]);
    });

    it.each([
        ["light", lightColors, false],
        ["dark", darkColors, true],
        ["custom", { ...lightColors, primary: "#EFA322" }, false],
        ["custom-alpha", { ...lightColors, primary: "rgba(56, 103, 244, 0.35)" }, false],
    ] as const)("uses readable semantic surfaces in the %s theme", (_name, palette, dark) => {
        mockColors = resolveThemeColors({ ...palette, background: palette.pageBackground }, dark);
        render();
        mockSheets = [{ ...mockSheetsSeed[0], coverImg: undefined }, mockSheetsSeed[1]];
        mockFavoriteMusic = [];
        act(() => renderer.update(<MyMusicOverview />));
        expect(textNodes().filter(node => node.props.color === mockColors.onTonal)).toHaveLength(0);
        expect(contrastRatio(mockColors.text, mockColors.card)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(mockColors.primaryText, mockColors.card)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(mockColors.onTonal, mockColors.tonalSurface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(mockColors.favorite, mockColors.tonalSurface)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(mockColors.onPrimary, blendOver(mockColors.primary, mockColors.pageBackground))).toBeGreaterThanOrEqual(4.5);
        const create = renderer.root.findByProps({ accessibilityLabel: "home.newPlaylist.a11y" });
        expect(StyleSheet.flatten(create.props.style({ pressed: false })).backgroundColor).toBe(mockColors.primary);
        expect(create.findByType("ThemeText" as unknown as React.ElementType).props.color).toBe(mockColors.onPrimary);
        const surfaces = renderer.root.findAll(node => node.props.style && typeof node.props.style !== "function").map(node => StyleSheet.flatten(node.props.style)?.backgroundColor);
        expect(surfaces).toContain(mockColors.tonalSurface);
        expect(surfaces).toContain(mockColors.card);
        const playIcons = renderer.root.findAll(node => node.type === "Icon" as unknown as React.ElementType && node.props.name === "play");
        expect(playIcons.every(node => node.props.color === mockColors.onInverse)).toBe(true);
    });
});
