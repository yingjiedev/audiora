import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import MusicLibraryOverview from "./MusicLibraryOverview";

const mockNavigate = jest.fn();

jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/pillTabBar", () => "PillTabBar");
jest.mock("@/pages/topList/components/topListBody", () => "TopListBody");
jest.mock("@/core/localMusicSheet", () => ({
    __esModule: true,
    default: {
        useMusicList: () => [{ id: "1", platform: "local", title: "First", artist: "Artist", album: "Album", localPath: "/Music/First.mp3" }],
    },
}));
jest.mock("@/core/pluginManager", () => ({
    __esModule: true,
    default: { isPluginEnabled: () => true },
    useSortedPlugins: () => [{ hash: "source", name: "Music Source", supportedMethods: new Set(["search", "getTopLists"]) }],
}));
jest.mock("@/core/router", () => ({
    ROUTE_PATH: { LOCAL: "local", SEARCH_PAGE: "search-page", SETTING: "setting" },
    useNavigate: () => mockNavigate,
}));
jest.mock("@/hooks/useColors", () => () => ({
    pageBackground: "#F5F8FF", card: "#FFFFFF", primary: "#3978FF", text: "#111827", textSecondary: "#6B7280",
}));
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value }));

describe("MusicLibraryOverview", () => {
    beforeEach(() => mockNavigate.mockReset());

    it("uses rankings, local music, and online music as the library sections", () => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<MusicLibraryOverview />); 
        });

        const tabBar = renderer!.root.findByType("PillTabBar");
        expect(tabBar.props.routes).toEqual([
            { key: "ranking", title: "榜单" },
            { key: "local", title: "本地音乐" },
            { key: "online", title: "在线音乐" },
        ]);

        act(() => {
            tabBar.props.onIndexChange(1); 
        });
        act(() => {
 renderer!.root.findByProps({ accessibilityLabel: "扫描本地音乐" }).props.onPress(); 
        });
        expect(mockNavigate).toHaveBeenCalledWith("local");

        act(() => {
            tabBar.props.onIndexChange(2); 
        });
        act(() => {
 renderer!.root.findByProps({ accessibilityLabel: "搜索在线音乐" }).props.onPress(); 
        });
        expect(mockNavigate).toHaveBeenLastCalledWith("search-page");
    });
});
