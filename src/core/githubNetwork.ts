const GITHUB_PROXY_PREFIXES = [
    "https://gh-proxy.org/",
    "https://ghfast.top/",
    "https://ghproxy.net/",
];

const REQUEST_TIMEOUT = 6_000;
// Race equal-sized APK samples, including connection time. Never fetch a full
// installer just to choose a route; four routes use at most 1 MiB of samples.
const DOWNLOAD_SAMPLE_BYTES = 256 * 1024;

export function getGithubResourceUrls(url: string) {
    if (!/^https:\/\/(github\.com|raw\.githubusercontent\.com)\//.test(url)) {
        return [url];
    }

    return [...GITHUB_PROXY_PREFIXES.map(prefix => `${prefix}${url}`), url];
}

export async function raceGithubResource<T>(
    url: string,
    request: (candidate: string, signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
) {
    if (signal?.aborted) {
        throw new Error("GitHub request cancelled");
    }

    const controller = new AbortController();
    let cancel: (() => void) | undefined;

    try {
        return await new Promise<T>((resolve, reject) => {
            cancel = () => reject(new Error("GitHub request cancelled"));
            signal?.addEventListener("abort", cancel);
            const candidates = getGithubResourceUrls(url);
            let pending = candidates.length;

            for (const candidate of candidates) {
                Promise.resolve()
                    .then(() => request(candidate, controller.signal))
                    .then(resolve, () => {
                        pending -= 1;
                        if (pending === 0) {
                            reject(new Error("All GitHub routes failed"));
                        }
                    });
            }
        });
    } finally {
        if (cancel) {
            signal?.removeEventListener("abort", cancel);
        }
        controller.abort();
    }
}

function probeApkDownload(url: string, signal: AbortSignal) {
    return new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let settled = false;
        let validHeaders = false;

        const finish = (error?: Error) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            signal.removeEventListener("abort", cancel);
            xhr.onreadystatechange = null;
            xhr.onload = null;
            xhr.onerror = null;
            xhr.ontimeout = null;
            xhr.onabort = null;
            xhr.onprogress = null;

            if (error) {
                xhr.abort();
                reject(error);
            } else {
                resolve(url);
            }
        };
        const cancel = () => finish(new Error("Download probe cancelled"));
        const timer = setTimeout(() => {
            finish(new Error("Download probe timed out"));
        }, REQUEST_TIMEOUT);

        if (signal.aborted) {
            cancel();
            return;
        }
        signal.addEventListener("abort", cancel);

        try {
            xhr.open("GET", url);
            xhr.responseType = "arraybuffer";
            xhr.timeout = REQUEST_TIMEOUT;
            xhr.setRequestHeader("Range", `bytes=0-${DOWNLOAD_SAMPLE_BYTES - 1}`);

            xhr.onreadystatechange = () => {
                if (xhr.readyState !== 2) {
                    return;
                }

                const range = xhr.getResponseHeader("Content-Range") ?? "";
                const match = /^bytes 0-(\d+)\/(\d+)$/i.exec(range);
                const contentLength = xhr.getResponseHeader("Content-Length");
                // Abort immediately when a server ignores Range. Otherwise a
                // quick HTTP 200 could download the entire APK in the background.
                if (xhr.status !== 206 || !match ||
                    Number(match[1]) !== DOWNLOAD_SAMPLE_BYTES - 1 ||
                    Number(match[2]) < DOWNLOAD_SAMPLE_BYTES ||
                    (contentLength !== null && Number(contentLength) !== DOWNLOAD_SAMPLE_BYTES)) {
                    finish(new Error("Invalid APK range response"));
                } else {
                    validHeaders = true;
                }
            };
            xhr.onprogress = event => {
                if (event.loaded > DOWNLOAD_SAMPLE_BYTES) {
                    finish(new Error("APK probe exceeded sample size"));
                }
            };
            xhr.onload = () => {
                if (!validHeaders || !(xhr.response instanceof ArrayBuffer)) {
                    finish(new Error("Invalid APK response"));
                    return;
                }
                const bytes = new Uint8Array(xhr.response);
                // APKs are ZIP files. Reject HTML error pages even if a proxy
                // incorrectly labels them as successful binary responses.
                if (bytes.byteLength !== DOWNLOAD_SAMPLE_BYTES ||
                    bytes[0] !== 0x50 || bytes[1] !== 0x4b ||
                    bytes[2] !== 0x03 || bytes[3] !== 0x04) {
                    finish(new Error("Invalid APK sample"));
                    return;
                }
                finish();
            };
            xhr.onerror = () => finish(new Error("APK probe failed"));
            xhr.ontimeout = () => finish(new Error("APK probe timed out"));
            xhr.onabort = cancel;
            xhr.send();
        } catch {
            finish(new Error("Unable to start APK probe"));
        }
    });
}

export async function getFastestGithubDownloadUrl(url: string, signal?: AbortSignal) {
    if (signal?.aborted) {
        throw new Error("Download selection cancelled");
    }
    // Other hosts may be download pages rather than ranged APK endpoints.
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\/.+\.apk(?:\?|$)/i.test(url)) {
        return url;
    }

    try {
        return await raceGithubResource(url, probeApkDownload, signal);
    } catch (error) {
        if (signal?.aborted) {
            throw error;
        }
        // A route can still support normal downloads when it rejects probes.
        return url;
    }
}
