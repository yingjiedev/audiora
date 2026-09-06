import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import SettingsOverview from "./settingsOverview";

const mockNavigate = jest.fn();

jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: jest.fn() }));
jest.mock("@/constants/assetsConst", () => ({
    ImgAsset: {
        logo: 1,
        settingsRibbonBackground: 2,
    },
}));
jest.mock("@/core/router", () => ({
    ROUTE_PATH: {
        LOCAL: "local",
        PERMISSIONS: "permissions",
        SETTING: "setting",
    },
    useNavigate: () => mockNavigate,
}));
jest.mock("@/hooks/useColors", () => () => ({
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
        jest.requireMock("@/components/dialogs/useDialog").showDialog.mockReset();
    });

    it("keeps the existing settings destinations available from the overview", () => {
        let renderer: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(<SettingsOverview />);
        });

        const basicSettings = renderer!.root.findByProps({
            accessibilityLabel: "sidebar.basicSettings",
        });
        const localMusic = renderer!.root.findByProps({
            accessibilityLabel: "home.scanLocal",
        });

        act(() => {
            basicSettings.props.onPress();
            localMusic.props.onPress();
        });

        expect(mockNavigate).toHaveBeenNthCalledWith(1, "setting", {
            type: "basic",
        });
        expect(mockNavigate).toHaveBeenNthCalledWith(2, "local");
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
});
