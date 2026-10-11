import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import HomeOverview from "./homeOverview";

const mockNavigate = jest.fn();
const mockShowPanel = jest.fn();
let mockDisplayNames: Record<string, string> = {};
let mockFeaturedMusic: IMusic.IMusicItem | null = null;
let mockRecentMusics: IMusic.IMusicItem[] = [];
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
jest.mock("@/hooks/useColors", () => () => ({
    card: "#FFFFFF",
    primary: "#3978FF",
    primaryText: "#2451B4",
    text: "#111827",
    textSecondary: "#6B7280",
}));
jest.mock("@/utils/rpx", () => ({
    __esModule: true,
    default: (value: number) => value,
    fontRpx: (value: number) => value,
}));
jest.mock("@/utils/trackUtils", () => ({ musicIsPaused: () => true }));
jest.mock("./useHomeDiscovery", () => () => ({
    hasError: false,
    loading: false,
    topLists: [],
}));
jest.mock("./useHomeOverview", () => () => ({
    currentMusic: null,
    favoriteSheet: { id: "favorite", worksNum: 13 },
    featuredMusic: mockFeaturedMusic,
    historyCount: 11,
    recentMusics: mockRecentMusics,
    topListPlugins: [{ hash: "plugin-1", name: "demo" }],
    topListCache: {},
    recentHistory: [],
    tasteArtists: [],
}));
jest.mock("../HomeHero", () => "HomeHero");

describe("HomeOverview quick access", () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockShowPanel.mockReset();
        mockDisplayNames = {};
        mockFeaturedMusic = null;
        mockRecentMusics = [];
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
        expect(texts().some(node => node.props.children === "My source" && node.props.color === "#2451B4")).toBe(true);
        expect(texts().some(node => node.props.children === "someone · My source")).toBe(true);
        expect(texts().some(node => node.props.children === "My charts")).toBe(true);

        mockDisplayNames = { test: "Updated source", demo: "Updated charts" };
        act(() => renderer.update(<HomeOverview />));
        expect(texts().some(node => node.props.children === "Updated source")).toBe(true);
        expect(texts().some(node => node.props.children === "someone · Updated source")).toBe(true);
        expect(texts().some(node => node.props.children === "Updated charts")).toBe(true);
        expect(mockFeaturedMusic.platform).toBe("test");
        expect(mockRecentMusics[0].platform).toBe("test");
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
