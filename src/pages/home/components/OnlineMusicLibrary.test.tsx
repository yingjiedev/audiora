import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, View } from "react-native";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { blendOver, contrastRatio } from "@/utils/colorContrast";
import { resolveThemeColors } from "@/utils/themeColors";
import TrackPlayer from "@/core/trackPlayer";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import MusicItem from "@/components/mediaItem/musicItem";
import OnlineMusicLibrary from "./OnlineMusicLibrary";

const mockNavigate = jest.fn();
const mockSongs = Array.from({ length: 5 }, (_, index) => ({ id: String(index), platform: "source", title: `Song ${index}`, artist: "Artist", album: "Album", artwork: "", duration: 180 }));
const mockSheet = { id: "chart", platform: "source", title: "Real chart" };
const mockSources = [
    { hash: "search", name: "Search Source", supportedMethods: new Set(["search", "getTopLists", "getTopListDetail"]), enabled: true },
    { hash: "stream", name: "Stream Source", supportedMethods: new Set(["getMusicUrl"]), enabled: true },
    { hash: "disabled", name: "Disabled Source", supportedMethods: new Set(["search"]), enabled: false },
];
let mockPlugins = mockSources;
let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
function chartState() {
    return {
        charts: [mockSheet], hasCatalog: true, hasDetails: true, loading: false, hasError: false,
        getPreview: jest.fn(() => ({ state: "ready", musicList: mockSongs, sheet: mockSheet })),
        retryCatalog: jest.fn(), retryPreview: jest.fn(),
    };
}
let mockChartState = chartState();
const mockChartHook = jest.fn((_plugin: any, _index: number) => mockChartState);

jest.mock("./useLibraryCharts", () => ({
    __esModule: true, default: (plugin: any, index: number) => mockChartHook(plugin, index),
    libraryChartKey: (sheet: any) => `${sheet.platform}@${sheet.id}`,
}));
jest.mock("react-native/Libraries/Lists/FlatList", () => {
    const ReactMock = require("react");
    return { __esModule: true, default: (props: any) => ReactMock.createElement("ChartFlatList", props,
        props.data.map((item: any, index: number) => ReactMock.createElement(ReactMock.Fragment, { key: props.keyExtractor(item) }, props.renderItem({ item, index })))) };
});
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/mediaItem/musicItem", () => "MusicItem");
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string, args?: any) => args ? `${key}:${JSON.stringify(args)}` : key }) }));
jest.mock("@/core/router", () => ({
    ROUTE_PATH: { HOME: "home", SEARCH_PAGE: "search-page", SETTING: "setting", TOP_LIST: "top-list", TOP_LIST_DETAIL: "top-list-detail" }, useNavigate: () => mockNavigate,
}));
jest.mock("@/core/pluginManager", () => ({
    __esModule: true, default: { isPluginEnabled: (plugin: any) => plugin.enabled },
    useSortedPlugins: () => mockPlugins, usePluginDisplayNameResolver: () => (plugin: any) => plugin?.name ?? "",
}));
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { playWithReplacePlayList: jest.fn() }, useCurrentMusic: () => mockSongs[0] }));
jest.mock("@/utils/mediaUtils", () => ({ isSameMediaItem: (left: any, right: any) => left?.id === right?.id && left?.platform === right?.platform }));

const label = (key: string, args: any) => `${key}:${JSON.stringify(args)}`;

describe("online library charts", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    function render() {
        act(() => {
            renderer = TestRenderer.create(<OnlineMusicLibrary />);
        });
    }
    function button(name: string) {
        return renderer.root.findAllByProps({ accessibilityLabel: name }).find(node => typeof node.props.onPress === "function")!;
    }
    beforeEach(() => {
        jest.clearAllMocks(); mockChartState = chartState(); mockPlugins = mockSources;
        mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
    });
    afterEach(() => act(() => renderer?.unmount()));

    it("preserves scoped search and management and hides disabled sources", () => {
        render();
        act(() => button(label("musicLibrary.searchWithSource", { name: "Search Source" })).props.onPress());
        expect(mockNavigate).toHaveBeenLastCalledWith("search-page", { pluginHash: "search" });
        act(() => button("musicLibrary.manageSources").props.onPress());
        expect(mockNavigate).toHaveBeenLastCalledWith("setting", { type: "plugin" });
        expect(renderer.root.findAllByType(ThemeText).some(node => node.props.children === "Disabled Source")).toBe(false);
        expect(renderer.root.findAllByProps({ accessibilityLabel: "musicLibrary.searchOnline" })).toHaveLength(0);
    });

    it("uses shared rows and queues exactly the visible chart preview with context", () => {
        render();
        const rows = renderer.root.findAllByType(MusicItem);
        expect(rows).toHaveLength(5);
        expect(rows[4].props.actions).toEqual([]);
        act(() => rows[4].props.onItemPress(mockSongs[4]));
        expect(TrackPlayer.playWithReplacePlayList).toHaveBeenLastCalledWith(mockSongs[4], mockSongs, { routeName: "top-list-detail", sheet: { ...mockSheet, musicList: mockSongs } });
        act(() => button(label("musicLibrary.playChartPreview", { name: "Real chart", count: 5 })).props.onPress());
        expect(TrackPlayer.playWithReplacePlayList).toHaveBeenLastCalledWith(mockSongs[0], mockSongs, expect.anything());
        act(() => button(label("musicLibrary.openChart", { name: "Real chart" })).props.onPress());
        expect(mockNavigate).toHaveBeenLastCalledWith("top-list-detail", { pluginHash: "search", topList: mockSheet });
    });

    it("switches sources, resets the visible index and falls back when a source is removed", () => {
        render();
        const deck = renderer.root.findAllByProps({ testID: "library-chart-deck" }).find(node => typeof node.props.onScroll === "function")!;
        mockChartState.charts = [mockSheet, { ...mockSheet, id: "next" }];
        act(() => renderer.update(<OnlineMusicLibrary />));
        act(() => deck.props.onScroll({ nativeEvent: { contentOffset: { x: 500 } } }));
        expect(mockChartHook).toHaveBeenLastCalledWith(mockSources[0], 1);
        act(() => button(label("musicLibrary.selectSource", { name: "Stream Source" })).props.onPress());
        expect(mockChartHook).toHaveBeenLastCalledWith(mockSources[1], 0);
        expect(renderer.root.findAllByProps({ accessibilityLabel: label("musicLibrary.searchWithSource", { name: "Stream Source" }) })).toHaveLength(0);
        mockPlugins = [mockSources[0]];
        act(() => renderer.update(<OnlineMusicLibrary />));
        expect(mockChartHook).toHaveBeenLastCalledWith(mockSources[0], 0);
    });

    it("keeps failed and empty previews unplayable and offers a targeted retry", () => {
        mockChartState.getPreview.mockReturnValue({ state: "error", musicList: [], sheet: mockSheet });
        render();
        expect(button(label("musicLibrary.playChartPreview", { name: "Real chart", count: 0 })).props.disabled).toBe(true);
        expect(renderer.root.findAllByType(MusicItem)).toHaveLength(0);
        act(() => button("common.clickToRetry").props.onPress());
        expect(mockChartState.retryPreview).toHaveBeenCalledWith(mockSheet);
        mockChartState.getPreview.mockReturnValue({ state: "ready", musicList: [], sheet: mockSheet });
        act(() => renderer.update(<OnlineMusicLibrary />));
        expect(button(label("musicLibrary.playChartPreview", { name: "Real chart", count: 0 })).props.disabled).toBe(true);
    });

    it("keeps catalog-only sources browsable without unsupported preview playback", () => {
        mockChartState.hasDetails = false; mockChartState.getPreview.mockReturnValue({ state: "ready", musicList: [], sheet: mockSheet });
        render();
        expect(renderer.root.findAllByProps({ accessibilityLabel: label("musicLibrary.playChartPreview", { name: "Real chart", count: 0 }) })).toHaveLength(0);
        act(() => button(label("musicLibrary.openChart", { name: "Real chart" })).props.onPress());
        expect(mockNavigate).toHaveBeenCalledWith("top-list", { initialPluginHash: "search" });
    });

    it("offers retry for an empty catalog and source management when none are enabled", () => {
        mockChartState.charts = []; render();
        act(() => button("common.clickToRetry").props.onPress());
        expect(mockChartState.retryCatalog).toHaveBeenCalled();
        mockPlugins = []; mockChartState.hasCatalog = false;
        act(() => renderer.update(<OnlineMusicLibrary />));
        act(() => button("musicLibrary.addSource").props.onPress());
        expect(mockNavigate).toHaveBeenCalledWith("setting", { type: "plugin" });
    });

    it.each([
        [lightColors, false], [darkColors, true],
        [{ ...lightColors, primary: "#874AC1", card: "rgba(255,255,255,0.65)" }, false],
        [{ ...darkColors, primary: "#38BDB8", card: "rgba(24,35,60,0.6)" }, true],
    ] as const)("uses semantic colors on actual chart surfaces (%s)", (palette, dark) => {
        mockColors = resolveThemeColors({ ...palette, background: palette.pageBackground }, dark);
        render();
        const play = button(label("musicLibrary.playChartPreview", { name: "Real chart", count: 5 }));
        const fill = play.findAllByType(View).map(node => StyleSheet.flatten(node.props.style)).find(style => style?.backgroundColor === mockColors.tonalSurface)!;
        expect(play.findByType(Icon).props.color).toBe(mockColors.onTonal);
        const card = blendOver(mockColors.card, mockColors.pageBackground);
        const action = blendOver(fill.backgroundColor!, card);
        expect(contrastRatio(blendOver(mockColors.onTonal, action), action)).toBeGreaterThanOrEqual(4.5);
        expect(renderer.root.findAllByType(MusicItem)[0].props.left.props.color).toBe(mockColors.active);
        expect(renderer.root.findAllByType(MusicItem)[1].props.left.props.color).toBe(mockColors.textSecondary);
    });
});
