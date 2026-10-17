import React from "react";
jest.mock("react-native-linear-gradient", () => "LinearGradient");
import { ScrollView, StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import HomeOverview from "./homeOverview";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { resolveThemeColors } from "@/utils/themeColors";
import { blendOver, contrastRatio } from "@/utils/colorContrast";
import { addListeningInterval, type ListeningData } from "@/core/listeningStatsModel";

const mockNavigate = jest.fn();
const mockShowPanel = jest.fn();
let mockDisplayNames: Record<string, string> = {};
let mockFeaturedMusic: IMusic.IMusicItem | null = null;
let mockRecentMusics: IMusic.IMusicItem[] = [];
let mockFavoriteMusics: IMusic.IMusicItem[] = [];
let mockStats: ListeningData = { version: 1, startedAt: 0, days: [] };
const mockStatsListeners = new Set<() => void>();
const mockSubscribeStats = (listener: () => void) => {
    mockStatsListeners.add(listener);
    return () => mockStatsListeners.delete(listener);
};
let mockReducedMotion = false;
const mockScrollTo = jest.fn();
let mockHasSource = true;
let mockSheetCover: string | undefined;
let mockAssociatedArt: Record<string, string> = {};
const mockDataReads = jest.fn();
let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
let mockDiscovery = { hasError: false, loading: false, topLists: [] as IMusic.IMusicSheetItemBase[], topListPluginHash: "plugin-1", topListPluginName: "demo" };
jest.mock("@/components/mediaItem/musicItem", () => "MusicItem");
jest.mock("@/core/listeningStats", () => ({
    useListeningStats: () => jest.requireActual("react").useSyncExternalStore(mockSubscribeStats, () => mockStats),
}));
jest.mock("@/components/panels/usePanel", () => ({ showPanel: (...args: unknown[]) => mockShowPanel(...args) }));

jest.mock("@/components/base/fastImage", () => "FastImage");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/constants/assetsConst", () => ({
    ImgAsset: {
        albumDefault: 1,
        quickLocal: 2,
        quickHistory: 3,
        quickFavorite: 4,
        quickFolder: 5,
    },
}));
jest.mock("@/core/i18n", () => ({
    __esModule: true,
    default: { t: (key: string) => key },
    useI18N: () => ({
        t: (key: string, args?: { count?: number }) =>
            key === "home.songCount" ? `${args?.count ?? 0} songs` : key,
    }),
}));
jest.mock("@/core/pluginManager", () => ({
    __esModule: true,
    usePluginDisplayNameResolver: () => (plugin: any) => {
        const platform = typeof plugin === "string" ? plugin : (plugin?.name ?? "");
        return mockDisplayNames[platform] ?? platform;
    },
}));
jest.mock("@/core/router", () => ({
    ROUTE_PATH: {
        HISTORY: "history",
        LOCAL: "local",
        LOCAL_SHEET_DETAIL: "local-sheet-detail",
        MUSIC_DETAIL: "music-detail",
        RECOMMEND_SHEETS: "recommend-sheets",
        SEARCH_PAGE: "search-page",
        TOP_LIST: "top-list",
        TOP_LIST_DETAIL: "top-list-detail",
    },
    useNavigate: () => mockNavigate,
}));
const shiyinMusic = {
    id: "shiyin-1",
    platform: "test",
    artist: "someone",
    title: "hot song",
    album: "Album",
    artwork: "",
    duration: 100,
};
const mockReplacePlayList = jest.fn();

jest.mock("@/core/trackPlayer", () => ({
    __esModule: true,
    default: {
        pause: jest.fn(),
        play: jest.fn(),
        playList: [],
        playWithReplacePlayList: (...args: unknown[]) =>
            mockReplacePlayList(...(args as [])),
    },
    useMusicState: () => null,
    useProgress: () => ({ position: 0, duration: 0 }),
}));
jest.mock("@/core/randomPlay", () => ({
    buildShiYinQueue: jest.fn(async () => ({
        musicList: [shiyinMusic],
        boardCount: 3,
        pluginCount: 1,
        poolSize: 120,
        fallbackLevel: 0,
    })),
    SHIYIN_QUEUE_SIZE: 30,
}));
jest.mock("@/utils/toast", () => ({
    __esModule: true,
    default: { success: jest.fn(), warn: jest.fn() },
}));
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("@/hooks/useMotion", () => () => ({ reduceMotion: mockReducedMotion }));
jest.mock("react-native-reanimated", () => ({
    __esModule: true,
    default: { View: "AnimatedView", ScrollView: "AnimatedScrollView" },
    Extrapolation: { CLAMP: "clamp" },
    interpolate: () => -18,
    useSharedValue: () => ({ value: 0 }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useAnimatedScrollHandler: (handler: unknown) => handler,
}));
jest.mock("@/utils/rpx", () => ({
    __esModule: true,
    default: (value: number) => value,
    fontRpx: (value: number) => value,
}));
jest.mock("@/utils/trackUtils", () => ({ musicIsPaused: () => true }));
jest.mock("@/utils/artwork", () => ({ resolveArtwork: (music: IMusic.IMusicItem) => mockAssociatedArt[String(music.id)] || music.artwork || undefined }));
jest.mock("./useHomeDiscovery", () => () => mockDiscovery);
jest.mock("./useHomeOverview", () => () => {
    mockDataReads();
    return {
        currentMusic: null,
        favoriteSheet: { id: "favorite", worksNum: 13, ...(mockSheetCover ? { coverImg: mockSheetCover } : {}) },
        favoriteMusics: mockFavoriteMusics,
        featuredMusic: mockFeaturedMusic,
        historyCount: 11,
        recentMusics: mockRecentMusics,
        topListPlugins: mockHasSource ? [{ hash: "plugin-1", name: "demo" }] : [],
        topListCache: {},
        recentHistory: [],
        tasteArtists: [],
    };
});
jest.mock("../HomeHero", () => "HomeHero");

describe("HomeOverview quick access", () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockShowPanel.mockReset();
        mockDisplayNames = {};
        mockFeaturedMusic = null;
        mockRecentMusics = [];
        mockFavoriteMusics = [];
        mockStats = { version: 1, startedAt: 0, days: [] };
        mockStatsListeners.clear();
        mockReducedMotion = false;
        mockHasSource = true;
        mockSheetCover = undefined;
        mockAssociatedArt = {};
        mockDataReads.mockClear();
        mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
        mockScrollTo.mockReset();
        mockDiscovery = { hasError: false, loading: false, topLists: [], topListPluginHash: "plugin-1", topListPluginName: "demo" };
        mockReplacePlayList.mockReset();
    });
    afterEach(() => jest.restoreAllMocks());

    it("keeps the collection cover consistent with associated artwork and respects a custom sheet cover", () => {
        mockFavoriteMusics = [{ ...shiyinMusic, id: "first-local", artwork: "" }, { ...shiyinMusic, id: "second", artwork: "actual-second-cover" }];
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<HomeOverview />);
        });
        expect(renderer.root.findByType("FastImage" as any).props.source).toBe("actual-second-cover");
        mockAssociatedArt = { "first-local": "actual-associated-cover" };
        act(() => renderer.update(<HomeOverview />));
        expect(renderer.root.findByType("FastImage" as any).props.source).toBe("actual-associated-cover");
        mockSheetCover = "custom-sheet-cover";
        act(() => renderer.update(<HomeOverview />));
        expect(renderer.root.findByType("FastImage" as any).props.source).toBe(mockSheetCover);
        act(() => renderer.unmount());
    });

    it.each([
        ["light", lightColors, false],
        ["dark", darkColors, true],
        ["custom", { ...lightColors, primary: "#7459C7" }, false],
        ["transparent", { ...lightColors, primary: "rgba(56,103,244,0.7)", card: "rgba(255,255,255,0.72)" }, false],
    ])("keeps the selected channel readable on the actual %s fill", (_label, colors, dark) => {
        mockColors = resolveThemeColors({ ...colors, background: colors.pageBackground }, dark);
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<HomeOverview />);
        });
        const selected = renderer.root.findByProps({ accessibilityLabel: "home.forYou" });
        const text = selected.findByType("ThemeText" as any);
        const fill = StyleSheet.flatten(text.parent!.findAll(node => node.props.pointerEvents === "none" && node.props.collapsable === false)[0].props.style).backgroundColor;
        expect(fill).toBe(mockColors.primary);
        const actual = blendOver(fill, mockColors.pageBackground);
        expect(contrastRatio(blendOver(text.props.color, actual), actual)).toBeGreaterThanOrEqual(4.5);
        act(() => renderer.unmount());
    });

    it.each([false, true])("jumps below the sticky navigation and follows actual scroll position (reduced motion %s)", reduced => {
        mockReducedMotion = reduced;
        jest.spyOn(ScrollView.prototype, "scrollTo").mockImplementation(mockScrollTo);
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<HomeOverview />);
        });
        const measure = (id: string, layout: object) => act(() => renderer.root.findAllByProps({ testID: id }).find(node => typeof node.props.onLayout === "function")!.props.onLayout({ nativeEvent: { layout } }));
        measure("home-section-navigation", { height: 50 });
        measure("home-favorites-section", { y: 400 });
        measure("home-charts-section", { y: 900 });
        act(() => renderer.root.findByProps({ accessibilityLabel: "home.myCollection" }).props.onPress());
        expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 350, animated: !reduced });
        const rootScroll = renderer.root.findAllByProps({ testID: "home-overview-scroll" }).find(node => typeof node.props.onScroll === "function")!;
        act(() => rootScroll.props.onScroll({ nativeEvent: { contentOffset: { y: 350 } } }));
        expect(renderer.root.findByProps({ accessibilityLabel: "home.myCollection" }).props.accessibilityState.selected).toBe(true);
        act(() => renderer.root.findAllByProps({ accessibilityLabel: "home.topList" }).find(node => node.props.accessibilityState)!.props.onPress());
        expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 850, animated: !reduced });
        act(() => rootScroll.props.onScroll({ nativeEvent: { contentOffset: { y: 850 } } }));
        const charts = renderer.root.findAllByProps({ accessibilityLabel: "home.topList" }).find(node => node.props.accessibilityState)!;
        expect(charts.props.accessibilityState.selected).toBe(true);
        act(() => renderer.root.findByProps({ accessibilityLabel: "home.forYou" }).props.onPress());
        expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 0, animated: !reduced });
        act(() => renderer.unmount());
    });

    it("does not rerender content or flash intermediate selections during section jumps", () => {
        jest.spyOn(ScrollView.prototype, "scrollTo").mockImplementation(mockScrollTo);
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<HomeOverview />);
        });
        const measure = (id: string, layout: object) => act(() => renderer.root.findAllByProps({ testID: id }).find(node => typeof node.props.onLayout === "function")!.props.onLayout({ nativeEvent: { layout } }));
        measure("home-section-navigation", { height: 50 });
        measure("home-favorites-section", { y: 400 });
        measure("home-charts-section", { y: 900 });
        const rootScroll = renderer.root.findAllByProps({ testID: "home-overview-scroll" }).find(node => typeof node.props.onScroll === "function")!;
        const chartTab = () => renderer.root.findAllByProps({ accessibilityLabel: "home.topList" }).find(node => node.props.accessibilityState)!;
        const reads = mockDataReads.mock.calls.length;
        act(() => chartTab().props.onPress());
        expect(chartTab().props.accessibilityState.selected).toBe(true);
        for (const y of [100, 300, 450, 750, 850]) {
            act(() => rootScroll.props.onScroll({ nativeEvent: { contentOffset: { y } } }));
            expect(chartTab().props.accessibilityState.selected).toBe(true);
        }
        act(() => rootScroll.props.onScrollBeginDrag());
        act(() => rootScroll.props.onScroll({ nativeEvent: { contentOffset: { y: 400 } } }));
        expect(renderer.root.findByProps({ accessibilityLabel: "home.myCollection" }).props.accessibilityState.selected).toBe(true);
        expect(mockDataReads).toHaveBeenCalledTimes(reads);
        act(() => renderer.unmount());
    });

    it("clamps jumps to reachable content and releases selection on native scroll completion", () => {
        jest.spyOn(ScrollView.prototype, "scrollTo").mockImplementation(mockScrollTo);
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<HomeOverview />);
        });
        const rootScroll = renderer.root.findAllByProps({ testID: "home-overview-scroll" }).find(node => typeof node.props.onScroll === "function")!;
        act(() => rootScroll.props.onLayout({ nativeEvent: { layout: { height: 600 } } }));
        act(() => rootScroll.props.onContentSizeChange(375, 900));
        act(() => renderer.root.findAllByProps({ testID: "home-charts-section" }).find(node => node.props.onLayout)!.props.onLayout({ nativeEvent: { layout: { y: 800 } } }));
        const chartTab = () => renderer.root.findAllByProps({ accessibilityLabel: "home.topList" }).find(node => node.props.accessibilityState)!;
        act(() => chartTab().props.onPress());
        expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 300, animated: true });
        act(() => rootScroll.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { y: 0 } } }));
        expect(renderer.root.findByProps({ accessibilityLabel: "home.forYou" }).props.accessibilityState.selected).toBe(true);
        act(() => renderer.unmount());
    });

    it("opens the real chart page from the navigation when no source can render a preview", () => {
        mockHasSource = false;
        mockDiscovery.topListPluginName = "";
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<HomeOverview />);
        });
        act(() => renderer.root.findByProps({ accessibilityLabel: "home.topList" }).props.onPress());
        expect(mockNavigate).toHaveBeenCalledWith("top-list");
        act(() => renderer.unmount());
    });

    it("opens recent songs in the playback drawer and keeps other Home destinations", () => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<HomeOverview />);
        });

        const labels = [
            "home.recommendSheet",
            "home.playHistory",
            "home.favoriteSheet",
            "home.importPlaylist.a11y",
        ];

        labels.forEach(label => {
            act(() => {
                renderer!.root.findByProps({ accessibilityLabel: label }).props.onPress();
            });
        });

        expect(mockNavigate).toHaveBeenNthCalledWith(1, "recommend-sheets");
        expect(mockShowPanel).toHaveBeenCalledWith("PlayList", { initialTab: "history" });
        expect(mockNavigate).toHaveBeenNthCalledWith(2, "local-sheet-detail", {
            id: "favorite",
        });
        expect(mockNavigate).toHaveBeenNthCalledWith(3, "local");
    });

    it("refreshes source labels without losing semantic colors or original platform identifiers", () => {
        mockFeaturedMusic = { ...shiyinMusic };
        mockRecentMusics = [{ ...shiyinMusic }];
        mockDisplayNames = { test: "My source", demo: "My charts" };
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<HomeOverview />);
        });
        const texts = () => renderer.root.findAllByType("ThemeText" as any);
        expect(renderer.root.findByType("HomeHero" as any).props.music).toBe(mockFeaturedMusic);
        expect(texts().some(node => node.props.children === "someone · My source")).toBe(true);
        expect(texts().some(node => node.props.children === "My charts")).toBe(true);

        mockDisplayNames = { test: "Updated source", demo: "Updated charts" };
        act(() => renderer.update(<HomeOverview />));
        expect(texts().some(node => node.props.children === "someone · Updated source")).toBe(true);
        expect(texts().some(node => node.props.children === "Updated charts")).toBe(true);
        expect(mockFeaturedMusic.platform).toBe("test");
        expect(mockRecentMusics[0].platform).toBe("test");
        act(() => renderer.unmount());
    });

    it("groups saved songs for discovery but plays the complete favorite sheet from either entry", async () => {
        mockFavoriteMusics = Array.from({ length: 5 }, (_, index) => ({ ...shiyinMusic, id: `favorite-${index}` }));
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<HomeOverview />);
        });
        const rows = renderer.root.findAllByType("MusicItem" as any);
        expect(rows).toHaveLength(5);
        expect(rows[2].props.musicItem).toBe(mockFavoriteMusics[2]);
        expect(rows[0].props.actions).toEqual(["favorite"]);
        expect(rows.every(row => row.props.presentation === "favorites")).toBe(true);
        await act(async () => rows[4].props.onItemPress(mockFavoriteMusics[4]));
        expect(mockReplacePlayList).toHaveBeenLastCalledWith(mockFavoriteMusics[4], mockFavoriteMusics, {
            sheet: { id: "favorite", worksNum: 13, musicList: mockFavoriteMusics }, routeName: "local-sheet-detail",
        });
        await act(async () => renderer.root.findByProps({ accessibilityLabel: "musicLibrary.playAllCount" }).props.onPress());
        expect(mockReplacePlayList.mock.calls.at(-1)[0]).toBe(mockFavoriteMusics[0]);
        act(() => renderer.root.findByProps({ accessibilityLabel: "home.favoriteSheet · home.viewAll" }).props.onPress());
        expect(mockNavigate).toHaveBeenLastCalledWith("local-sheet-detail", { id: "favorite" });
        act(() => renderer.unmount());
    });

    it("bounds the Home preview while keeping songs outside it in the full playback queue", async () => {
        mockFavoriteMusics = Array.from({ length: 10 }, (_, index) => ({ ...shiyinMusic, id: `favorite-${index}` }));
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<HomeOverview />);
        });
        const rows = renderer.root.findAllByType("MusicItem" as any);
        expect(rows).toHaveLength(9);
        expect(rows[8].props.musicItem).toBe(mockFavoriteMusics[8]);
        await act(async () => rows[8].props.onItemPress(mockFavoriteMusics[8]));
        expect(mockReplacePlayList.mock.calls.at(-1)[1]).toEqual(mockFavoriteMusics);
        act(() => renderer.unmount());
    });

    it("updates retained play totals in place and resolves actual source names without rerendering the hero", () => {
        mockFavoriteMusics = [shiyinMusic, { ...shiyinMusic, platform: "other" }, { ...shiyinMusic, platform: "本地" }];
        mockDisplayNames = { test: "QQ音乐", other: "Renamed source" };
        const start = new Date(2026, 9, 16, 12).getTime();
        mockStats = addListeningInterval(mockStats, shiyinMusic, start, start + 1000, true);
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<HomeOverview />);
        });
        const rows = () => renderer.root.findAllByType("MusicItem" as any);
        expect(rows().map(row => row.props.playCount)).toEqual([1, 0, 0]);
        expect(rows().map(row => row.props.sourceName)).toEqual(["QQ音乐", "Renamed source", "home.localMusic"]);
        const reads = mockDataReads.mock.calls.length;
        act(() => {
            mockStats = addListeningInterval(mockStats, shiyinMusic, start + 86400000, start + 86401000, true);
            mockStatsListeners.forEach(listener => listener());
        });
        expect(rows().map(row => row.props.playCount)).toEqual([2, 0, 0]);
        expect(mockDataReads).toHaveBeenCalledTimes(reads);
        mockDisplayNames.test = "My source";
        act(() => renderer.update(<HomeOverview />));
        expect(rows()[0].props.sourceName).toBe("My source");
        act(() => renderer.unmount());
        expect(mockStatsListeners.size).toBe(0);
    });

    it("keeps empty Favorites useful without rendering a fake song or enabled play-all", () => {
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<HomeOverview />);
        });
        expect(renderer.root.findAllByType("MusicItem" as any)).toHaveLength(0);
        expect(renderer.root.findAllByProps({ accessibilityLabel: "musicLibrary.playAllCount" })).toHaveLength(0);
        act(() => renderer.root.findByProps({ accessibilityLabel: "home.exploreMusic" }).props.onPress());
        expect(mockNavigate).toHaveBeenLastCalledWith("search-page");
        act(() => renderer.unmount());
    });

    it("opens the actual chart object and keeps plugin descriptions out of the Home preview", () => {
        const sheet = { id: "rising", platform: "demo", title: "Rising", artwork: "real-chart-cover", description: "Plugin definition: a very long explanation" };
        mockDiscovery.topLists = [sheet];
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<HomeOverview />);
        });
        expect(renderer.root.findAllByType("ThemeText" as any).some(node => node.props.children === sheet.description)).toBe(false);
        expect(renderer.root.findByType("FastImage" as any).props.source).toBe(sheet.artwork);
        act(() => renderer.root.findByProps({ accessibilityLabel: sheet.title }).props.onPress());
        expect(mockNavigate).toHaveBeenLastCalledWith("top-list-detail", { pluginHash: "plugin-1", topList: sheet });
        act(() => renderer.root.findAllByProps({ accessibilityLabel: "home.topList" }).find(node => !node.props.accessibilityState)!.props.onPress());
        expect(mockNavigate).toHaveBeenLastCalledWith("top-list", { initialPluginHash: "plugin-1" });
        act(() => renderer.unmount());
    });

    it("stretches all quick entries evenly without a trailing offset", () => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<HomeOverview />);
        });

        const quickCards = [
            "home.recommendSheet",
            "home.playHistory",
            "home.favoriteSheet",
            "home.importPlaylist.a11y",
        ].map(label =>
            renderer!.root.findByProps({ accessibilityLabel: label }),
        );

        quickCards.forEach(card => {
            const style = StyleSheet.flatten(card.props.style);
            expect(style.flex).toBe(1);
            expect(style.minWidth).toBe(0);
            expect(style.marginRight).toBeUndefined();
        });
    });

    it("plays a shuffled hot queue from the Shiyin card", async () => {
        const { buildShiYinQueue } = jest.requireMock("@/core/randomPlay");
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<HomeOverview />);
        });

        const card = renderer!.root.findByProps({
            accessibilityLabel: "home.shiyin",
        });

        await act(async () => {
            await card.props.onPress();
        });

        expect(buildShiYinQueue).toHaveBeenCalledTimes(1);
        expect(mockReplacePlayList).toHaveBeenCalledWith(shiyinMusic, [shiyinMusic]);
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
