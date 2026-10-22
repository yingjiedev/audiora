import axios from "axios";
import { checkAppRelease, getLatestAnnouncement } from "./appRelease";

jest.mock("axios");
jest.mock("react-native-device-info", () => ({
    getVersion: () => "0.2.4",
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const release = {
    version: "0.3.0",
    changeLog: ["New navigation"],
    download: ["https://example.com/app.apk"],
};

describe("appRelease", () => {
    beforeEach(() => mockedAxios.get.mockReset());

    it("detects a newer app release", async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: {
                version: "0.3.0",
                changeLog: ["New navigation"],
                download: ["https://example.com/app.apk"],
            },
        } as never);

        await expect(checkAppRelease()).resolves.toMatchObject({
            currentVersion: "0.2.4",
            hasUpdate: true,
            release: { version: "0.3.0" },
        });
    });

    it("loads release metadata through an available proxy when other routes fail", async () => {
        mockedAxios.get.mockImplementation(async url => {
            if (url.startsWith("https://ghfast.top/")) {
                return { data: release };
            }
            throw new Error("unreachable");
        });

        await expect(checkAppRelease()).resolves.toMatchObject({ hasUpdate: true, release });
        expect(mockedAxios.get).toHaveBeenCalledTimes(4);
        for (const [, config] of mockedAxios.get.mock.calls) {
            expect(config?.signal?.aborted).toBe(true);
            expect(config?.headers).toEqual({ "Cache-Control": "no-cache" });
            expect(config?.params).toEqual({ _: expect.any(Number) });
        }
    });

    it("retains an optional package size from the release manifest", async () => {
        mockedAxios.get.mockResolvedValue({ data: { ...release, downloadSize: 81788928 } });
        await expect(checkAppRelease()).resolves.toMatchObject({ release: { downloadSize: 81788928 } });
    });

    it.each([
        "<html>Error</html>",
        { ...release, version: "not-a-version" },
        { ...release, changeLog: [null] },
        { ...release, download: ["file:///app.apk"] },
        { ...release, download: undefined },
        { ...release, downloadSize: 0 },
        { ...release, downloadSize: -1 },
        { ...release, downloadSize: "78 MB" },
        { ...release, downloadSize: Infinity },
    ])("ignores malformed metadata and waits for a valid route: %p", async invalid => {
        mockedAxios.get.mockImplementation(async url => ({
            data: url.startsWith("https://ghfast.top/") ? release : invalid,
        }));

        await expect(checkAppRelease()).resolves.toMatchObject({ hasUpdate: true, release });
    });

    it("reports failure when every metadata route is invalid", async () => {
        mockedAxios.get.mockResolvedValue({ data: {} });
        await expect(checkAppRelease()).rejects.toThrow("All GitHub routes failed");
    });

    it("does not treat the current version or an older release as an update", async () => {
        for (const version of ["0.2.4", "v0.2.3"]) {
            mockedAxios.get.mockResolvedValue({ data: { ...release, version } });
            await expect(checkAppRelease()).resolves.toMatchObject({ hasUpdate: false });
        }
    });

    it("cancels an update check and aborts all pending metadata requests", async () => {
        mockedAxios.get.mockImplementation(() => new Promise(() => undefined));
        const controller = new AbortController();
        const check = checkAppRelease(controller.signal);
        await Promise.resolve();
        controller.abort();
        await expect(check).rejects.toThrow("cancelled");
        expect(mockedAxios.get.mock.calls.every(([, config]) => config?.signal?.aborted)).toBe(true);
    });

    it("returns the highest-priority compatible announcement", async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: {
                announcements: [
                    {
                        id: "expired",
                        title: "Expired",
                        content: [],
                        priority: 99,
                        expireTime: "2025-01-01T00:00:00Z",
                    },
                    {
                        id: "future-version",
                        title: "Future",
                        content: [],
                        priority: 10,
                        minVersion: "0.3.0",
                    },
                    {
                        id: "compatible",
                        title: "Compatible",
                        content: ["Hello"],
                        priority: 2,
                    },
                ],
            },
        } as never);

        await expect(
            getLatestAnnouncement("0.2.4", new Date("2026-01-01T00:00:00Z")),
        ).resolves.toMatchObject({ id: "compatible" });
    });

    it("falls back from invalid announcement responses without reporting an empty announcement", async () => {
        const announcement = { id: "notice", title: "Notice", content: ["An announcement"] };
        mockedAxios.get.mockImplementation(async url => ({
            data: url.startsWith("https://ghproxy.net/")
                ? { announcements: [announcement] }
                : { announcements: [{ title: "Incomplete" }] },
        }));
        await expect(getLatestAnnouncement()).resolves.toEqual(announcement);
    });
});
