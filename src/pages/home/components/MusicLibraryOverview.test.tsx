import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { resolveThemeColors } from "@/utils/themeColors";
import { blendOver, contrastRatio } from "@/utils/colorContrast";
import TrackPlayer from "@/core/trackPlayer";
import { openLocalMusicScanner } from "@/pages/localMusic/scanMusic";
import MusicLibraryOverview from "./MusicLibraryOverview";
import MusicItem from "@/components/mediaItem/musicItem";
import PillTabBar from "@/components/base/pillTabBar";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";

const mockNavigate = jest.fn();
const mockSeed = Array.from({ length: 14 }, (_, index) => ({
    id: String(index), platform: "local", title: `Song ${index}`, artist: index < 9 ? "Artist A" : "Artist B",
    album: "Album", duration: 180, artwork: "", localPath: index < 9 ? `/Music/A/${index}.mp3` : `/Music/B/${index}.mp3`,
}));
let mockMusics = mockSeed;
let mockPlugins = [
    { hash: "search", name: "Search Source", supportedMethods: new Set(["search"]), enabled: true },
    { hash: "stream", name: "Stream Source", supportedMethods: new Set(["getMusicUrl"]), enabled: true },
    { hash: "disabled", name: "Disabled Source", supportedMethods: new Set(["search"]), enabled: false },
];
let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);

jest.mock("react-native/Libraries/Lists/FlatList", () => {
    const ReactMock = require("react");
    return { __esModule: true, default: (props: any) => ReactMock.createElement("LibraryFlatList", props,
        props.ListHeaderComponent,
        props.data.length ? props.data.map((item: any, index: number) => ReactMock.createElement(ReactMock.Fragment, { key: item.key }, props.renderItem({ item, index }))) : props.ListEmptyComponent,
    ) };
});
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/pillTabBar", () => "PillTabBar");
jest.mock("@/components/mediaItem/musicItem", () => "MusicItem");
jest.mock("@/core/i18n", () => ({
    useI18N: () => ({ t: (key: string, args?: Record<string, unknown>) => args ? `${key}:${JSON.stringify(args)}` : key, getLanguage: () => ({ locale: "en-US" }) }),
}));
jest.mock("@/core/localMusicSheet", () => ({ __esModule: true, default: { useMusicList: () => mockMusics } }));
jest.mock("@/utils/mediaUtils", () => ({ getLocalPath: (item: any) => item.localPath ?? item.$?.localPath ?? null }));
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { playWithReplacePlayList: jest.fn() } }));
jest.mock("@/constants/commonConst", () => ({ localMusicSheetId: "local-music-sheet", localPluginPlatform: "local" }));
jest.mock("@/pages/localMusic/scanMusic", () => ({ openLocalMusicScanner: jest.fn() }));
jest.mock("@/core/pluginManager", () => ({
    __esModule: true, default: { isPluginEnabled: (plugin: any) => plugin.enabled },
    useSortedPlugins: () => mockPlugins, usePluginDisplayNameResolver: () => (plugin: any) => plugin?.name ?? "",
}));
jest.mock("@/core/router", () => ({
    ROUTE_PATH: { HOME: "home", LOCAL: "local", SEARCH_PAGE: "search-page", SEARCH_MUSIC_LIST: "search-music-list", SETTING: "setting" },
    useNavigate: () => mockNavigate,
}));
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value, fontRpx: (value: number) => value }));

function label(key: string, args?: Record<string, unknown>) {
    return args ? `${key}:${JSON.stringify(args)}` : key;
}

describe("MusicLibraryOverview", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    beforeEach(() => {
        jest.clearAllMocks(); mockMusics = mockSeed; mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
    });
    afterEach(() => act(() => renderer?.unmount()));
    function render() {
        act(() => {
            renderer = TestRenderer.create(<MusicLibraryOverview />);
        });
    }
    function button(name: string) {
        return renderer.root.findAllByProps({ accessibilityLabel: name }).find(node => typeof node.props.onPress === "function")!;
    }
    function category(mode: string) {
        act(() => renderer.root.findAllByProps({ testID: `library-category-${mode}` }).find(node => typeof node.props.onPress === "function")!.props.onPress());
    }
    function online() {
        act(() => renderer.root.findByType(PillTabBar).props.onIndexChange(1));
    }

    it("keeps local and online navigation and makes the header search follow its scope", () => {
        render();
        expect(renderer.root.findByType(PillTabBar).props.routes).toEqual([
            { key: "local", title: "home.localMusic" }, { key: "online", title: "musicLibrary.onlineMusic" },
        ]);
        act(() => button("musicLibrary.searchLocal").props.onPress());
        expect(mockNavigate).toHaveBeenLastCalledWith("search-music-list", expect.objectContaining({ musicList: mockSeed }));
        online();
        act(() => button("musicLibrary.searchOnline").props.onPress());
        expect(mockNavigate).toHaveBeenLastCalledWith("search-page");
    });

    it("uses the shared song row for the complete library with playback and original context", () => {
        render();
        const rows = renderer.root.findAllByType(MusicItem);
        expect(rows).toHaveLength(14);
        expect(rows[13].props.index).toBe(14);
        expect(rows[13].props.actions).toEqual(["addNext", "more"]);
        act(() => rows[13].props.onItemPress(mockSeed[13]));
        expect(TrackPlayer.playWithReplacePlayList).toHaveBeenCalledWith(mockSeed[13], mockSeed, expect.objectContaining({ routeName: "home", sheet: expect.objectContaining({ id: "local-music-sheet" }) }));
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("opens a real artist subset and restores the full artist browser", () => {
        render(); category("artists");
        expect(renderer.root.findAllByType(MusicItem)).toHaveLength(0);
        act(() => button(label("musicLibrary.viewEntry", { name: "Artist A" })).props.onPress());
        const rows = renderer.root.findAllByType(MusicItem);
        expect(rows).toHaveLength(9);
        act(() => rows[8].props.onItemPress(mockSeed[8]));
        expect(TrackPlayer.playWithReplacePlayList).toHaveBeenCalledWith(mockSeed[8], mockSeed.slice(0, 9), expect.anything());
        act(() => button(label("musicLibrary.backToGroups", { name: "musicLibrary.artists" })).props.onPress());
        expect(renderer.root.findAllByType(MusicItem)).toHaveLength(0);
        expect(button(label("musicLibrary.viewEntry", { name: "Artist B" }))).toBeDefined();
    });

    it("opens a folder's real songs and play-all uses that subset", () => {
        render(); category("folders");
        act(() => button(label("musicLibrary.viewEntry", { name: "B" })).props.onPress());
        expect(renderer.root.findAllByType(MusicItem)).toHaveLength(5);
        act(() => button(label("musicLibrary.playAllCount", { count: 5 })).props.onPress());
        expect(TrackPlayer.playWithReplacePlayList).toHaveBeenCalledWith(mockSeed[9], mockSeed.slice(9), expect.anything());
        category("tracks");
        expect(renderer.root.findAllByType(MusicItem)).toHaveLength(14);
    });

    it("returns to the category browser if its last song is removed", () => {
        render(); category("folders");
        act(() => button(label("musicLibrary.viewEntry", { name: "B" })).props.onPress());
        mockMusics = mockSeed.slice(0, 9);
        act(() => renderer.update(<MusicLibraryOverview />));
        expect(renderer.root.findAllByType(MusicItem)).toHaveLength(0);
        expect(button(label("musicLibrary.viewEntry", { name: "A" }))).toBeDefined();
    });

    it("connects the single scan action to the shared scanner and preserves management", () => {
        render();
        act(() => button("localMusic.scanLocalMusic").props.onPress());
        expect(openLocalMusicScanner).toHaveBeenCalledWith(mockNavigate);
        act(() => button("musicLibrary.viewAllLocal").props.onPress());
        expect(mockNavigate).toHaveBeenLastCalledWith("local");
    });

    it("has a useful local empty state without a fake playback action", () => {
        mockMusics = []; render();
        expect(renderer.root.findAllByType(MusicItem)).toHaveLength(0);
        expect(renderer.root.findAllByProps({ accessibilityLabel: label("musicLibrary.playAllCount", { count: 0 }) })).toHaveLength(0);
        expect(renderer.root.findAllByType(ThemeText).some(node => node.props.children === "musicLibrary.emptyLocalTitle")).toBe(true);
        expect(button("localMusic.scanLocalMusic")).toBeDefined();
    });

    it("hides disabled sources and opens the selected searchable source", () => {
        render(); online();
        act(() => button(label("musicLibrary.searchWithSource", { name: "Search Source" })).props.onPress());
        expect(mockNavigate).toHaveBeenLastCalledWith("search-page", { pluginHash: "search" });
        expect(renderer.root.findAllByType(ThemeText).some(node => node.props.children === "Disabled Source")).toBe(false);
        act(() => button(label("musicLibrary.viewEntry", { name: "Stream Source" })).props.onPress());
        expect(mockNavigate).toHaveBeenLastCalledWith("setting", { type: "plugin" });
    });

    it("keeps adding sources available when none are enabled", () => {
        const original = mockPlugins; mockPlugins = [];
        try {
            render(); online();
            act(() => button("musicLibrary.addSource").props.onPress());
            expect(mockNavigate).toHaveBeenCalledWith("setting", { type: "plugin" });
        } finally {
            mockPlugins = original;
        }
    });

    it.each([
        { dark: false, primary: undefined, card: undefined },
        { dark: true, primary: undefined, card: undefined },
        { dark: false, primary: "#874AC1", card: "rgba(255, 255, 255, 0.65)" },
        { dark: true, primary: "#38BDB8", card: "rgba(24, 35, 60, 0.6)" },
    ])("uses theme-derived tonal actions with readable text (%s)", ({ dark, primary, card }) => {
        const preset = dark ? darkColors : lightColors;
        mockColors = resolveThemeColors({ ...preset, background: preset.pageBackground, primary: primary ?? preset.primary, card: card ?? preset.card }, dark);
        render();
        const scan = button("localMusic.scanLocalMusic");
        const scanStyle = scan.props.style({ pressed: false }).find((value: any) => value.backgroundColor);
        expect(scanStyle.backgroundColor).toBe(mockColors.tonalSurface);
        expect(scan.findByType(Icon).props.color).toBe(mockColors.onTonal);
        const actualCard = blendOver(mockColors.card, mockColors.pageBackground);
        const actualAction = blendOver(mockColors.tonalSurface, actualCard);
        expect(contrastRatio(blendOver(mockColors.onTonal, actualAction), actualAction)).toBeGreaterThanOrEqual(4.5);
        expect(renderer.root.findAllByType(Icon).filter(node => node.props.name === "user")[0].props.color).toBe(mockColors.text);
    });
});
