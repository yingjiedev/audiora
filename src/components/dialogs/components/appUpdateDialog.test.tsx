import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import ThemeText from "@/components/base/themeText";
import Loading from "@/components/base/loading";
import { downloadAppUpdate, getAppUpdateUrl } from "@/core/appUpdate";
import NativeUtils from "@/native/utils";
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
jest.mock("@/components/base/loading", () => "Loading");
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value }));
jest.mock("@/core/i18n", () => ({
    useI18N: () => ({
        t: (key: string, args?: { progress?: string }) =>
            args?.progress ? `${key} ${args.progress}` : key,
    }),
}));
jest.mock("./base", () => {
    const ReactModule = require("react");
    const MockDialog = (props: any) => ReactModule.createElement("Dialog", props, props.children);
    MockDialog.Title = "DialogTitle";
    MockDialog.Content = "DialogContent";
    MockDialog.Actions = "DialogActions";
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
        return renderer.root.findByType(Dialog.Actions).props.actions
            .find((item: { title: string; show?: boolean }) => item.title === title && item.show !== false);
    }

    beforeEach(() => {
        jest.resetAllMocks();
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

    it("downloads only after confirmation and opens the system installer with the local APK", async () => {
        expect(download).not.toHaveBeenCalled();
        await act(async () => {
            await action("checkUpdate.download").onPress();
        });
        expect(download).toHaveBeenCalledWith(release, expect.any(Function));
        expect(install).toHaveBeenCalledWith(path);
        expect(hideDialog).toHaveBeenCalledTimes(1);
    });

    it("shows progress, ignores duplicate taps and cancels without opening the installer", async () => {
        let finish!: (value: string) => void;
        download.mockReturnValue({ cancel, promise: new Promise(resolve => {
            finish = resolve;
        }) });
        let pending!: Promise<void>;
        const start = action("checkUpdate.download").onPress;
        act(() => {
            pending = start();
        });
        await act(async () => {
            await start();
        });
        act(() => {
            download.mock.calls[0][1](0.5);
        });
        expect(renderer.root.findByType(Loading).props.text).toBe("checkUpdate.downloading 50%");
        expect(download).toHaveBeenCalledTimes(1);
        act(() => {
            action("common.cancel").onPress();
        });
        expect(cancel).toHaveBeenCalledTimes(1);
        await act(async () => {
            finish(path); await pending;
        });
        expect(install).not.toHaveBeenCalled();
    });

    it("shows download failures and lets the user retry", async () => {
        download.mockReturnValueOnce({ cancel, promise: Promise.reject(new Error("offline")) });
        await act(async () => {
            await action("checkUpdate.download").onPress();
        });
        expect(renderer.root.findByType(ThemeText).props.children).toBe("checkUpdate.error.downloadFailed");
        expect(install).not.toHaveBeenCalled();
        await act(async () => {
            await action("common.clickToRetry").onPress();
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
            await action("checkUpdate.download").onPress();
        });
        expect(renderer.root.findByType(ThemeText).props.children).toBe(message);
        expect(hideDialog).not.toHaveBeenCalled();
        await act(async () => {
            await action("checkUpdate.install").onPress();
        });
        expect(download).toHaveBeenCalledTimes(1);
        expect(install).toHaveBeenCalledTimes(2);
    });

    it("downloads a fresh copy when Android rejects the APK", async () => {
        install.mockRejectedValueOnce({ code: "InvalidAppUpdate" });
        await act(async () => {
            await action("checkUpdate.download").onPress();
        });
        expect(renderer.root.findByType(ThemeText).props.children).toBe("checkUpdate.error.invalidPackage");
        await act(async () => {
            await action("common.clickToRetry").onPress();
        });
        expect(download).toHaveBeenCalledTimes(2);
    });

    it("stops downloading when the dialog unmounts", async () => {
        let finish!: (value: string) => void;
        download.mockReturnValue({ cancel, promise: new Promise(resolve => {
            finish = resolve;
        }) });
        let pending!: Promise<void>;
        act(() => {
            pending = action("checkUpdate.download").onPress();
        });
        act(() => {
            renderer.unmount();
        });
        expect(cancel).toHaveBeenCalledTimes(1);
        await act(async () => {
            finish(path); await pending;
        });
        expect(install).not.toHaveBeenCalled();
    });

    it("does not offer a download when no direct APK is available", () => {
        jest.mocked(getAppUpdateUrl).mockReturnValue(undefined);
        act(() => {
            renderer.update(<AppUpdateDialog release={{ ...release, download: [] }} />);
        });
        expect(action("checkUpdate.download")).toBeUndefined();
    });
});
