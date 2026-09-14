import axios from "axios";
import { checkAppRelease, getLatestAnnouncement } from "./appRelease";

jest.mock("axios");
jest.mock("react-native-device-info", () => ({
    getVersion: () => "0.2.4",
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

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
});
