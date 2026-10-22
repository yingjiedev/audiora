import { AppUpdateController } from "./appUpdateState";
import { downloadAppUpdate } from "./appUpdate";
import NativeUtils from "@/native/utils";

jest.mock("./appUpdate", () => ({ downloadAppUpdate: jest.fn() }));
jest.mock("@/native/utils", () => ({ installAppUpdate: jest.fn() }));

const release = { version: "0.3.3", download: ["https://example.com/update.apk"], changeLog: [] };
const apkPath = "/cache/app-updates/audiora-update.apk";
const download = jest.mocked(downloadAppUpdate);
const install = jest.mocked(NativeUtils.installAppUpdate);

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes; reject = no;
    });
    return { promise, resolve, reject };
}

describe("AppUpdateController", () => {
    let controller: AppUpdateController;
    beforeEach(() => {
        jest.resetAllMocks();
        controller = new AppUpdateController();
        install.mockResolvedValue(undefined);
        download.mockReturnValue({ promise: Promise.resolve(apkPath), cancel: jest.fn() });
    });

    it("keeps progress without any mounted UI and waits for an explicit install", async () => {
        const task = deferred<string>();
        const cancel = jest.fn();
        download.mockReturnValue({ ...task, cancel });
        const pending = controller.start(release);
        await controller.start(release);
        download.mock.calls[0][1]({ bytesWritten: 62, contentLength: 100 });
        expect(controller.state.getValue()).toMatchObject({
            phase: "downloading", progress: { bytesWritten: 62, contentLength: 100 },
        });
        task.resolve(apkPath);
        await pending;
        expect(controller.state.getValue()).toMatchObject({ phase: "ready", apkPath });
        expect(download).toHaveBeenCalledTimes(1);
        expect(cancel).not.toHaveBeenCalled();
        expect(install).not.toHaveBeenCalled();
        await controller.start(release);
        expect(download).toHaveBeenCalledTimes(1);
        await controller.install();
        expect(install).toHaveBeenCalledWith(apkPath);
        expect(controller.state.getValue().phase).toBe("ready");
    });

    it("waits for cancelled file cleanup and ignores late progress and completion", async () => {
        const task = deferred<string>();
        const cancel = jest.fn();
        download.mockReturnValue({ ...task, cancel });
        const pending = controller.start(release);
        controller.cancel();
        controller.cancel();
        await controller.start(release);
        download.mock.calls[0][1]({ bytesWritten: 100, contentLength: 100 });
        expect(controller.state.getValue().phase).toBe("cancelling");
        expect(download).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledTimes(1);
        task.resolve(apkPath);
        await pending;
        expect(controller.state.getValue()).toEqual({ phase: "idle" });
        expect(install).not.toHaveBeenCalled();
        download.mockReturnValue({ promise: Promise.resolve(apkPath), cancel });
        await controller.start(release);
        expect(controller.state.getValue().phase).toBe("ready");
    });

    it("returns to idle after cancellation rejects", async () => {
        const task = deferred<string>();
        download.mockReturnValue({ ...task, cancel: jest.fn() });
        const pending = controller.start(release);
        controller.cancel();
        task.reject(new Error("Cancelled"));
        await pending;
        expect(controller.state.getValue().phase).toBe("idle");
    });

    it.each(["sync", "async"])("allows retry after a %s download failure", async kind => {
        if (kind === "sync") {
            download.mockImplementationOnce(() => {
                throw new Error("Unavailable");
            });
        } else {
            download.mockReturnValueOnce({ promise: Promise.reject(new Error("Offline")), cancel: jest.fn() });
        }
        await controller.start(release);
        expect(controller.state.getValue()).toMatchObject({ phase: "downloadFailed", apkPath: null });
        await controller.start(release);
        expect(controller.state.getValue().phase).toBe("ready");
        expect(install).not.toHaveBeenCalled();
    });

    it.each([
        ["AppUpdatePermissionDenied", "permissionDenied"],
        ["AppUpdateInstallFailed", "installFailed"],
    ])("retries %s with the same APK", async (code, phase) => {
        await controller.start(release);
        install.mockRejectedValueOnce({ code });
        await controller.install();
        expect(controller.state.getValue()).toMatchObject({ phase, apkPath });
        await controller.install();
        expect(install).toHaveBeenCalledTimes(2);
        expect(download).toHaveBeenCalledTimes(1);
        expect(controller.state.getValue().phase).toBe("ready");
    });

    it("requires a new download for an invalid or evicted APK", async () => {
        await controller.start(release);
        install.mockRejectedValueOnce({ code: "InvalidAppUpdate" });
        await controller.install();
        expect(controller.state.getValue()).toMatchObject({ phase: "invalidPackage", apkPath: null });
        await controller.install();
        expect(install).toHaveBeenCalledTimes(1);
        await controller.start(release);
        expect(download).toHaveBeenCalledTimes(2);
    });

    it("guards duplicate installs and downloads while permission is pending", async () => {
        await controller.start(release);
        const result = deferred<void>();
        install.mockReturnValueOnce(result.promise);
        const pending = controller.install();
        await controller.install();
        await controller.start({ ...release, version: "0.3.4" });
        expect(controller.state.getValue().phase).toBe("installing");
        expect(install).toHaveBeenCalledTimes(1);
        expect(download).toHaveBeenCalledTimes(1);
        result.resolve();
        await pending;
    });
});
