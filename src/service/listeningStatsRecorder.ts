import NativePlayer, { Event, State, Track } from "react-native-track-player";
import { AppState } from "react-native";
import { flushListeningStats, listeningTracker } from "@/core/listeningStats";
import { ListeningSong } from "@/core/listeningStatsModel";

let installed = false;

function realSong(track: Track | undefined): ListeningSong | undefined {
    if (!track || track.url === "audiora://fake-audio" || track.url === "audiora://proposed-audio") return;
    return track as unknown as ListeningSong;
}

/** Native progress continues in the background; screen timers must not count playback. */
export function setupListeningStatsRecorder() {
    if (installed) return;
    installed = true;
    let song: ListeningSong | undefined;
    let revision = 0;
    NativePlayer.addEventListener(Event.PlaybackActiveTrackChanged, event => {
        revision++;
        song = realSong(event.track);
        listeningTracker.changeTrack(song);
        flushListeningStats();
    });
    NativePlayer.addEventListener(Event.PlaybackState, event => {
        revision++;
        listeningTracker.setPlaying(event.state === State.Playing);
        if (event.state !== State.Playing) flushListeningStats();
    });
    NativePlayer.addEventListener(Event.PlaybackProgressUpdated, event => {
        if (event.track === 0) listeningTracker.progress(song, event.position);
    });
    AppState.addEventListener("change", () => flushListeningStats());
    // Service can attach to an already active player. Ignore a stale async snapshot.
    const initialRevision = revision;
    Promise.all([NativePlayer.getActiveTrack(), NativePlayer.getPlaybackState()]).then(([track, state]) => {
        if (revision !== initialRevision) return;
        song = realSong(track);
        listeningTracker.changeTrack(song);
        listeningTracker.setPlaying(state.state === State.Playing);
    }).catch(() => undefined);
}
