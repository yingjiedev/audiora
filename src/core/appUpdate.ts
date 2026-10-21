import RNFS from "react-native-fs";
import { URL } from "react-native-url-polyfill";
import NativeUtils from "@/native/utils";
import type { IAppRelease } from "./appRelease";
import { getFastestGithubDownloadUrl } from "./githubNetwork";

const UPDATE_DIRECTORY = `${RNFS.CachesDirectoryPath}/app-updates`;
let downloadInProgress = false;

function redactUrls(value: string) {
    return value.replace(/https?:\/\/[^\s"'<>]+/gi, candidate => {
        try {
            const url = new URL(candidate);
            return `${url.protocol}//${url.host}${url.pathname}`;
        } catch {
            return "[URL redacted]";
        }
    });
}

function logDownloadFailure(
    release: IAppRelease,
    error: unknown,
    response: { statusCode?: number; bytesWritten?: number },
    contentLength: number,
) {
    const errorValue = error as { name?: unknown; code?: unknown; message?: unknown } | null;
    const errorMessage = typeof errorValue?.message === "string"
        ? errorValue.message
        : error instanceof Error ? error.message : String(error);

    try {
        NativeUtils?.logAppUpdateDiagnostic?.(JSON.stringify({
            type: "download-failure",
            version: release.version,
            statusCode: response.statusCode,
            bytesWritten: response.bytesWritten,
            contentLength,
            errorName: typeof errorValue?.name === "string" ? errorValue.name : "Error",
            errorCode: errorValue?.code == null ? undefined : String(errorValue.code),
            errorMessage: redactUrls(errorMessage).slice(0, 1000),
        }));
    } catch {
        // Diagnostics must never replace the original download failure.
    }
}

export function getAppUpdateUrl(release: IAppRelease) {
    return release.download.find(value => {
        try {
            const url = new URL(value);
            return url.protocol === "https:" && /\.apk$/i.test(url.pathname);
        } catch {
            return false;
        }
    });
}

export function downloadAppUpdate(
    release: IAppRelease,
    onProgress: (progress: number | null) => void,
) {
    const url = getAppUpdateUrl(release);
    if (!url || downloadInProgress) {
        const error = new Error("App update download is unavailable");
        logDownloadFailure(release, error, {}, 0);
        throw error;
    }

    downloadInProgress = true;
    let cancelled = false;
    let jobId: number | undefined;
    const downloadController = new AbortController();
    let contentLength = 0;
    let statusCode: number | undefined;
    let bytesWritten: number | undefined;
    const apkPath = `${UPDATE_DIRECTORY}/audiora-update.apk`;
    const partialPath = `${apkPath}.part`;

    function checkCancelled() {
        if (cancelled) {
            throw new Error("App update download cancelled");
        }
    }

    async function removeFile(path: string) {
        if (await RNFS.exists(path)) {
            await RNFS.unlink(path);
        }
    }

    const promise = (async () => {
        try {
            await RNFS.mkdir(UPDATE_DIRECTORY);
            await removeFile(partialPath);
            await removeFile(apkPath);
            checkCancelled();
            const downloadUrl = await getFastestGithubDownloadUrl(url, downloadController.signal);
            checkCancelled();
            const download = RNFS.downloadFile({
                fromUrl: downloadUrl,
                toFile: partialPath,
                connectionTimeout: 15_000,
                readTimeout: 30_000,
                progressInterval: 300,
                begin: response => {
                    contentLength = response.contentLength;
                },
                progress: progress => {
                    if (!cancelled) {
                        onProgress(progress.contentLength > 0
                            ? Math.min(progress.bytesWritten / progress.contentLength, 1)
                            : null);
                    }
                },
            });
            jobId = download.jobId;
            const result = await download.promise;
            statusCode = result.statusCode;
            bytesWritten = result.bytesWritten;
            checkCancelled();
            if (result.statusCode !== 200 || result.bytesWritten <= 0 ||
                (contentLength > 0 && result.bytesWritten !== contentLength)) {
                throw new Error("Incomplete app update download");
            }
            await RNFS.moveFile(partialPath, apkPath);
            checkCancelled();
            return apkPath;
        } catch (error) {
            await Promise.allSettled([
                removeFile(partialPath),
                removeFile(apkPath),
            ]);
            logDownloadFailure(release, error, { statusCode, bytesWritten }, contentLength);
            throw error;
        } finally {
            downloadInProgress = false;
        }
    })();

    return {
        promise,
        cancel() {
            if (cancelled) {
                return;
            }
            cancelled = true;
            downloadController.abort();
            if (jobId !== undefined) {
                RNFS.stopDownload(jobId);
            }
        },
    };
}
