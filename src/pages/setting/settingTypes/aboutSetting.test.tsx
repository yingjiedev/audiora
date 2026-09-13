import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AboutSetting from "./aboutSetting";

jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/linkText", () => "LinkText");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: jest.fn() }));
jest.mock("@/core/appRelease", () => ({
    checkAppRelease: jest.fn(),
    getLatestAnnouncement: jest.fn(),
}));
jest.mock("@/utils/toast", () => ({ success: jest.fn(), warn: jest.fn() }));
jest.mock("@/constants/assetsConst", () => ({
    ImgAsset: { author: 1 },
}));
jest.mock("@/constants/buildInfo", () => ({
    buildTime: "2026-08-31",
}));
jest.mock("@/core/i18n", () => ({
    useI18N: () => ({
        t: (key: string, args?: Record<string, string>) => {
            if (key === "about.version") {
                return `Version ${args?.version}`;
            }
            if (key === "about.buildTime") {
                return `Build time: ${args?.buildTime}`;
            }
            return key;
        },
    }),
}));
jest.mock("@/core/theme", () => ({
    useTheme: () => ({ colors: { card: "white", primary: "blue" } }),
}));
jest.mock("@/hooks/useHasCustomBackground", () => () => false);
jest.mock("@/hooks/useOrientation", () => () => "vertical");
jest.mock("@/utils/rpx", () => {
    const rpx = (value: number) => value;
    return {
        __esModule: true,
        default: rpx,
        fontRpx: rpx,
    };
});
jest.mock("react-native-device-info", () => ({
    getVersion: () => "0.1.0",
}));

describe("AboutSetting", () => {
    beforeEach(() => {
        jest.requireMock("@/components/dialogs/useDialog").showDialog.mockReset();
        jest.requireMock("@/core/appRelease").checkAppRelease.mockReset();
        jest.requireMock("@/core/appRelease").getLatestAnnouncement.mockReset();
        jest.requireMock("@/utils/toast").success.mockReset();
        jest.requireMock("@/utils/toast").warn.mockReset();
    });

    it("shows the project scope and responsibility boundary", () => {
        let renderer: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(<AboutSetting />);
        });

        const text = renderer!.root
            .findAllByType("ThemeText")
            .map(node => node.props.children)
            .filter(Boolean);

        expect(text).toEqual(expect.arrayContaining([
            "Audiora",
            "Version 0.1.0",
            "Build time: 2026-08-31",
            "about.positioningTitle",
            "about.positioningContent",
            "about.responsibilityTitle",
            "about.responsibilityContent",
        ]));
    });

    it("shows release details when a newer version is available", async () => {
        jest.requireMock("@/core/appRelease").checkAppRelease.mockResolvedValue({
            currentVersion: "0.1.0",
            hasUpdate: true,
            release: {
                version: "0.2.0",
                changeLog: ["A useful change"],
                download: ["https://example.com/audiora.apk"],
            },
        });
        let renderer: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(<AboutSetting />);
        });
        await act(async () => {
            await renderer!.root.findByProps({
                accessibilityLabel: "sidebar.checkUpdate",
            }).props.onPress();
        });

        expect(jest.requireMock("@/components/dialogs/useDialog").showDialog)
            .toHaveBeenCalledWith("SimpleDialog", expect.objectContaining({
                title: "checkUpdate.newVersion",
                okText: "checkUpdate.download",
                onOk: expect.any(Function),
            }));
    });
});
