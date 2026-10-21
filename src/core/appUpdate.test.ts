import RNFS from "react-native-fs";
import NativeUtils from "@/native/utils";
import { getFastestGithubDownloadUrl } from "./githubNetwork";
import { downloadAppUpdate, getAppUpdateUrl } from "./appUpdate";

jest.mock("react-native-url-polyfill", () => ({ URL: require("url").URL }));
jest.mock("./githubNetwork", () => ({
    getFastestGithubDownloadUrl: jest.fn(async (url: string) => url),
}));

jest.mock("react-native-fs", () => ({
    CachesDirectoryPath: "/cache",
    mkdir: jest.fn(),
    exists: jest.fn(),
    unlink: jest.fn(),
    moveFile: jest.fn(),
    downloadFile: jest.fn(),
    stopDownload: jest.fn(),
}));
jest.mock("@/native/utils", () => ({
    __esModule: true,
    default: { logAppUpdateDiagnostic: jest.fn() },
}));

const fs = jest.mocked(RNFS);
const logDiagnostic = jest.mocked(NativeUtils.logAppUpdateDiagnostic!);
const selectDownloadUrl = jest.mocked(getFastestGithubDownloadUrl);
const release = {
    version: "0.4.0",
    changeLog: ["In-app updates"],
    download: ["https://github.com/yingjiedev/audiora/releases/download/v0.4.0/app.apk"],
};
const result = { jobId: 8, statusCode: 200, bytesWritten: 100 };

function mockDownload(response = result, contentLength = 100) {
    fs.downloadFile.mockImplementation(options => {
        options.begin?.({ jobId: 8, statusCode: response.statusCode, contentLength, headers: {} });
        options.progress?.({ jobId: 8, contentLength, bytesWritten: 50 });
        return { jobId: 8, promise: Promise.resolve(response) };
    });
}

describe("appUpdate", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        selectDownloadUrl.mockImplementation(async url => url);
        fs.mkdir.mockResolvedValue(undefined);
        fs.exists.mockResolvedValue(true);
        fs.unlink.mockResolvedValue(undefined);
        fs.moveFile.mockResolvedValue(undefined);
        mockDownload();
    });

    it("selects an HTTPS APK instead of a release page or an insecure link", () => {
        expect(getAppUpdateUrl({ ...release, download: [
            "https://github.com/yingjiedev/audiora/releases/latest",
            "http://example.com/app.apk",
            "not a URL",
            ...release.download,
        ] })).toBe(release.download[0]);
        expect(getAppUpdateUrl({ ...release, download: [] })).toBeUndefined();
        expect(() => downloadAppUpdate({ ...release, download: [] }, jest.fn())).toThrow();
    });

    it("downloads to a partial file, reports progress and publishes only a complete APK", async () => {
        const onProgress = jest.fn();
        await expect(downloadAppUpdate(release, onProgress).promise)
            .resolves.toBe("/cache/app-updates/audiora-update.apk");
        expect(fs.downloadFile).toHaveBeenCalledWith(expect.objectContaining({
            fromUrl: release.download[0],
            toFile: "/cache/app-updates/audiora-update.apk.part",
            connectionTimeout: 15_000,
            readTimeout: 30_000,
        }));
        expect(onProgress).toHaveBeenCalledWith(0.5);
        expect(fs.moveFile).toHaveBeenCalledWith(
            "/cache/app-updates/audiora-update.apk.part",
            "/cache/app-updates/audiora-update.apk",
        );
    });

    it("downloads from the accelerated route selected for the APK", async () => {
        const acceleratedUrl = `https://ghfast.top/${release.download[0]}`;
        selectDownloadUrl.mockResolvedValueOnce(acceleratedUrl);

        await downloadAppUpdate(release, jest.fn()).promise;

        expect(selectDownloadUrl).toHaveBeenCalledWith(release.download[0], expect.any(AbortSignal));
        expect(fs.downloadFile).toHaveBeenCalledWith(expect.objectContaining({ fromUrl: acceleratedUrl }));
    });

    it.each([
        { ...result, statusCode: 404 },
        { ...result, bytesWritten: 0 },
        { ...result, bytesWritten: 99 },
    ])("rejects failed, empty or incomplete responses: %j", async response => {
        mockDownload(response);
        await expect(downloadAppUpdate(release, jest.fn()).promise).rejects.toThrow("Incomplete");
        expect(fs.moveFile).not.toHaveBeenCalled();
        expect(fs.unlink).toHaveBeenCalledWith("/cache/app-updates/audiora-update.apk.part");
        const diagnostic = JSON.parse(logDiagnostic.mock.calls[logDiagnostic.mock.calls.length - 1][0]);
        expect(diagnostic).toMatchObject({
            type: "download-failure",
            statusCode: response.statusCode,
            bytesWritten: response.bytesWritten,
            contentLength: 100,
        });
    });

    it("supports downloads whose content length is unknown", async () => {
        const onProgress = jest.fn();
        mockDownload(result, -1);
        await downloadAppUpdate(release, onProgress).promise;
        expect(onProgress).toHaveBeenCalledWith(null);
        expect(fs.moveFile).toHaveBeenCalledTimes(1);
    });

    it("cleans up a network failure and allows another download", async () => {
        fs.downloadFile.mockImplementationOnce(() => ({
            jobId: 8,
            promise: Promise.reject(Object.assign(
                new Error("Network unavailable: https://example.com/app.apk?token=secret"),
                { code: "E_NETWORK" },
            )),
        }));
        await expect(downloadAppUpdate(release, jest.fn()).promise).rejects.toThrow("Network unavailable");
        const diagnostic = JSON.parse(logDiagnostic.mock.calls[0][0]);
        expect(diagnostic).toMatchObject({
            errorCode: "E_NETWORK",
            errorMessage: "Network unavailable: https://example.com/app.apk",
        });
        expect(logDiagnostic.mock.calls[0][0]).not.toContain("secret");
        await expect(downloadAppUpdate(release, jest.fn()).promise).resolves.toContain(".apk");
    });

    it("cancels before starting the native download", async () => {
        const task = downloadAppUpdate(release, jest.fn());
        task.cancel();
        await expect(task.promise).rejects.toThrow("cancelled");
        expect(fs.downloadFile).not.toHaveBeenCalled();
    });

    it("cancels route selection before starting the native download", async () => {
        selectDownloadUrl.mockImplementationOnce((_url, signal) => new Promise((_resolve, reject) => {
            signal?.addEventListener("abort", () => reject(new Error("Download selection cancelled")));
        }));
        const task = downloadAppUpdate(release, jest.fn());
        await new Promise<void>(resolve => setImmediate(resolve));
        task.cancel();
        await expect(task.promise).rejects.toThrow("cancelled");
        expect(fs.downloadFile).not.toHaveBeenCalled();
    });

    it("stops an active download and never publishes its partial APK", async () => {
        let finish!: (value: typeof result) => void;
        fs.downloadFile.mockReturnValue({
            jobId: 8,
            promise: new Promise(resolve => {
                finish = resolve;
            }),
        });
        const onProgress = jest.fn();
        const task = downloadAppUpdate(release, onProgress);
        await new Promise<void>(resolve => setImmediate(resolve));
        task.cancel();
        task.cancel();
        fs.downloadFile.mock.calls[0][0].progress?.({ jobId: 8, contentLength: 100, bytesWritten: 100 });
        finish(result);
        await expect(task.promise).rejects.toThrow("cancelled");
        expect(fs.stopDownload).toHaveBeenCalledWith(8);
        expect(fs.stopDownload).toHaveBeenCalledTimes(1);
        expect(fs.moveFile).not.toHaveBeenCalled();
        expect(onProgress).not.toHaveBeenCalled();
    });

    it("prevents concurrent downloads from replacing each other's files", async () => {
        const task = downloadAppUpdate(release, jest.fn());
        expect(() => downloadAppUpdate(release, jest.fn())).toThrow("unavailable");
        await task.promise;
    });
});
