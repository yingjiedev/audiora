import { startWebdavAutoBackup } from "./webdavAutoBackup";

const DAY = 86_400_000;
const mockConfig: Record<string, unknown> = {};
let mockStatus: any;
let mockAppListener: (state: string) => void;
let mockNetworkListener: (state: any) => void;
let mockConfigListener: (key: string) => void;
let mockInitiallyConnected = true;
const mockRemoveApp = jest.fn();
const mockRemoveNetwork = jest.fn();
const mockRemoveConfig = jest.fn();
const mockBackup = jest.fn();
jest.mock("@/core/appConfig", () => ({ __esModule: true, default: { getConfig: (key: string) => mockConfig[key] } }));
jest.mock("@/core/webdavBackup", () => ({
    backupToWebdav: () => mockBackup(),
    getWebdavBackupStatus: () => mockStatus,
    getWebdavConfig: () => mockConfig["webdav.url"] ? { url: mockConfig["webdav.url"] } : null,
}));
jest.mock("react-native", () => ({ AppState: {
    currentState: "active",
    addEventListener: (_event: string, listener: typeof mockAppListener) => {
        mockAppListener = listener;
        return { remove: mockRemoveApp };
    },
} }));
jest.mock("@react-native-community/netinfo", () => ({ __esModule: true, default: {
    addEventListener: (listener: typeof mockNetworkListener) => {
        mockNetworkListener = listener;
        listener({ isConnected: mockInitiallyConnected });
        return mockRemoveNetwork;
    },
} }));
jest.mock("@/utils/getOrCreateMMKV", () => ({ __esModule: true, default: () => ({
    addOnValueChangedListener: (listener: typeof mockConfigListener) => {
        mockConfigListener = listener;
        return { remove: mockRemoveConfig };
    },
}) }));

describe("WebDAV automatic backup lifecycle", () => {
    let stop: (() => void) | undefined;
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-10-18T08:00:00Z"));
        jest.clearAllMocks();
        Object.keys(mockConfig).forEach(key => delete mockConfig[key]);
        mockConfig["webdav.url"] = "https://dav.example";
        mockConfig["backup.webdavAutoEnabled"] = true;
        mockStatus = null;
        mockInitiallyConnected = true;
        require("react-native").AppState.currentState = "active";
        mockBackup.mockReset().mockImplementation(async () => {
            mockStatus = { lastSuccessAt: Date.now(), lastAttemptAt: Date.now(), result: "success" };
        });
    });
    afterEach(() => {
        stop?.();
        stop = undefined;
        jest.useRealTimers();
    });

    it("is off by default and starts immediately when enabled in settings", async () => {
        delete mockConfig["backup.webdavAutoEnabled"];
        stop = startWebdavAutoBackup();
        await jest.advanceTimersByTimeAsync(60_000);
        expect(mockBackup).not.toHaveBeenCalled();
        mockConfig["backup.webdavAutoEnabled"] = true;
        mockConfigListener("backup.webdavAutoEnabled");
        await jest.advanceTimersByTimeAsync(0);
        expect(mockBackup).toHaveBeenCalledTimes(1);
    });

    it("backs up on startup once and at the daily boundary, using persisted success after restart", async () => {
        stop = startWebdavAutoBackup();
        await jest.advanceTimersByTimeAsync(0);
        expect(mockBackup).toHaveBeenCalledTimes(1);
        stop();
        stop = startWebdavAutoBackup();
        await jest.advanceTimersByTimeAsync(0);
        expect(mockBackup).toHaveBeenCalledTimes(1);
        jest.setSystemTime(Date.now() + DAY - 60_000);
        await jest.advanceTimersByTimeAsync(59_999);
        expect(mockBackup).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(1);
        expect(mockBackup).toHaveBeenCalledTimes(2);
    });

    it("supports weekly intervals and applies a shortened interval immediately", async () => {
        mockConfig["backup.webdavAutoInterval"] = "weekly";
        mockStatus = { lastSuccessAt: Date.now() - 6 * DAY, result: "success" };
        stop = startWebdavAutoBackup();
        await jest.advanceTimersByTimeAsync(60_000);
        expect(mockBackup).not.toHaveBeenCalled();
        mockConfig["backup.webdavAutoInterval"] = "daily";
        mockConfigListener("backup.webdavAutoInterval");
        await jest.advanceTimersByTimeAsync(0);
        expect(mockBackup).toHaveBeenCalledTimes(1);
    });

    it("does not start in the background and catches up when returning to the foreground", async () => {
        require("react-native").AppState.currentState = "background";
        stop = startWebdavAutoBackup();
        await jest.advanceTimersByTimeAsync(60_000);
        expect(mockBackup).not.toHaveBeenCalled();
        mockAppListener("active");
        await jest.advanceTimersByTimeAsync(0);
        expect(mockBackup).toHaveBeenCalledTimes(1);
        mockAppListener("background");
        expect(jest.getTimerCount()).toBe(0);
        jest.setSystemTime(Date.now() + 2 * DAY);
        mockAppListener("active");
        await jest.advanceTimersByTimeAsync(0);
        expect(mockBackup).toHaveBeenCalledTimes(2);
    });

    it("waits for a connection and allows LAN servers when the public internet probe fails", async () => {
        mockInitiallyConnected = false;
        stop = startWebdavAutoBackup();
        await jest.advanceTimersByTimeAsync(60_000);
        expect(mockBackup).not.toHaveBeenCalled();
        mockNetworkListener({ isConnected: true, isInternetReachable: false });
        await jest.advanceTimersByTimeAsync(0);
        expect(mockBackup).toHaveBeenCalledTimes(1);
    });

    it("waits for configuration and batches credential edits before checking", async () => {
        delete mockConfig["webdav.url"];
        stop = startWebdavAutoBackup();
        await jest.advanceTimersByTimeAsync(60_000);
        expect(mockBackup).not.toHaveBeenCalled();
        mockConfig["webdav.url"] = "https://dav.example";
        mockConfigListener("webdav.url");
        mockConfigListener("webdav.username");
        mockConfigListener("webdav.password");
        await jest.advanceTimersByTimeAsync(0);
        expect(mockBackup).toHaveBeenCalledTimes(1);
    });

    it("honors a manual success and stops future uploads when disabled", async () => {
        mockStatus = { lastSuccessAt: Date.now(), result: "success" };
        stop = startWebdavAutoBackup();
        await jest.advanceTimersByTimeAsync(60_000);
        expect(mockBackup).not.toHaveBeenCalled();
        mockConfig["backup.webdavAutoEnabled"] = false;
        mockConfigListener("backup.webdavAutoEnabled");
        jest.setSystemTime(Date.now() + 2 * DAY);
        await jest.advanceTimersByTimeAsync(60_000);
        expect(mockBackup).not.toHaveBeenCalled();
    });

    it("persists a 15 minute retry delay across restarts and contains upload failures", async () => {
        mockBackup.mockImplementationOnce(async () => {
            mockStatus = { lastAttemptAt: Date.now(), result: "failed" };
            throw new Error("offline");
        });
        stop = startWebdavAutoBackup();
        await jest.advanceTimersByTimeAsync(0);
        expect(mockBackup).toHaveBeenCalledTimes(1);
        stop();
        stop = startWebdavAutoBackup();
        await jest.advanceTimersByTimeAsync(14 * 60_000);
        mockAppListener("active");
        mockNetworkListener({ isConnected: true });
        expect(mockBackup).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(60_000);
        expect(mockBackup).toHaveBeenCalledTimes(2);
    });

    it("ignores duplicate triggers during an upload and removes listeners/timers on cleanup", async () => {
        let finish!: () => void;
        mockBackup.mockImplementationOnce(() => new Promise<void>(resolve => {
            finish = resolve;
        }));
        stop = startWebdavAutoBackup();
        mockAppListener("active");
        mockNetworkListener({ isConnected: true });
        await jest.advanceTimersByTimeAsync(60_000);
        expect(mockBackup).toHaveBeenCalledTimes(1);
        stop();
        expect(mockRemoveApp).toHaveBeenCalledTimes(1);
        expect(mockRemoveNetwork).toHaveBeenCalledTimes(1);
        expect(mockRemoveConfig).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
        finish();
        await jest.advanceTimersByTimeAsync(60_000);
        expect(mockBackup).toHaveBeenCalledTimes(1);
        stop = undefined;
    });

    it("recovers when the system clock moves behind a stored timestamp", async () => {
        mockStatus = { lastSuccessAt: Date.now() + DAY, result: "success" };
        stop = startWebdavAutoBackup();
        await jest.advanceTimersByTimeAsync(0);
        expect(mockBackup).toHaveBeenCalledTimes(1);
    });
});
