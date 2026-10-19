import { backupToWebdav, getWebdavBackupStatus, getWebdavConfig, WEBDAV_BACKUP_FILE } from "./webdavBackup";

const mockConfig: Record<string, unknown> = {};
let mockStatus: any;
const mockBackup = jest.fn();
const mockClient = { exists: jest.fn(), createDirectory: jest.fn(), putFileContents: jest.fn() };
const mockCreateClient = jest.fn((_url: unknown, _options: unknown) => mockClient);
jest.mock("@/core/appConfig", () => ({ __esModule: true, default: { getConfig: (key: string) => mockConfig[key] } }));
jest.mock("@/core/backup", () => ({ __esModule: true, default: { backup: () => mockBackup() } }));
jest.mock("@/utils/persistStatus", () => ({
    __esModule: true,
    default: { get: () => mockStatus, set: (_key: string, value: unknown) => {
        mockStatus = value;
    } },
}));
jest.mock("webdav", () => ({ AuthType: { Password: "password" }, createClient: (url: unknown, options: unknown) => mockCreateClient(url, options) }));

describe("shared WebDAV backup", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-10-18T08:00:00Z"));
        Object.keys(mockConfig).forEach(key => delete mockConfig[key]);
        Object.assign(mockConfig, { "webdav.url": "https://dav.example/remote", "webdav.username": "user", "webdav.password": "secret" });
        mockStatus = null;
        jest.clearAllMocks();
        mockBackup.mockReset().mockResolvedValue("{\"data\":\"playlists\"}");
        mockClient.exists.mockReset().mockResolvedValue(false);
        mockClient.createDirectory.mockReset().mockResolvedValue(undefined);
        mockClient.putFileContents.mockReset().mockResolvedValue(true);
    });

    afterEach(() => jest.useRealTimers());

    it.each([undefined, "", "file:///tmp/backup", "not a URL"])("rejects invalid URL %s without making a request", async url => {
        mockConfig["webdav.url"] = url;
        expect(getWebdavConfig()).toBeNull();
        await expect(backupToWebdav()).rejects.toThrow("configuration");
        expect(mockCreateClient).not.toHaveBeenCalled();
    });

    it("requires credentials and trims URL/username without changing the password", () => {
        mockConfig["webdav.url"] = "  http://nas.local/dav  ";
        mockConfig["webdav.username"] = " user ";
        mockConfig["webdav.password"] = " secret ";
        expect(getWebdavConfig()).toEqual({ url: "http://nas.local/dav", username: "user", password: " secret " });
        mockConfig["webdav.username"] = " ";
        expect(getWebdavConfig()).toBeNull();
    });

    it("creates the directory and writes the existing backup format/path without persisting credentials", async () => {
        await backupToWebdav();
        expect(mockBackup).toHaveBeenCalledTimes(1);
        expect(mockClient.createDirectory).toHaveBeenCalledWith("/Audiora", expect.objectContaining({ signal: expect.any(Object) }));
        expect(mockClient.putFileContents).toHaveBeenCalledWith(WEBDAV_BACKUP_FILE, "{\"data\":\"playlists\"}", expect.objectContaining({ overwrite: true }));
        expect(mockStatus).toEqual({ url: "https://dav.example/remote", username: "user", lastAttemptAt: Date.now(), lastSuccessAt: Date.now(), result: "success" });
        expect(JSON.stringify(mockStatus)).not.toContain("secret");
        expect(jest.getTimerCount()).toBe(0);
    });

    it("shares concurrent manual/automatic requests and reuses an existing directory", async () => {
        mockClient.exists.mockResolvedValue(true);
        const first = backupToWebdav();
        expect(backupToWebdav()).toBe(first);
        await first;
        expect(mockBackup).toHaveBeenCalledTimes(1);
        expect(mockClient.putFileContents).toHaveBeenCalledTimes(1);
        expect(mockClient.createDirectory).not.toHaveBeenCalled();
    });

    it.each(["serialization", "async serialization", "directory", "upload", "false result"])("keeps the last success after %s failure and permits a manual retry", async failure => {
        const lastSuccessAt = Date.now() - 100_000;
        mockStatus = { url: "https://dav.example/remote", username: "user", lastSuccessAt, result: "success" };
        if (failure === "serialization") {
            mockBackup.mockImplementationOnce(() => {
                throw new Error("serialization");
            });
        } else if (failure === "async serialization") {
            mockBackup.mockRejectedValueOnce(new Error("native sound settings read failed"));
        } else if (failure === "directory") {
            mockClient.createDirectory.mockRejectedValueOnce(new Error("directory"));
        } else if (failure === "upload") {
            mockClient.putFileContents.mockRejectedValueOnce(new Error("upload"));
        } else {
            mockClient.putFileContents.mockResolvedValueOnce(false);
        }
        await expect(backupToWebdav()).rejects.toBeDefined();
        expect(mockStatus).toMatchObject({ lastSuccessAt, lastAttemptAt: Date.now(), result: "failed" });
        expect(jest.getTimerCount()).toBe(0);
        await expect(backupToWebdav()).resolves.toBeUndefined();
        expect(mockStatus.result).toBe("success");
    });

    it("aborts a stalled request, records failure and releases the upload lock", async () => {
        mockClient.exists.mockImplementationOnce((_path, { signal }) => new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("aborted")));
        }));
        const request = backupToWebdav();
        const rejection = request.catch(reason => reason);
        await jest.advanceTimersByTimeAsync(60_000);
        expect(await rejection).toEqual(new Error("aborted"));
        expect(mockStatus.result).toBe("failed");
        await expect(backupToWebdav()).resolves.toBeUndefined();
    });

    it("does not upload to an old destination after settings change during directory lookup", async () => {
        mockClient.exists.mockImplementationOnce(async () => {
            mockConfig["webdav.url"] = "https://other.example/dav";
            return true;
        });
        await expect(backupToWebdav()).rejects.toThrow("configuration changed");
        expect(mockClient.putFileContents).not.toHaveBeenCalled();
        expect(mockStatus).toBeNull();
        await backupToWebdav();
        expect(mockStatus.url).toBe("https://other.example/dav");
    });

    it("queues a new destination behind an upload already in progress and ignores its old status", async () => {
        let finishUpload!: (value: boolean) => void;
        mockClient.putFileContents.mockImplementationOnce(() => new Promise(resolve => {
            finishUpload = resolve;
        }));
        const first = backupToWebdav();
        await jest.advanceTimersByTimeAsync(0);
        mockConfig["webdav.username"] = "other-user";
        const second = backupToWebdav();
        expect(getWebdavBackupStatus()).toBeNull();
        finishUpload(true);
        await Promise.all([first, second]);
        expect(mockClient.putFileContents).toHaveBeenCalledTimes(2);
        expect(mockStatus.username).toBe("other-user");
        mockConfig["webdav.url"] = "https://other.example";
        expect(getWebdavBackupStatus()).toBeNull();
    });
});
