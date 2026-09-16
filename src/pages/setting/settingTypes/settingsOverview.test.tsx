import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import SettingsOverview from "./settingsOverview";

const mockNavigate = jest.fn();
const mockPush = jest.fn();

jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: jest.fn() }));
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/constants/assetsConst", () => ({
    ImgAsset: {
        logo: 1,
        settingsRibbonBackground: 2,
    },
}));
jest.mock("@/core/router", () => ({
    ROUTE_PATH: {
        DOWNLOADING: "downloading",
        PERMISSIONS: "permissions",
        SETTING: "setting",
    },
    useNavigate: () => mockNavigate,
    usePush: () => mockPush,
}));
jest.mock("@/hooks/useColors", () => () => ({
    card: "#FFFFFF",
    pageBackground: "#F5F8FF",
    surface: "#FFFFFF",
}));
jest.mock("@/utils/rpx", () => {
    const rpx = (value: number) => value;
    return {
        __esModule: true,
        default: rpx,
        fontRpx: rpx,
    };
});
jest.mock("@/core/i18n", () => ({
    useI18N: () => ({
        t: (key: string, args?: Record<string, string>) =>
            key === "about.version" ? `Version ${args?.version}` : key,
        getLanguage: () => ({ locale: "zh-CN", name: "简体中文" }),
        getSupportedLanguages: () => [{ locale: "zh-CN", name: "简体中文" }],
        setLanguage: jest.fn(),
    }),
}));
jest.mock("react-native-device-info", () => ({
    getApplicationName: () => "Audiora",
    getVersion: () => "0.2.0",
}));

describe("SettingsOverview", () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockPush.mockReset();
        jest.requireMock("@/components/dialogs/useDialog").showDialog.mockReset();
    });

    it("keeps the existing settings destinations available from the overview", () => {
        let renderer: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(<SettingsOverview />);
        });

        const playback = renderer!.root.findByProps({
            accessibilityLabel: "settingsEntry.playback",
        });
        const downloads = renderer!.root.findByProps({
            accessibilityLabel: "home.downloadManagement",
        });

        act(() => {
            playback.props.onPress();
            downloads.props.onPress();
        });

        // 设置子页与首页共用同一个 route，只有 params 不同。
        // 这里必须是 push：navigate 会复用栈里已有的 setting 屏幕，
        // 导致整条设置链路只有一层，返回时直接退到入口页。
        expect(mockPush).toHaveBeenNthCalledWith(1, "setting", {
            type: "basic",
            section: "playback",
        });
        expect(mockNavigate).toHaveBeenNthCalledWith(1, "downloading");
    });

    it("pushes every sub-setting page so back returns one level", () => {
        let renderer: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(<SettingsOverview />);
        });

        act(() => {
            [
                "settingsEntry.playback",
                "sidebar.themeSettings",
                "sidebar.backupAndResume",
                "home.aboutAndUpdate",
            ].forEach(accessibilityLabel => {
                renderer!.root
                    .findByProps({ accessibilityLabel })
                    .props.onPress();
            });
        });

        expect(mockPush).toHaveBeenCalledTimes(4);
        expect(mockPush).toHaveBeenNthCalledWith(1, "setting", {
            type: "basic",
            section: "playback",
        });
        expect(mockPush).toHaveBeenNthCalledWith(2, "setting", {
            type: "theme",
            section: undefined,
        });
        expect(mockPush).toHaveBeenNthCalledWith(3, "setting", {
            type: "backup",
            section: undefined,
        });
        expect(mockPush).toHaveBeenNthCalledWith(4, "setting", {
            type: "about",
            section: undefined,
        });
        // 退化为 navigate 会让「返回上一级」直接退回入口页
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("uses the existing language picker instead of adding language state", () => {
        let renderer: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(<SettingsOverview />);
        });

        act(() => {
            renderer!.root.findByProps({
                accessibilityLabel: "sidebar.languageSettings",
            }).props.onPress();
        });

        expect(jest.requireMock("@/components/dialogs/useDialog").showDialog)
            .toHaveBeenCalledWith("RadioDialog", expect.objectContaining({
                defaultSelected: "zh-CN",
                title: "sidebar.languageSettings",
            }));
    });

    it("shows a hierarchy chevron on every navigable setting row", () => {
        let renderer: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(<SettingsOverview />);
        });

        [
            "settingsEntry.playback",
            "sidebar.languageSettings",
            "home.aboutAndUpdate",
        ].forEach(accessibilityLabel => {
            const row = renderer!.root.findByProps({ accessibilityLabel });

            expect(row.findAllByProps({ name: "chevron-right" }))
                .toHaveLength(1);
        });
    });
});
