import { NativeModules, ToastAndroid } from "react-native";
import i18n from "@/core/i18n";
import { appendStartupBreadcrumb, errorLog } from "@/utils/log";
import { initTrackPlayer } from "./playbackRuntime";
import { runMusicWidgetAction } from "./musicWidget";

type WidgetTask = { control?: string; request?: string };

/** Invoked by the playback service; no Activity, navigation, splash or UI bootstrap. */
export default async function runWidgetTask({ control, request }: WidgetTask) {
    try {
        if (!["toggle", "previous", "next", "shiyin"].includes(control ?? "")) return;
        void appendStartupBreadcrumb("widget-task-start", { control, request });
        await require("./index")();
        await initTrackPlayer(undefined, true);
        const isActive = request ? () => NativeModules.MusicWidget.isActionActive(request) : undefined;
        await runMusicWidgetAction(control!, isActive);
        void appendStartupBreadcrumb("widget-task-finished", { control, request });
    } catch (error) {
        errorLog("Widget background startup failed", error);
        void appendStartupBreadcrumb("widget-task-error", { control, request, message: String(error) });
        ToastAndroid.show(i18n.t("toast.widgetStartupFailed"), ToastAndroid.LONG);
    } finally {
        if (request) await NativeModules.MusicWidget?.finishAction(request)?.catch(() => undefined);
    }
}
