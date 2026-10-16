import {
    cancelAnimation,
    makeMutable,
    runOnJS,
    runOnUI,
    SharedValue,
} from "react-native-reanimated";
import { withMotionSpring, withMotionTiming } from "@/utils/motion";

/**
 * Whole-player entrance and dismissal. Both move the same root surface:
 * entry goes from below the screen to its resting position, exit goes back
 * down. Separate progress values allow closing halfway through entry without
 * jumping to a fully expanded frame. All values live on the UI thread.
 */
export interface PlayerTransitionState {
    progress: SharedValue<number>;
    /** 0 = resting full player, 1 = the whole page has left the screen. */
    dismissProgress: SharedValue<number>;
}

let state: PlayerTransitionState | null = null;

function getState(): PlayerTransitionState {
    if (state === null) {
        state = {
            progress: makeMutable(1),
            dismissProgress: makeMutable(0),
        };
    }
    return state;
}

export function playerTransition(): PlayerTransitionState {
    return getState();
}

/**
 * Queue the hidden first frame before mounting, regardless of opening source.
 * The entrance animation queues after this preparation on the same UI runtime.
 */
export function armPlayerTransition() {
    const { progress, dismissProgress } = getState();
    runOnUI(() => {
        cancelAnimation(progress);
        cancelAnimation(dismissProgress);
        dismissProgress.value = 0;
        progress.value = 0;
    })();
}

/** Cancel old animations once the full player is gone. */
export function resetPlayerTransition() {
    const { progress, dismissProgress } = getState();
    runOnUI(() => {
        cancelAnimation(progress);
        cancelAnimation(dismissProgress);
        // A previous session can unmount after the next opening was armed.
        // Preserve that hidden first frame; only armPlayerTransition resets it.
    })();
}

export interface PlayerTransitionMotionOptions {
    reduceMotion?: boolean;
    velocity?: number;
}

/** Slide the whole page up from the bottom with a bounded screen transition. */
export function expandPlayerTransition(
    options: PlayerTransitionMotionOptions = {},
) {
    const { progress } = getState();
    runOnUI(() => {
        cancelAnimation(progress);
        progress.value = withMotionTiming(1, {
            duration: "screen",
            easing: "decelerate",
            reduceMotion: options.reduceMotion,
        });
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
    const { progress, dismissProgress } = getState();
    runOnUI(() => {
        // Freeze an interrupted entrance, then exit from that exact position.
        cancelAnimation(progress);
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
