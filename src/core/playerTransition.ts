import { cancelAnimation, makeMutable, runOnJS, SharedValue } from "react-native-reanimated";
import { MotionRect } from "@/utils/motionMath";
import { withMotionSpring } from "@/utils/motion";

/**
 * Cross-screen state for the Mini ↔ Full player transition.
 *
 * The mini player lives inside whatever page is behind, the full player is its
 * own native-stack screen, so the transition cannot be expressed as a single
 * view tree. Instead both ends read one shared `progress` (0 = collapsed on the
 * mini player, 1 = full screen) plus the screen-space frame of the mini
 * artwork. Every animated value lives on the UI thread, which is what makes the
 * transition interruptible mid-flight (drag, cancel, track change).
 *
 * Progress is intentionally a spring: a spring that gets re-targeted keeps the
 * velocity of the gesture that released it, a tween would jump.
 */
export interface PlayerTransitionState {
    progress: SharedValue<number>;
    /** Frame of the mini player artwork in window coordinates. */
    origin: SharedValue<MotionRect | null>;
}

let state: PlayerTransitionState | null = null;

function getState(): PlayerTransitionState {
    if (state === null) {
        state = {
            progress: makeMutable(1),
            origin: makeMutable<MotionRect | null>(null),
        };
    }
    return state;
}

export function playerTransition(): PlayerTransitionState {
    return getState();
}

/** Write the progress value directly — used while a finger is down. */
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
    const { progress, origin } = getState();
    cancelAnimation(progress);
    progress.value = origin.value === null ? 1 : 0;
}

/** Forget the shared frame once the full player is gone. */
export function resetPlayerTransition() {
    const { progress, origin } = getState();
    cancelAnimation(progress);
    progress.value = 1;
    origin.value = null;
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
    cancelAnimation(progress);
    progress.value = withMotionSpring(1, options);
}

/**
 * Full screen → collapsed. `onFinished` runs on the JS thread once the screen
 * can actually be popped, so the native removal never cuts the animation.
 */
export function collapsePlayerTransition(
    onFinished: () => void,
    options: PlayerTransitionMotionOptions = {},
) {
    const { progress } = getState();
    cancelAnimation(progress);
    progress.value = withMotionSpring(0, options, finished => {
        if (finished) {
            runOnJS(onFinished)();
        }
    });
}

/** Abort a running collapse (gesture cancelled) and settle back to full. */
export function cancelPlayerTransitionCollapse(
    options: PlayerTransitionMotionOptions = {},
) {
    const { progress } = getState();
    cancelAnimation(progress);
    progress.value = withMotionSpring(1, options);
}
