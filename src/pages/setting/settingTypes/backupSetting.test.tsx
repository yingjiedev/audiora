import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import BackupSetting from "./backupSetting";
import SettingRow from "../components/settingRow";
import { showPanel } from "@/components/panels/usePanel";

const mockConfig: Record<string, unknown> = {};
let mockStatus: any;
let mockConfigured = true;
const mockSetConfig = jest.fn();
const mockUpload = jest.fn();
const mockResume = jest.fn();
const mockToast = { success: jest.fn(), warn: jest.fn() };
const mockShowDialog = jest.fn();
const mockClient = { exists: jest.fn(), getFileContents: jest.fn() };
jest.mock("@/core/backup", () => ({ __esModule: true, default: { resume: (...args: unknown[]) => mockResume(...args) } }));
jest.mock("@/core/router", () => ({ ROUTE_PATH: {}, useNavigate: () => jest.fn() }));
jest.mock("@/core/appConfig", () => ({
    __esModule: true,
    default: { getConfig: (key: string) => mockConfig[key], setConfig: (...args: unknown[]) => mockSetConfig(...args) },
    useAppConfig: (key: string) => mockConfig[key],
}));
jest.mock("@/core/webdavBackup", () => ({
    backupToWebdav: () => mockUpload(),
    getWebdavConfig: () => mockConfigured ? { url: "https://dav.example", username: "user", password: "secret" } : null,
    getWebdavBackupStatus: () => mockStatus,
    WEBDAV_BACKUP_FILE: "/Audiora/AudioraBackup.json",
}));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string, args?: any) => args ? `${key}:${args.time ?? args.reason}` : key }) }));
jest.mock("@/utils/persistStatus", () => ({ __esModule: true, default: { useValue: jest.fn() } }));
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { success: (...args: unknown[]) => mockToast.success(...args), warn: (...args: unknown[]) => mockToast.warn(...args) } }));
jest.mock("@/utils/log", () => ({ errorLog: jest.fn(), devLog: jest.fn() }));
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value }));
jest.mock("@/utils/fileUtils.ts", () => ({ writeInChunks: jest.fn() }));
jest.mock("@/utils/androidSaf", () => ({ saveJsonToSelectedAndroidDirectory: jest.fn() }));
jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: (...args: unknown[]) => mockShowDialog(...args) }));
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/components/base/switch", () => "ThemeSwitch");
jest.mock("@/constants/commonConst.ts", () => ({ ResumeMode: { Append: "append", Overwrite: "overwrite", OverwriteDefault: "overwrite-default" } }));
jest.mock("@/utils/delay", () => ({ __esModule: true, default: () => Promise.resolve() }));
jest.mock("../components/settingRow", () => "SettingRow");
jest.mock("../components/settingSection", () => "SettingSection");
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-file-system/legacy", () => ({ readAsStringAsync: jest.fn() }));
jest.mock("webdav", () => ({ AuthType: { Password: "password" }, createClient: () => mockClient }));

describe("WebDAV backup settings", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    const row = (title: string) => renderer.root.findAllByType(SettingRow).find(node => node.props.title === `backupAndResume.${title}`)!;
    beforeEach(() => {
        jest.clearAllMocks();
        Object.keys(mockConfig).forEach(key => delete mockConfig[key]);
        mockStatus = null;
        mockConfigured = true;
        mockUpload.mockReset().mockResolvedValue(undefined);
        mockResume.mockReset().mockResolvedValue(undefined);
        mockClient.exists.mockReset().mockResolvedValue(true);
        mockClient.getFileContents.mockReset().mockResolvedValue("backup contents");
        act(() => {
            renderer = TestRenderer.create(<BackupSetting />);
        });
    });
    afterEach(() => act(() => renderer.unmount()));

    it("defaults to off/daily and requires valid configuration to enable", () => {
        expect(row("webdavAutoBackup").props.right.props.value).toBe(false);
        expect(row("webdavAutoInterval").props.value).toBe("backupAndResume.webdavAutoInterval.daily");
        mockConfigured = false;
        act(() => row("webdavAutoBackup").props.onPress());
        expect(mockSetConfig).not.toHaveBeenCalled();
        expect(mockToast.warn).toHaveBeenCalledWith("toast.resumePreCheckFailed");
        mockConfigured = true;
        act(() => row("webdavAutoBackup").props.right.props.onValueChange(true));
        expect(mockSetConfig).toHaveBeenCalledWith("backup.webdavAutoEnabled", true);
    });

    it("lets the user disable automatic backups even with incomplete configuration", () => {
        mockConfig["backup.webdavAutoEnabled"] = true;
        mockConfigured = false;
        act(() => renderer.update(<BackupSetting />));
        act(() => row("webdavAutoBackup").props.onPress());
        expect(mockSetConfig).toHaveBeenCalledWith("backup.webdavAutoEnabled", false);
    });

    it("persists the selected interval and displays last success separately from a later failure", () => {
        act(() => row("webdavAutoInterval").props.onPress());
        const dialog = mockShowDialog.mock.calls[0][1];
        expect(dialog.content.map((item: any) => item.value)).toEqual(["daily", "weekly"]);
        dialog.onOk("weekly");
        expect(mockSetConfig).toHaveBeenCalledWith("backup.webdavAutoInterval", "weekly");
        expect(row("webdavLastBackup").props.description).toBe("backupAndResume.webdavNeverBackedUp");
        expect(row("webdavBackupFailure")).toBeUndefined();
        mockStatus = { lastSuccessAt: 1_790_000_000_000, lastAttemptAt: 1_790_001_000_000, result: "failed" };
        act(() => renderer.update(<BackupSetting />));
        expect(row("webdavLastBackup").props.description).toMatch(/^\d{4}-\d{2}-\d{2} /);
        expect(row("webdavLastBackup").props.value).toBeUndefined();
        act(() => row("webdavBackupFailure").props.onPress());
        expect(showPanel).toHaveBeenCalledWith("WebdavBackupInfo", { showFailure: true });
        mockStatus = { ...mockStatus, result: "success" };
        act(() => renderer.update(<BackupSetting />));
        expect(row("webdavBackupFailure")).toBeUndefined();
    });

    it("opens detailed help without toggling or uploading a backup", () => {
        act(() => row("webdavBackupHelp").props.onPress());
        expect(showPanel).toHaveBeenCalledWith("WebdavBackupInfo", {});
        expect(mockSetConfig).not.toHaveBeenCalled();
        expect(mockUpload).not.toHaveBeenCalled();
    });

    it("uses the shared uploader for manual backups and reports failures", async () => {
        await act(async () => row("backupToWebdav").props.onPress());
        expect(mockUpload).toHaveBeenCalledTimes(1);
        expect(mockToast.success).toHaveBeenCalledWith("toast.backupSuccess");
        mockUpload.mockRejectedValueOnce(new Error("upload failed"));
        await act(async () => row("backupToWebdav").props.onPress());
        expect(mockToast.warn).toHaveBeenCalledWith("toast.backupFail:upload failed");
    });

    it.each([
        { available: [true], expected: "/Audiora/AudioraBackup.json" },
        { available: [false, true], expected: "/MusicFree/MusicFreeBackup.json" },
        { available: [false, false, true], expected: "/BakaMusic/BakaMusicBackup.json" },
    ])("restores from $expected with the existing fallback order", async ({ available, expected }) => {
        available.forEach(exists => mockClient.exists.mockResolvedValueOnce(exists));
        await act(async () => row("resumeFromWebdav").props.onPress());
        expect(mockClient.getFileContents).toHaveBeenCalledWith(expected, { format: "text" });
        expect(mockResume).toHaveBeenCalledWith("backup contents", undefined);
    });

    it("handles a missing backup and WebDAV existence lookup errors without an unhandled rejection", async () => {
        mockClient.exists.mockResolvedValue(false);
        await act(async () => row("resumeFromWebdav").props.onPress());
        expect(mockToast.warn).toHaveBeenCalledWith("toast.backupFileNotFound");
        mockClient.exists.mockRejectedValueOnce(new Error("unreachable"));
        await act(async () => row("resumeFromWebdav").props.onPress());
        expect(mockToast.warn).toHaveBeenCalledWith("toast.resumeFail:unreachable");
        expect(mockResume).not.toHaveBeenCalled();
    });
});
