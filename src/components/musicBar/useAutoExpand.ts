import { useEffect } from "react";
import { AppState, Keyboard } from "react-native";
import { useNavigation } from "@react-navigation/native";
import NativeTrackPlayer, { Event, State, Track } from "react-native-track-player";
import { getCurrentDialog } from "@/components/dialogs/useDialog";
import { panelInfoStore } from "@/components/panels/usePanel";
import { TrackPlayerEvents } from "@/core.defination/trackPlayer";
import { isPlayerOpen } from "@/core/playerOverlay";
import TrackPlayer from "@/core/trackPlayer";
import { getMediaUniqueKey } from "@/utils/mediaUtils";

/** Expand once per selected song, only when its first playback reaches the visible dock. */
export default function useAutoExpand(onExpand: () => void) {
    const navigation = useNavigation();

    useEffect(() => {
        let disposed = false;
        let currentKey = TrackPlayer.currentMusic
            ? getMediaUniqueKey(TrackPlayer.currentMusic) : null;
        let started = false;
        let selectionChanged = false;
        let activeTrack: Track | undefined;
        let state: State | undefined;
        let trackRevision = 0;
        let stateRevision = 0;

        const considerPlayback = (allowExpansion = true) => {
            if (disposed || started || !currentKey || state !== State.Playing ||
                !activeTrack || !activeTrack.url || activeTrack.url.startsWith("audiora://") ||
                getMediaUniqueKey(activeTrack as IMusic.IMusicItem) !== currentKey) {
                return;
            }
            // Consume hidden starts too: returning from another page must not reopen the card.
            started = true;
            if (allowExpansion && navigation.isFocused() && AppState.currentState === "active" &&
                !Keyboard.isVisible() && !isPlayerOpen() &&
                !panelInfoStore.getValue().name && !getCurrentDialog().name) {
                onExpand();
            }
        };
        const musicChanged = (music: IMusic.IMusicItem | null) => {
            const nextKey = music ? getMediaUniqueKey(music) : null;
            if (nextKey !== currentKey) {
                currentKey = nextKey;
                started = false;
                selectionChanged = true;
            }
        };
        TrackPlayer.on(TrackPlayerEvents.CurrentMusicChanged, musicChanged);
        const trackSubscription = NativeTrackPlayer.addEventListener(
            Event.PlaybackActiveTrackChanged,
            event => {
                trackRevision += 1;
                activeTrack = event.track;
                considerPlayback();
            },
        );
        const stateSubscription = NativeTrackPlayer.addEventListener(Event.PlaybackState, event => {
            stateRevision += 1;
            state = event.state;
            considerPlayback();
        });

        // Seed a restored paused track, but do not treat an already-playing mount as a new start.
        Promise.all([NativeTrackPlayer.getActiveTrack(), NativeTrackPlayer.getPlaybackState()])
            .then(([initialTrack, initialState]) => {
                if (disposed) {
                    return;
                }
                if (trackRevision === 0) {
                    activeTrack = initialTrack;
                }
                if (stateRevision === 0) {
                    state = initialState.state;
                }
                considerPlayback(selectionChanged || stateRevision > 0);
            })
            .catch(() => {
                // The native player may not be set up yet; subsequent events seed both values.
            });

        return () => {
            disposed = true;
            TrackPlayer.off(TrackPlayerEvents.CurrentMusicChanged, musicChanged);
            trackSubscription.remove();
            stateSubscription.remove();
        };
    }, [navigation, onExpand]);
}
