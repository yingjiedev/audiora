import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Linking, Platform } from "react-native";
import ThemeText from "@/components/base/themeText";
import AboutSetting from "./aboutSetting";

jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/linkText", () => "LinkText");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: jest.fn() }));
jest.mock("@/core/appRelease", () => ({
    checkAppRelease: jest.fn(),
    getLatestAnnouncement: jest.fn(),
}));
jest.mock("@/core/githubNetwork", () => ({
    getFastestGithubDownloadUrl: jest.fn(),
}));
jest.mock("@/utils/toast", () => ({ success: jest.fn(), warn: jest.fn() }));
jest.mock("@/constants/assetsConst", () => ({
    ImgAsset: { logo: 1 },
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
jest.mock("@/hooks/useColors", () => () => ({
    card: "white",
    surface: "white",
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
    const downloadUrl = "https://github.com/yingjiedev/audiora/releases/download/v0.3.0/Audiora.apk";
    const acceleratedUrl = `https://ghfast.top/${downloadUrl}`;
    const releaseResult = {
        currentVersion: "0.1.0",
        hasUpdate: true,
        release: {
            version: "0.3.0",
            changeLog: ["A useful change"],
            download: [downloadUrl],
        },
    };

    beforeEach(() => {
        jest.requireMock("@/components/dialogs/useDialog").showDialog.mockReset();
        jest.requireMock("@/core/appRelease").checkAppRelease.mockReset();
        jest.requireMock("@/core/appRelease").getLatestAnnouncement.mockReset();
        jest.requireMock("@/core/githubNetwork").getFastestGithubDownloadUrl
            .mockReset().mockResolvedValue(acceleratedUrl);
        jest.requireMock("@/utils/toast").success.mockReset();
        jest.requireMock("@/utils/toast").warn.mockReset();
        jest.spyOn(Linking, "openURL").mockReset().mockResolvedValue(undefined);
    });

    afterEach(() => jest.restoreAllMocks());

    async function showUpdate() {
        jest.requireMock("@/core/appRelease").checkAppRelease.mockResolvedValue(releaseResult);
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<AboutSetting />);
        });
        await act(async () => {
            await renderer.root.findByProps({ accessibilityLabel: "sidebar.checkUpdate" }).props.onPress();
        });
        const onDownload = jest.requireMock("@/components/dialogs/useDialog")
            .showDialog.mock.calls[0][1].onOk as () => void;
        return { renderer, onDownload };
    }

    it("shows the project scope and responsibility boundary", () => {
        let renderer: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(<AboutSetting />);
        });

        const text = renderer!.root
            .findAllByType(ThemeText)
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

    it("opens the in-app updater on Android", async () => {
        jest.replaceProperty(Platform, "OS", "android");
        jest.requireMock("@/core/appRelease").checkAppRelease.mockResolvedValue(releaseResult);
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<AboutSetting />);
        });

        await act(async () => {
            await renderer.root.findByProps({ accessibilityLabel: "sidebar.checkUpdate" }).props.onPress();
        });

        expect(jest.requireMock("@/components/dialogs/useDialog").showDialog)
            .toHaveBeenCalledWith("AppUpdateDialog", { release: releaseResult.release });
    });

    it("opens the automatically selected route when the user confirms the update", async () => {
        const { onDownload } = await showUpdate();
        await act(async () => {
            onDownload();
        });

        expect(jest.requireMock("@/core/githubNetwork").getFastestGithubDownloadUrl)
            .toHaveBeenCalledWith(downloadUrl, expect.any(AbortSignal));
        expect(Linking.openURL).toHaveBeenCalledWith(acceleratedUrl);
        expect(jest.requireMock("@/utils/toast").warn).not.toHaveBeenCalled();
    });

    it("shows selection progress and prevents duplicate probes", async () => {
        let finishSelection!: (url: string) => void;
        jest.requireMock("@/core/githubNetwork").getFastestGithubDownloadUrl
            .mockImplementation(() => new Promise(resolve => {
                finishSelection = resolve;
            }));
        const { renderer, onDownload } = await showUpdate();
        act(() => {
            onDownload();
        });

        const row = renderer.root.findByProps({ accessibilityLabel: "sidebar.checkUpdate" });
        expect(row.props.disabled).toBe(true);
        expect(row.props.accessibilityState.busy).toBe(true);
        expect(row.findAllByType(ThemeText).map(node => node.props.children))
            .toContain("checkUpdate.selectingDownload");
        act(() => {
            onDownload();
        });
        expect(jest.requireMock("@/core/githubNetwork").getFastestGithubDownloadUrl)
            .toHaveBeenCalledTimes(1);

        await act(async () => {
            finishSelection(acceleratedUrl);
        });
        expect(row.props.disabled).toBe(false);
    });

    it("tries the original URL when the selected route cannot be opened", async () => {
        jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error("Cannot open route"));
        const { onDownload } = await showUpdate();
        await act(async () => {
            onDownload();
        });

        expect(Linking.openURL).toHaveBeenNthCalledWith(1, acceleratedUrl);
        expect(Linking.openURL).toHaveBeenNthCalledWith(2, downloadUrl);
        expect(jest.requireMock("@/utils/toast").warn).not.toHaveBeenCalled();
    });

    it("reports an actionable error if neither download URL can be opened", async () => {
        jest.mocked(Linking.openURL).mockRejectedValue(new Error("No browser available"));
        const { renderer, onDownload } = await showUpdate();
        await act(async () => {
            onDownload();
        });

        expect(jest.requireMock("@/utils/toast").warn)
            .toHaveBeenCalledWith("checkUpdate.error.downloadFailed");
        expect(renderer.root.findByProps({ accessibilityLabel: "sidebar.checkUpdate" }).props.disabled)
            .toBe(false);
    });

    it("aborts a pending selection on unmount without opening a browser", async () => {
        let finishSelection!: (url: string) => void;
        const selector = jest.requireMock("@/core/githubNetwork").getFastestGithubDownloadUrl;
        selector.mockImplementation(() => new Promise(resolve => {
            finishSelection = resolve;
        }));
        const { renderer, onDownload } = await showUpdate();
        act(() => {
            onDownload();
        });
        const signal = selector.mock.calls[0][1] as AbortSignal;
        act(() => {
            renderer.unmount();
        });
        expect(signal.aborted).toBe(true);

        await act(async () => {
            finishSelection(acceleratedUrl);
        });
        expect(Linking.openURL).not.toHaveBeenCalled();
        expect(jest.requireMock("@/utils/toast").warn).not.toHaveBeenCalled();
    });

    it("aborts an update check and suppresses late dialogs when leaving the page", async () => {
        let finishCheck!: (value: typeof releaseResult) => void;
        const checkRelease = jest.requireMock("@/core/appRelease").checkAppRelease;
        checkRelease.mockImplementation(() => new Promise(resolve => {
            finishCheck = resolve;
        }));
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<AboutSetting />);
        });
        let check!: Promise<void>;
        act(() => {
            const row = renderer.root.findByProps({ accessibilityLabel: "sidebar.checkUpdate" });
            check = row.props.onPress();
            row.props.onPress();
        });
        expect(checkRelease).toHaveBeenCalledTimes(1);
        const signal = checkRelease.mock.calls[0][0] as AbortSignal;
        act(() => {
            renderer.unmount();
        });
        expect(signal.aborted).toBe(true);

        await act(async () => {
            finishCheck(releaseResult);
            await check;
        });
        expect(jest.requireMock("@/components/dialogs/useDialog").showDialog).not.toHaveBeenCalled();
    });
});
