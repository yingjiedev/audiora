import {
    getFastestGithubDownloadUrl,
    getGithubResourceUrls,
    raceGithubResource,
} from "./githubNetwork";

const APK_URL = "https://github.com/yingjiedev/audiora/releases/download/v0.3.0/Audiora.apk";
const SAMPLE_BYTES = 256 * 1024;
const requests: MockXhr[] = [];

function apkSample(size = SAMPLE_BYTES) {
    const bytes = new Uint8Array(size);
    bytes.set([0x50, 0x4b, 0x03, 0x04]);
    return bytes.buffer;
}

class MockXhr {
    url = "";
    status = 0;
    readyState = 0;
    responseType = "";
    response: ArrayBuffer | null = null;
    timeout = 0;
    aborted = false;
    requestHeaders: Record<string, string> = {};
    responseHeaders: Record<string, string> = {};
    onreadystatechange: (() => void) | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    onabort: (() => void) | null = null;
    onprogress: ((event: { loaded: number }) => void) | null = null;

    constructor() {
        requests.push(this);
    }

    open = jest.fn((_method: string, url: string) => {
        this.url = url;
    });
    send = jest.fn();
    setRequestHeader = (name: string, value: string) => {
        this.requestHeaders[name] = value;
    };
    getResponseHeader = (name: string) => this.responseHeaders[name.toLowerCase()] ?? null;
    abort = jest.fn(() => {
        this.aborted = true;
        this.onabort?.();
    });

    receiveHeaders(status = 206, range = `bytes 0-${SAMPLE_BYTES - 1}/52596488`) {
        this.status = status;
        this.responseHeaders = { "content-range": range, "content-length": `${SAMPLE_BYTES}` };
        this.readyState = 2;
        this.onreadystatechange?.();
    }

    complete(body = apkSample()) {
        if (this.readyState !== 2) {
            this.receiveHeaders();
        }
        if (!this.aborted) {
            this.response = body;
            this.readyState = 4;
            this.onload?.();
        }
    }
}

describe("GitHub download routing", () => {
    const originalXhr = global.XMLHttpRequest;

    beforeEach(() => {
        jest.useFakeTimers();
        requests.length = 0;
        global.XMLHttpRequest = MockXhr as unknown as typeof XMLHttpRequest;
    });

    afterEach(() => {
        global.XMLHttpRequest = originalXhr;
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("adds three routes for the exact same resource and retains the original", () => {
        expect(getGithubResourceUrls(APK_URL)).toEqual([
            `https://gh-proxy.org/${APK_URL}`,
            `https://ghfast.top/${APK_URL}`,
            `https://ghproxy.net/${APK_URL}`,
            APK_URL,
        ]);
        const raw = "https://raw.githubusercontent.com/owner/repo/master/version.json";
        expect(getGithubResourceUrls(raw)).toHaveLength(4);
    });

    it.each([
        "https://example.com/app.apk",
        "https://gh-proxy.org/https://github.com/owner/repo/file.apk",
        "https://github.com.example.com/file.apk",
        "https://github.com@evil.example/file.apk",
        "http://github.com/owner/repo/file.apk",
    ])("does not proxy other hosts or nest proxy URLs: %s", url => {
        expect(getGithubResourceUrls(url)).toEqual([url]);
    });

    it("chooses the first complete APK sample, rather than the first response headers", async () => {
        const selected = getFastestGithubDownloadUrl(APK_URL);
        await Promise.resolve();

        expect(requests).toHaveLength(4);
        expect(requests.every(xhr => xhr.requestHeaders.Range === "bytes=0-262143")).toBe(true);
        requests[0].receiveHeaders();
        requests[1].complete();

        await expect(selected).resolves.toBe(`https://ghfast.top/${APK_URL}`);
        expect(requests[0].abort).toHaveBeenCalledTimes(1);
        expect(requests[2].abort).toHaveBeenCalledTimes(1);
        expect(requests[3].abort).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
    });

    it("allows GitHub direct downloads to win on networks where they are fastest", async () => {
        const selected = getFastestGithubDownloadUrl(APK_URL);
        await Promise.resolve();
        requests[3].complete();
        await expect(selected).resolves.toBe(APK_URL);
        expect(requests.slice(0, 3).every(xhr => xhr.aborted)).toBe(true);
    });

    it("aborts a full-body HTTP 200 immediately and ignores failed routes", async () => {
        const selected = getFastestGithubDownloadUrl(APK_URL);
        await Promise.resolve();
        requests[0].receiveHeaders(200);
        requests[1].onerror?.();
        requests[2].receiveHeaders(403);
        expect(requests.slice(0, 3).every(xhr => xhr.aborted)).toBe(true);
        requests[3].complete();
        await expect(selected).resolves.toBe(APK_URL);
    });

    it("rejects HTML, truncated samples and incorrect byte ranges", async () => {
        const selected = getFastestGithubDownloadUrl(APK_URL);
        await Promise.resolve();
        requests[0].complete(new Uint8Array(SAMPLE_BYTES).fill(0x3c).buffer);
        requests[1].complete(apkSample(1024));
        requests[2].receiveHeaders(206, "bytes 0-1023/52596488");
        requests[3].complete();
        await expect(selected).resolves.toBe(APK_URL);
    });

    it("stops a server sending more than the requested sample", async () => {
        const selected = getFastestGithubDownloadUrl(APK_URL);
        await Promise.resolve();
        requests[0].receiveHeaders();
        requests[0].onprogress?.({ loaded: SAMPLE_BYTES + 1 });
        expect(requests[0].aborted).toBe(true);
        requests[1].complete();
        await expect(selected).resolves.toBe(`https://ghfast.top/${APK_URL}`);
    });

    it("falls back to the original URL after all probes time out", async () => {
        const selected = getFastestGithubDownloadUrl(APK_URL);
        await jest.advanceTimersByTimeAsync(6_000);
        await expect(selected).resolves.toBe(APK_URL);
        expect(requests.every(xhr => xhr.aborted)).toBe(true);
        expect(jest.getTimerCount()).toBe(0);
    });

    it("cancels every probe without falling back to a download", async () => {
        const controller = new AbortController();
        const selected = getFastestGithubDownloadUrl(APK_URL, controller.signal);
        await Promise.resolve();
        controller.abort();
        await expect(selected).rejects.toThrow("cancelled");
        expect(requests.every(xhr => xhr.aborted)).toBe(true);
        expect(jest.getTimerCount()).toBe(0);
    });

    it("does not send requests for an already cancelled selection", async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(getFastestGithubDownloadUrl(APK_URL, controller.signal))
            .rejects.toThrow("cancelled");
        expect(requests).toHaveLength(0);
    });

    it("leaves non-GitHub download pages unchanged", async () => {
        await expect(getFastestGithubDownloadUrl("https://www.pgyer.com/example"))
            .resolves.toBe("https://www.pgyer.com/example");
        expect(requests).toHaveLength(0);
    });

    it("rejects a resource request when every route fails", async () => {
        const request = jest.fn(async () => {
            throw new Error("offline");
        });
        await expect(raceGithubResource(APK_URL, request)).rejects.toThrow("All GitHub routes failed");
        expect(request).toHaveBeenCalledTimes(4);
    });
});
