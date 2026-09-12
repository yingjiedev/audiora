import { DeviceEventEmitter } from "react-native";
import { panelInfoStore } from "@/components/panels/usePanel";
import { GlobalState } from "@/utils/stateMapper";

export interface IMvPlayerPayload {
    musicItem: IMusic.IMusicItem;
    initialSource?: IPlugin.IVideoSourceResult;
}

export const mvPlayerStore = new GlobalState<IMvPlayerPayload | null>(null);

export function showMvPlayer(payload: IMvPlayerPayload) {
    if (panelInfoStore.getValue().name) {
        DeviceEventEmitter.emit("hidePanel", () => {
            panelInfoStore.setValue({ name: null, payload: null });
            mvPlayerStore.setValue(payload);
        });
        return;
    }
    mvPlayerStore.setValue(payload);
}

export function hideMvPlayer() {
    DeviceEventEmitter.emit("hideMvPlayer");
}
