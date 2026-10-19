import { DeviceEventEmitter, NativeModules, Platform, ToastAndroid } from "react-native";
import NativePlayer, { Event, State } from "react-native-track-player";
import TrackPlayer from "@/core/trackPlayer";
import { openPlayer } from "@/core/playerOverlay";
import { TrackPlayerEvents } from "@/core.defination/trackPlayer";
import { resolveArtwork } from "@/utils/artwork";
import { errorLog } from "@/utils/log";
import type useColors from "@/hooks/useColors";
import { startWidgetShiYin } from "./widgetShiYin";
import i18n from "@/core/i18n";

const bridge = () => Platform.OS === "android" ? NativeModules.MusicWidget : undefined;
let installed = false;
let state: State = State.None;
let revision = 0;
let actions = Promise.resolve();
let discovering = false;
const handledLinks = new Set<string>();

function publish() {
    const music = TrackPlayer.currentMusic;
    bridge()?.updatePlayback({
        title: music?.title ?? "",
        artist: music?.artist ?? "",
        artwork: resolveArtwork(music) ?? "",
        hasTrack: !!music,
        playing: !!music && state === State.Playing,
        loading: !!music && (state === State.Buffering || state === State.Loading),
        discovering,
    })?.catch(() => undefined);
}

/** Reuse the app queue/source resolver; the native queue contains only one song. */
export function runMusicWidgetAction(action: string, isActive?: () => Promise<boolean>) {
    if (!["toggle", "previous", "next", "shiyin"].includes(action)) return Promise.resolve();
    // Do not enqueue multiple chart requests while the first discovery is pending.
    if (action === "shiyin") {
        if (discovering) return actions;
        discovering = true;
        publish();
    }
    actions = actions.then(async () => {
        if (isActive && !await isActive()) return;
        if (action === "shiyin") {
            await startWidgetShiYin(isActive);
            return;
        }
        if (!TrackPlayer.currentMusic) {
            ToastAndroid.show(i18n.t("toast.widgetQueueEmpty"), ToastAndroid.LONG);
            return;
        }
        if (action === "previous") await TrackPlayer.skipToPrevious();
        else if (action === "next") await TrackPlayer.skipToNext();
        else if (await NativePlayer.getPlayWhenReady()) await TrackPlayer.pause();
        else await TrackPlayer.play();
    }).catch(error => {
        errorLog("Music widget action failed", error);
    }).finally(() => {
        if (action === "shiyin") {
            discovering = false;
            publish();
        }
    });
    return actions;
}

/** Install only after queue restoration, and keep listeners alive with playback. */
export function setupMusicWidget() {
    if (!bridge() || installed) return;
    installed = true;
    DeviceEventEmitter.addListener("audiora-widget-action", runMusicWidgetAction);
    TrackPlayer.on(TrackPlayerEvents.CurrentMusicChanged, () => {
        revision++;
        state = State.Paused;
        publish();
    });
    NativePlayer.addEventListener(Event.PlaybackState, event => {
        revision++;
        state = event.state;
        publish();
    });
    // Includes artwork edits made while the same song remains selected.
    NativePlayer.addEventListener(Event.PlaybackActiveTrackChanged, publish);
    const initialRevision = revision;
    NativePlayer.getPlaybackState().then(snapshot => {
        if (revision !== initialRevision) return;
        state = snapshot.state;
        publish();
    }).catch(() => publish());
    bridge().setReady(true)?.catch(() => undefined);
}

export function syncMusicWidgetColors(colors: ReturnType<typeof useColors>) {
    bridge()?.updateColors(colors.widgetAppearances)?.catch(() => undefined);
}

/** The native receiver opens the app on cold start; bootstrap restores the queue first. */
export async function handleMusicWidgetLink(url: string) {
    let link: URL;
    try {
        link = new URL(url);
    } catch {
        return false;
    }
    if (link.protocol !== "audiora:" || link.hostname !== "app" || link.pathname !== "/widget") return false;
    if (link.searchParams.get("action") === "open") {
        if (TrackPlayer.currentMusic) openPlayer();
        return true;
    }
    if (!handledLinks.has(url)) {
        handledLinks.add(url);
        // A warm app may receive both the initial URL and a Linking event.
        if (handledLinks.size > 32) handledLinks.delete(handledLinks.values().next().value!);
        await runMusicWidgetAction(link.searchParams.get("action") ?? "");
    }
    return true;
}
