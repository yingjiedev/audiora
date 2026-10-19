import { DeviceEventEmitter, NativeModules, Platform } from "react-native";
import NativePlayer from "react-native-track-player";
import trackPlayer from "@/core/trackPlayer";
import bootstrap, { initTrackPlayer } from "@/entry/bootstrap/bootstrap";
import bootstrapAtom from "@/entry/bootstrap/bootstrap.atom";
import { getDefaultStore } from "jotai";
import { createAndroidAutoCommandConsumer, executeAndroidAutoCommand } from "./androidAutoCommands";

let installed = false;

export function setupAndroidAutoService() {
    const bridge = NativeModules.AndroidAuto;
    if (installed || Platform.OS !== "android" || !bridge) {
        return;
    }
    installed = true;
    const drain = createAndroidAutoCommandConsumer({
        async ready() {
            await bootstrap();
            const state = getDefaultStore().get(bootstrapAtom);
            if (state.state === "Fatal") {
                throw state.reason ?? new Error("播放器初始化失败，请在手机中打开 Audiora");
            }
            await initTrackPlayer();
        },
        takeCommands: () => bridge.takeCommands(),
        execute: command => executeAndroidAutoCommand(command, trackPlayer, () => NativePlayer.stop()),
        reportError: message => bridge.reportError(message),
    });
    DeviceEventEmitter.addListener("audiora-auto-command", () => {
        drain();
    });
    if (bridge.isConnected()) {
        drain();
    }
}
