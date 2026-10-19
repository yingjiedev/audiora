import Backup from "./backup";
import { audioEffects } from "./audioEffects";
import MusicSheet from "./musicSheet";
import { createBackupPayload } from "./backupFormat";
import { defaultSettings } from "./audioEffects/model";

jest.mock("./audioEffects", () => ({ audioEffects: { backupSettings: jest.fn(), restoreSettings: jest.fn() } }));
jest.mock("./pluginManager", () => ({ __esModule: true, default: { getEnabledPlugins: () => [], installPluginFromUrl: jest.fn() } }));
jest.mock("./musicSheet", () => ({
    __esModule: true,
    default: {
        defaultSheet: { id: "favorite" }, backupSheets: () => [], resumeSheets: jest.fn().mockResolvedValue(undefined),
        favorites: { restore: jest.fn() },
    },
}));
jest.mock("./favoriteGroups", () => ({ FavoriteGroups: { get: () => ({ version: 1, groups: [], separatedKeys: [] }) } }));
jest.mock("@/constants/commonConst.ts", () => ({ ResumeMode: { Append: "append" } }));

describe("backup sound settings integration", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(audioEffects.backupSettings).mockResolvedValue(defaultSettings());
        jest.mocked(audioEffects.restoreSettings).mockResolvedValue(undefined);
    });

    it("awaits native sound settings and restores them with the shared backup", async () => {
        const raw = await Backup.backup();
        expect(JSON.parse(raw).data.audiora.audioEffects).toEqual(defaultSettings());
        await Backup.resume(raw);
        expect(audioEffects.restoreSettings).toHaveBeenCalledWith(defaultSettings());
    });

    it("leaves sound settings unchanged when restoring an older backup", async () => {
        await Backup.resume(createBackupPayload([]));
        expect(MusicSheet.resumeSheets).toHaveBeenCalled();
        expect(audioEffects.restoreSettings).not.toHaveBeenCalled();
    });

    it("rejects malformed sound data before playlist or preference mutations", async () => {
        const raw = JSON.parse(createBackupPayload([], [], 1, undefined, defaultSettings()));
        raw.data.audiora.audioEffects.preampDb = 20;
        await expect(Backup.resume(raw)).rejects.toThrow();
        expect(MusicSheet.resumeSheets).not.toHaveBeenCalled();
        expect(audioEffects.restoreSettings).not.toHaveBeenCalled();
    });

    it("reports preference failures instead of claiming a complete backup or restore", async () => {
        jest.mocked(audioEffects.backupSettings).mockRejectedValue(new Error("read failed"));
        await expect(Backup.backup()).rejects.toThrow("read failed");
        jest.mocked(audioEffects.restoreSettings).mockRejectedValue(new Error("write failed"));
        await expect(Backup.resume(createBackupPayload([], [], 1, undefined, defaultSettings()))).rejects.toThrow("write failed");
    });
});
