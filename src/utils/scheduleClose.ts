import { TrackPlayerEvents } from "@/core.defination/trackPlayer";
import TrackPlayer from "@/core/trackPlayer";
import PersistStatus from "@/utils/persistStatus";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import BackgroundTimer from "react-native-background-timer";

const storedDeadline = PersistStatus.get("app.scheduleCloseDeadline");
const initialDeadline = storedDeadline && storedDeadline > Date.now()
    ? storedDeadline
    : null;
const deadlineAtom = atom<number | null>(initialDeadline);
const closeAfterPlayEndAtom = atom(
    PersistStatus.get("app.scheduleCloseAfterPlayEnd") ?? false,
);

let timerId: any = null;
let isWaitingForCurrentTrackEnd = false;

async function stopPlayback() {
    try {
        await TrackPlayer.pause();
    } catch {
        // The player may not have finished initializing when a restored timer expires.
    }
}

function onCurrentTrackEnd() {
    isWaitingForCurrentTrackEnd = false;
    // The player advances its queue in the same event cycle. Deferring one tick
    // ensures we pause the newly-active track instead of racing that transition.
    setTimeout(() => {
        void stopPlayback();
    }, 0);
}

function clearBackgroundTimer() {
    if (timerId !== null) {
        BackgroundTimer.clearTimeout(timerId);
        timerId = null;
    }
}

function stopAfterCurrentTrack() {
    if (isWaitingForCurrentTrackEnd) {
        return;
    }

    isWaitingForCurrentTrackEnd = true;
    TrackPlayer.once(TrackPlayerEvents.PlayEnd, onCurrentTrackEnd);
}

function completeScheduleClose() {
    const store = getDefaultStore();
    const deadline = store.get(deadlineAtom);

    // Ignore an outdated callback left behind after a user reschedules the timer.
    if (!deadline || deadline > Date.now()) {
        return;
    }

    clearBackgroundTimer();
    store.set(deadlineAtom, null);
    PersistStatus.set("app.scheduleCloseDeadline", undefined);

    if (store.get(closeAfterPlayEndAtom)) {
        stopAfterCurrentTrack();
    } else {
        void stopPlayback();
    }
}

function armBackgroundTimer(deadline: number) {
    clearBackgroundTimer();
    const remaining = deadline - Date.now();

    if (remaining <= 0) {
        completeScheduleClose();
        return;
    }

    timerId = BackgroundTimer.setTimeout(() => {
        timerId = null;
        completeScheduleClose();
    }, remaining);
}

function setScheduleClose(deadline: number | null) {
    const store = getDefaultStore();
    clearBackgroundTimer();
    store.set(deadlineAtom, deadline);

    if (deadline && deadline > Date.now()) {
        PersistStatus.set("app.scheduleCloseDeadline", deadline);
        armBackgroundTimer(deadline);
    } else {
        PersistStatus.set("app.scheduleCloseDeadline", undefined);
    }
}

function restoreScheduleClose() {
    const deadline = PersistStatus.get("app.scheduleCloseDeadline");
    if (!deadline) {
        return;
    }

    getDefaultStore().set(deadlineAtom, deadline);
    if (deadline > Date.now()) {
        armBackgroundTimer(deadline);
    } else {
        completeScheduleClose();
    }
}

function setCloseAfterPlayEnd(closeAfterPlayEnd: boolean) {
    if (!closeAfterPlayEnd && isWaitingForCurrentTrackEnd) {
        TrackPlayer.off(TrackPlayerEvents.PlayEnd, onCurrentTrackEnd);
        isWaitingForCurrentTrackEnd = false;
    }
    getDefaultStore().set(closeAfterPlayEndAtom, closeAfterPlayEnd);
    PersistStatus.set("app.scheduleCloseAfterPlayEnd", closeAfterPlayEnd);
}

// A background timer covers normal playback in the background. This extra check
// handles devices that suspend JS timers and lets a restored app complete overdue
// schedules immediately instead of leaving playback running.
AppState.addEventListener("change", nextState => {
    if (nextState === "active") {
        restoreScheduleClose();
    }
});

restoreScheduleClose();

function useScheduleCloseCountDown() {
    const deadline = useAtomValue(deadlineAtom);
    const [countDown, setCountDown] = useState(
        deadline ? deadline - Date.now() : null,
    );
    const intervalRef = useRef<any>(null);

    useEffect(() => {
        intervalRef.current && clearInterval(intervalRef.current);
        intervalRef.current = null;

        if (!deadline || deadline <= Date.now()) {
            setCountDown(null);
            if (deadline) {
                completeScheduleClose();
            }
            return;
        }

        setCountDown(Math.max(deadline - Date.now(), 0) / 1000);
        intervalRef.current = setInterval(() => {
            const remaining = deadline - Date.now();
            setCountDown(Math.max(remaining, 0) / 1000);
            if (remaining <= 0) {
                completeScheduleClose();
            }
        }, 1000);

        return () => {
            intervalRef.current && clearInterval(intervalRef.current);
            intervalRef.current = null;
        };
    }, [deadline]);

    return countDown;
}

const useCloseAfterPlayEnd = () => useAtomValue(closeAfterPlayEndAtom);

export {
    restoreScheduleClose,
    setScheduleClose,
    useScheduleCloseCountDown,
    setCloseAfterPlayEnd,
    useCloseAfterPlayEnd,
};
