import { showDialog } from "@/components/dialogs/useDialog";
import i18n from "@/core/i18n";
import LocalMusicSheet from "@/core/localMusicSheet";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import Toast from "@/utils/toast";

/** One scan flow for both Library and the existing local management page. */
export function openLocalMusicScanner(navigate: ReturnType<typeof useNavigate>) {
    navigate(ROUTE_PATH.FILE_SELECTOR, {
        fileType: "folder",
        multi: false,
        actionText: i18n.t("localMusic.beginScan"),
        async onAction(selectedFiles) {
            if (!selectedFiles.length) return false;
            return new Promise<boolean>(resolve => {
                showDialog("LoadingDialog", {
                    title: i18n.t("localMusic.scanLocalMusic"),
                    promise: LocalMusicSheet.importLocal(selectedFiles.map(file => file.path)),
                    onResolve(_data, hideDialog) {
                        Toast.success(i18n.t("toast.importSuccess"));
                        hideDialog();
                        resolve(true);
                    },
                    onCancel(hideDialog) {
                        LocalMusicSheet.cancelImportLocal();
                        hideDialog();
                        resolve(false);
                    },
                    onReject(reason, hideDialog) {
                        hideDialog();
                        Toast.warn(`${i18n.t("toast.failToImportMusic")}: ${reason?.message ?? reason}`);
                        resolve(false);
                    },
                });
            });
        },
    });
}
