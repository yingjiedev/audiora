import React from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import ThemeText from "@/components/base/themeText";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { downloadAppUpdate, getAppUpdateUrl } from "@/core/appUpdate";
import useColors from "@/hooks/useColors";
import NativeUtils from "@/native/utils";
import { contrastRatio } from "@/utils/colorContrast";
import { resolveThemeColors } from "@/utils/themeColors";
import { hideDialog } from "../useDialog";
import AppUpdateDialog from "./appUpdateDialog";
import Dialog from "./base";

jest.mock("@/core/appUpdate", () => ({
    downloadAppUpdate: jest.fn(),
    getAppUpdateUrl: jest.fn(),
}));
jest.mock("@/native/utils", () => ({ installAppUpdate: jest.fn() }));
jest.mock("../useDialog", () => ({ hideDialog: jest.fn() }));
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/hooks/useColors", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/utils/fileUtils", () => ({ sizeFormatter: (bytes: number) => `${bytes}B` }));
jest.mock("@/core/i18n", () => ({
    useI18N: () => ({
        t: (key: string, args?: { size?: string }) => args?.size ? `${key} ${args.size}` : key,
    }),
}));
jest.mock("./base", () => {
    const ReactModule = require("react");
    const MockDialog = (props: any) => ReactModule.createElement("Dialog", props, props.children);
    MockDialog.Content = "DialogContent";
    return { __esModule: true, default: MockDialog };
});

const release = { version: "0.4.0", changeLog: ["In-app updates"], download: ["https://example.com/app.apk"] };
const path = "/cache/app-updates/audiora-update.apk";
const download = jest.mocked(downloadAppUpdate);
const install = jest.mocked(NativeUtils.installAppUpdate);

describe("AppUpdateDialog", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    let cancel: jest.Mock;

    function action(title: string) {
        return renderer.root.findAllByType(TouchableOpacity)
            .find(item => item.findByType(ThemeText).props.children === title)?.props;
    }

    function messages() {
        return renderer.root.findAllByType(ThemeText).map(item => item.props.children);
    }

    function holdDownload() {
        let finish!: (value: string) => void;
        download.mockReturnValue({ cancel, promise: new Promise(resolve => {
            finish = resolve;
        }) });
        let pending!: Promise<void>;
        act(() => {
            pending = action("checkUpdate.download")!.onPress();
        });
        return async () => {
            await act(async () => {
                finish(path);
                await pending;
            });
        };
    }

    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(useColors).mockReturnValue(resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false));
        cancel = jest.fn();
        jest.mocked(getAppUpdateUrl).mockReturnValue(release.download[0]);
        download.mockReturnValue({ cancel, promise: Promise.resolve(path) });
        install.mockResolvedValue(undefined);
        act(() => {
            renderer = TestRenderer.create(<AppUpdateDialog release={release} />);
        });
    });

    afterEach(() => {
        act(() => {
            renderer.unmount();
        });
    });

    it("shows release notes and downloads only after confirmation", async () => {
        expect(messages()).toContain("In-app updates");
        expect(download).not.toHaveBeenCalled();
        await act(async () => {
            await action("checkUpdate.download")!.onPress();
        });
        expect(download).toHaveBeenCalledWith(release, expect.any(Function));
        expect(install).toHaveBeenCalledWith(path);
        expect(hideDialog).toHaveBeenCalledTimes(1);
    });

    it("ignores backdrop and back presses from the instant a download starts", async () => {
        const dismissFromPrompt = renderer.root.findByType(Dialog).props.onDismiss;
        let finish!: (value: string) => void;
        download.mockReturnValue({ cancel, promise: new Promise(resolve => {
            finish = resolve;
        }) });
        const start = action("checkUpdate.download")!.onPress;
        let pending!: Promise<void>;
        act(() => {
            pending = start();
            dismissFromPrompt();
        });
        expect(messages()).toContain("checkUpdate.selectingDownload");
        act(() => {
            download.mock.calls[0][1]({ bytesWritten: 50, contentLength: 100 });
            renderer.root.findByType(Dialog).props.onDismiss();
        });
        await act(async () => {
            await start();
        });
        expect(renderer.root.findByProps({ testID: "app-update-percentage" }).props.children).toBe("50%");
        expect(renderer.root.findByProps({ testID: "app-update-size" }).props.children).toBe("50B / 100B");
        expect(renderer.root.findByProps({ testID: "app-update-progress" }).props.accessibilityValue.now).toBe(50);
        expect(download).toHaveBeenCalledTimes(1);
        expect(cancel).not.toHaveBeenCalled();
        expect(hideDialog).not.toHaveBeenCalled();
        await act(async () => {
            finish(path);
            await pending;
        });
        expect(install).toHaveBeenCalledWith(path);
    });

    it("keeps downloading and showing progress while cancellation is being confirmed", async () => {
        const finish = holdDownload();
        act(() => {
            action("checkUpdate.cancelDownload")!.onPress();
            download.mock.calls[0][1]({ bytesWritten: 75, contentLength: 100 });
        });
        expect(messages()).toContain("checkUpdate.cancelDownloadHint");
        expect(messages()).toContain("75%");
        expect(cancel).not.toHaveBeenCalled();
        act(() => {
            action("checkUpdate.continueDownload")!.onPress();
        });
        expect(messages()).not.toContain("checkUpdate.cancelDownloadHint");
        expect(messages()).toContain("75%");
        expect(download).toHaveBeenCalledTimes(1);
        await finish();
        expect(install).toHaveBeenCalledWith(path);
    });

    it("stops only after explicit confirmation and never installs a cancelled download", async () => {
        const finish = holdDownload();
        act(() => {
            action("checkUpdate.cancelDownload")!.onPress();
        });
        act(() => {
            action("checkUpdate.stopDownload")!.onPress();
            renderer.unmount();
        });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(hideDialog).toHaveBeenCalledTimes(1);
        await finish();
        expect(install).not.toHaveBeenCalled();
    });

    it("reports downloaded bytes without inventing a percentage when the total is unknown", async () => {
        const finish = holdDownload();
        act(() => {
            download.mock.calls[0][1]({ bytesWritten: 50, contentLength: null });
        });
        expect(messages()).toContain("checkUpdate.downloadingTitle");
        expect(messages()).toContain("checkUpdate.downloadedSize 50B");
        expect(renderer.root.findAllByProps({ testID: "app-update-progress" })).toHaveLength(0);
        expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(1);
        await finish();
    });

    it("caps the displayed percentage at 100", async () => {
        const finish = holdDownload();
        act(() => {
            download.mock.calls[0][1]({ bytesWritten: 101, contentLength: 100 });
        });
        expect(messages()).toContain("100%");
        await finish();
    });

    it("keeps the dialog open through installer preparation", async () => {
        let finish!: () => void;
        install.mockReturnValueOnce(new Promise(resolve => {
            finish = resolve;
        }));
        let pending!: Promise<void>;
        await act(async () => {
            pending = action("checkUpdate.download")!.onPress();
            await Promise.resolve();
        });
        act(() => {
            renderer.root.findByType(Dialog).props.onDismiss();
        });
        expect(messages()).toContain("checkUpdate.preparingInstall");
        expect(renderer.root.findAllByType(TouchableOpacity)).toHaveLength(0);
        expect(hideDialog).not.toHaveBeenCalled();
        await act(async () => {
            finish();
            await pending;
        });
        expect(hideDialog).toHaveBeenCalledTimes(1);
    });

    it("shows download failures and lets the user retry", async () => {
        download.mockReturnValueOnce({ cancel, promise: Promise.reject(new Error("offline")) });
        await act(async () => {
            await action("checkUpdate.download")!.onPress();
        });
        expect(messages()).toContain("checkUpdate.error.downloadFailed");
        expect(install).not.toHaveBeenCalled();
        await act(async () => {
            await action("common.clickToRetry")!.onPress();
        });
        expect(download).toHaveBeenCalledTimes(2);
        expect(install).toHaveBeenCalledWith(path);
    });

    it.each([
        ["AppUpdatePermissionDenied", "checkUpdate.error.installPermission"],
        ["AppUpdateInstallFailed", "checkUpdate.error.installFailed"],
    ])("retries installation after %s without downloading again", async (code, message) => {
        install.mockRejectedValueOnce({ code });
        await act(async () => {
            await action("checkUpdate.download")!.onPress();
        });
        expect(messages()).toContain(message);
        expect(hideDialog).not.toHaveBeenCalled();
        await act(async () => {
            await action("checkUpdate.install")!.onPress();
        });
        expect(download).toHaveBeenCalledTimes(1);
        expect(install).toHaveBeenCalledTimes(2);
    });

    it("downloads a fresh copy when Android rejects the APK", async () => {
        install.mockRejectedValueOnce({ code: "InvalidAppUpdate" });
        await act(async () => {
            await action("checkUpdate.download")!.onPress();
        });
        expect(messages()).toContain("checkUpdate.error.invalidPackage");
        await act(async () => {
            await action("common.clickToRetry")!.onPress();
        });
        expect(download).toHaveBeenCalledTimes(2);
    });

    it("stops downloading when the dialog unmounts", async () => {
        const finish = holdDownload();
        act(() => {
            renderer.unmount();
        });
        expect(cancel).toHaveBeenCalledTimes(1);
        await finish();
        expect(install).not.toHaveBeenCalled();
    });

    it("does not offer a download when no direct APK is available", () => {
        jest.mocked(getAppUpdateUrl).mockReturnValue(undefined);
        act(() => {
            renderer.update(<AppUpdateDialog release={{ ...release, download: [] }} />);
        });
        expect(action("checkUpdate.download")).toBeUndefined();
    });

    it("allows dismissing the update prompt before downloading", () => {
        act(() => {
            renderer.root.findByType(Dialog).props.onDismiss();
        });
        expect(hideDialog).toHaveBeenCalledTimes(1);
        expect(download).not.toHaveBeenCalled();
    });

    it.each([
        ["light", lightColors, false],
        ["dark", darkColors, true],
        ["custom", { ...lightColors, primary: "#EFA322" }, false],
    ] as const)("uses semantic surfaces and readable controls with the %s theme", async (_name, palette, dark) => {
        const colors = resolveThemeColors({ ...palette, background: palette.pageBackground }, dark);
        jest.mocked(useColors).mockReturnValue(colors);
        act(() => {
            renderer.update(<AppUpdateDialog release={release} />);
        });
        const primaryButton = renderer.root.findAllByType(TouchableOpacity)
            .find(item => item.findByType(ThemeText).props.children === "checkUpdate.download")!;
        expect(StyleSheet.flatten(primaryButton.props.style).backgroundColor).toBe(colors.primary);
        expect(primaryButton.findByType(ThemeText).props.color).toBe(colors.onPrimary);
        expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.onTonal, colors.tonalSurface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.onCardInset, colors.cardInset)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.onCardInsetSecondary, colors.cardInset)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.active, colors.tonalSurface)).toBeGreaterThanOrEqual(3);
        const finish = holdDownload();
        act(() => {
            download.mock.calls[0][1]({ bytesWritten: 50, contentLength: 100 });
        });
        const track = renderer.root.findByProps({ testID: "app-update-progress" });
        expect(StyleSheet.flatten(track.props.style).backgroundColor).toBe(colors.tonalSurface);
        const fill = renderer.root.findByProps({ testID: "app-update-progress-fill" });
        expect(StyleSheet.flatten(fill.props.style)).toMatchObject({ backgroundColor: colors.active, width: "50%" });
        await finish();
    });
});
