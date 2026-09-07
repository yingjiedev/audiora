import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import MyMusicOverview from "./MyMusicOverview";

const mockNavigate = jest.fn();

jest.mock("@/components/base/fastImage", () => "FastImage");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/panels/usePanel", () => ({
    showPanel: jest.fn(),
}));
jest.mock("@/constants/assetsConst", () => ({
    ImgAsset: {
        albumDefault: 1,
        logo: 2,
    },
}));
jest.mock("@/core/i18n", () => ({
    useI18N: () => ({
        t: (key: string, args?: Record<string, number>) =>
            key === "home.songCount" ? `${args?.count ?? 0} songs` : key,
    }),
}));
jest.mock("@/core/musicHistory", () => ({
    useMusicHistory: () => [{ id: "history-1" }, { id: "history-2" }],
}));
jest.mock("@/core/musicSheet", () => ({
    __esModule: true,
    default: {
        defaultSheet: { id: "favorite" },
    },
    useSheetsBase: () => [
        {
            id: "favorite",
            title: "Favorites",
            worksNum: 3,
            platform: "local",
        },
        {
            id: "road-trip",
            title: "Road Trip",
            worksNum: 8,
            platform: "local",
        },
    ],
    useStarredSheets: () => [{ id: "starred", platform: "remote" }],
}));
jest.mock("@/core/localMusicSheet", () => ({
    __esModule: true,
    default: {
        useMusicList: () => [{ id: "local-1" }],
    },
}));
jest.mock("@/core/router", () => ({
    ROUTE_PATH: {
        HISTORY: "history",
        LOCAL: "local",
        LOCAL_SHEET_DETAIL: "local-sheet-detail",
        SEARCH_PAGE: "search-page",
        SETTING: "setting",
        SHEET_BROWSER: "sheet-browser",
    },
    useNavigate: () => mockNavigate,
}));
jest.mock("@/hooks/useColors", () => () => ({
    pageBackground: "#F5F8FF",
    card: "#FFFFFF",
    primary: "#3978FF",
    text: "#111827",
    textSecondary: "#6B7280",
}));
jest.mock("@/utils/rpx", () => ({
    __esModule: true,
    default: (value: number) => value,
}));

describe("MyMusicOverview", () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        jest.requireMock("@/components/panels/usePanel").showPanel.mockReset();
    });

    it("keeps music and settings destinations together on the My page", () => {
        let renderer: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(<MyMusicOverview />);
        });

        const settingsButtons = renderer!.root.findAllByProps({
            accessibilityLabel: "common.setting",
        });
        const favorite = renderer!.root.findByProps({
            accessibilityLabel: "home.favoriteSheet",
        });
        const localMusic = renderer!.root.findByProps({
            accessibilityLabel: "home.localMusic",
        });

        act(() => {
            settingsButtons[0].props.onPress();
            favorite.props.onPress();
            localMusic.props.onPress();
        });

        expect(mockNavigate).toHaveBeenNthCalledWith(1, "setting", {
            type: "overview",
        });
        expect(mockNavigate).toHaveBeenNthCalledWith(2, "local-sheet-detail", {
            id: "favorite",
        });
        expect(mockNavigate).toHaveBeenNthCalledWith(3, "local");
    });

    it("keeps playlist management actions available", () => {
        let renderer: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(<MyMusicOverview />);
        });

        act(() => {
            renderer!.root.findByProps({
                accessibilityLabel: "home.playById.a11y",
            }).props.onPress();
            renderer!.root.findByProps({
                accessibilityLabel: "home.newPlaylist.a11y",
            }).props.onPress();
        });

        expect(
            jest.requireMock("@/components/panels/usePanel").showPanel,
        ).toHaveBeenNthCalledWith(1, "PlayById");
        expect(
            jest.requireMock("@/components/panels/usePanel").showPanel,
        ).toHaveBeenNthCalledWith(2, "CreateMusicSheet");
    });
});
