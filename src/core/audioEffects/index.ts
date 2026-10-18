import { useEffect, useSyncExternalStore } from "react";
import { AppState, NativeEventEmitter, NativeModules, Platform } from "react-native";
import { AudioEffectsBridge, AudioEffectsStore } from "./store";

const nativeBridge = Platform.OS === "android" ? NativeModules.AudioEffects : undefined;
export const audioEffects = new AudioEffectsStore(nativeBridge as AudioEffectsBridge | undefined);

export function useAudioEffects() {
    const state = useSyncExternalStore(audioEffects.subscribe, audioEffects.getSnapshot);
    useEffect(() => {
        if (!nativeBridge) {
            return;
        }
        const events = new NativeEventEmitter(nativeBridge);
        const listener = events.addListener("audiora-audio-effects-changed", (raw: string) => audioEffects.receive(raw));
        const appState = AppState.addEventListener("change", next => {
            if (next === "active") {
                audioEffects.refresh();
            }
        });
        audioEffects.refresh();
        return () => {
            listener.remove();
            appState.remove();
        };
    }, []);
    return state;
}
