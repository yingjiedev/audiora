import EditSheetDetailDialog from "./editSheetDetail";
import LoadingDialog from "./loadingDialog";
import MarkdownDialog from "./markdownDialog";
import RadioDialog from "./radioDialog";
import SimpleDialog from "./simpleDialog";
import SubscribePluginDialog from "./subscribePluginDialog";
import SetScheduleCloseTimeDialog from "./setScheduleCloseTimeDialog";
import AppUpdateDialog from "./appUpdateDialog";

const dialogs = {
    AppUpdateDialog,
    SimpleDialog,
    RadioDialog,
    SubscribePluginDialog,
    LoadingDialog,
    EditSheetDetailDialog,
    MarkdownDialog,
    SetScheduleCloseTimeDialog,
};

export default dialogs;

export type IDialogType = typeof dialogs;
export type IDialogKey = keyof IDialogType;
