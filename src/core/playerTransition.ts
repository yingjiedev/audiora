import {
    cancelAnimation,
    makeMutable,
    runOnJS,
    runOnUI,
    SharedValue,
} from "react-native-reanimated";
import { MotionRect } from "@/utils/motionMath";
import { withMotionSpring, withMotionTiming } from "@/utils/motion";

/**
 * Shared state for the mini-player entrance and whole-player dismissal.
 *
 * The mini player lives inside whatever page is behind, the full player is a
 * root overlay, so the transition cannot be expressed as a single
 * view tree. `progress` only drives entry from the mini artwork to full screen.
 * Dismissal has its own progress so the full cover never shrinks back over the
 * dock while the page slides away. All values live on the UI thread.
 */
export interface PlayerTransitionState {
    progress: SharedValue<number>;
    /** 0 = resting full player, 1 = the whole page has left the screen. */
    dismissProgress: SharedValue<number>;
    /** Frame of the mini player artwork in window coordinates. */
    origin: SharedValue<MotionRect | null>;
}

let state: PlayerTransitionState | null = null;

function getState(): PlayerTransitionState {
    if (state === null) {
        state = {
            progress: makeMutable(1),
            dismissProgress: makeMutable(0),
            origin: makeMutable<MotionRect | null>(null),
        };
    }
    return state;
}

export function playerTransition(): PlayerTransitionState {
    return getState();
}

/** Write the artwork entrance progress directly. Dismissal is independent. */
export function setPlayerTransitionProgress(value: number) {
    getState().progress.value = value;
}

/**
 * Arm the transition from the mini player. Called right before navigating so
 * the full player knows it has a shared element to morph from. When no frame
 * has been measured (player opened from a list, or the very first frame) the
 * full player simply skips the morph and shows up directly.
 */
export function armPlayerTransition() {
    const { progress, dismissProgress, origin } = getState();
    runOnUI(() => {
        cancelAnimation(progress);
        cancelAnimation(dismissProgress);
        dismissProgress.value = 0;
        progress.value = origin.value === null ? 1 : 0;
    })();
}

/** Forget the shared frame once the full player is gone. */
export function resetPlayerTransition() {
    const { progress, dismissProgress, origin } = getState();
    runOnUI(() => {
        cancelAnimation(progress);
        cancelAnimation(dismissProgress);
        progress.value = 1;
        dismissProgress.value = 0;
        origin.value = null;
    })();
}

export interface PlayerTransitionMotionOptions {
    reduceMotion?: boolean;
    velocity?: number;
}

/** Collapse → full screen. Interrupting it just re-targets the spring. */
export function expandPlayerTransition(
    options: PlayerTransitionMotionOptions = {},
) {
    const { progress } = getState();
    runOnUI(() => {
        cancelAnimation(progress);
        progress.value = withMotionSpring(1, options);
    })();
}

/**
 * Slide the whole player down and fade it out in a bounded screen transition.
 * `onFinished` reaches JS only after the last invisible frame.
 */
export function collapsePlayerTransition(
    onFinished: () => void,
    options: PlayerTransitionMotionOptions = {},
) {
    const { dismissProgress } = getState();
    runOnUI(() => {
        cancelAnimation(dismissProgress);
        dismissProgress.value = withMotionTiming(1, {
            duration: "screen",
            easing: "accelerate",
            reduceMotion: options.reduceMotion,
        }, finished => {
            "worklet";
            if (finished) {
                runOnJS(onFinished)();
            }
        });
    })();
}

/** Abort a running collapse (gesture cancelled) and settle back to full. */
export function cancelPlayerTransitionCollapse(
    options: PlayerTransitionMotionOptions = {},
) {
    const { dismissProgress } = getState();
    runOnUI(() => {
        cancelAnimation(dismissProgress);
        dismissProgress.value = withMotionSpring(0, options);
    })();
}
