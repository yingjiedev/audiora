import { showDialog } from "@/components/dialogs/useDialog";
import LocalMusicSheet from "@/core/localMusicSheet";
import Toast from "@/utils/toast";
import { openLocalMusicScanner } from "./scanMusic";

jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: jest.fn() }));
jest.mock("@/core/i18n", () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock("@/core/localMusicSheet", () => ({ __esModule: true, default: { importLocal: jest.fn(async () => {}), cancelImportLocal: jest.fn() } }));
jest.mock("@/core/router", () => ({ ROUTE_PATH: { FILE_SELECTOR: "file-selector" } }));
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { success: jest.fn(), warn: jest.fn() } }));

describe("shared local scan flow", () => {
    const navigate = jest.fn();
    const hide = jest.fn();
    beforeEach(() => {
        jest.clearAllMocks(); openLocalMusicScanner(navigate);
    });
    function selection() {
        return navigate.mock.calls[0][1];
    }
    function dialog() {
        return (showDialog as jest.Mock).mock.calls[0][1];
    }

    it("opens a single folder selector and returns success after importing", async () => {
        expect(navigate).toHaveBeenCalledWith("file-selector", expect.objectContaining({ fileType: "folder", multi: false, actionText: "localMusic.beginScan" }));
        const result = selection().onAction([{ path: "/Music", type: "folder" }]);
        expect(LocalMusicSheet.importLocal).toHaveBeenCalledWith(["/Music"]);
        dialog().onResolve(undefined, hide);
        await expect(result).resolves.toBe(true);
        expect(hide).toHaveBeenCalledTimes(1);
        expect(Toast.success).toHaveBeenCalledWith("toast.importSuccess");
    });

    it("keeps selection open on failure and gives the error", async () => {
        const result = selection().onAction([{ path: "/Music", type: "folder" }]);
        dialog().onReject(new Error("Denied"), hide);
        await expect(result).resolves.toBe(false);
        expect(Toast.warn).toHaveBeenCalledWith("toast.failToImportMusic: Denied");
        expect(hide).toHaveBeenCalledTimes(1);
    });

    it("cancels import and leaves the selector open", async () => {
        const result = selection().onAction([{ path: "/Music", type: "folder" }]);
        dialog().onCancel(hide);
        await expect(result).resolves.toBe(false);
        expect(LocalMusicSheet.cancelImportLocal).toHaveBeenCalledTimes(1);
        expect(Toast.success).not.toHaveBeenCalled();
    });

    it("does not scan or show a dialog without a selected folder", async () => {
        await expect(selection().onAction([])).resolves.toBe(false);
        expect(LocalMusicSheet.importLocal).not.toHaveBeenCalled();
        expect(showDialog).not.toHaveBeenCalled();
    });
});
