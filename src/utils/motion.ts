import { Platform } from "react-native";
import { EasingFunction, withSpring, withTiming } from "react-native-reanimated";
import {
    MotionDuration,
    MotionEasing,
    MotionSpring,
    motion as motionTokens,
} from "@/constants/designSystem";
import { cubicBezier, motionDuration } from "@/utils/motionMath";

/**
 * Helpers built on top of the motion tokens.
 *
 * Everything that animates should go through these helpers so a single token
 * change (or a Reduce Motion override) reaches the whole app.
 *
 * The maths (bezier solver, Reduce Motion clamping) lives in `motionMath` so it
 * stays testable without a Reanimated runtime — every Jest suite that loads the
 * real package fails to parse its ESM build. Both are re-exported here because
 * call sites import the motion helpers from one place.
 */
export { cubicBezier, motionDuration };

export const motionEasing: Record<MotionEasing, EasingFunction> = {
    standard: cubicBezier(...motionTokens.easing.standard),
    decelerate: cubicBezier(...motionTokens.easing.decelerate),
    accelerate: cubicBezier(...motionTokens.easing.accelerate),
    emphasized: cubicBezier(...motionTokens.easing.emphasized),
};

export interface MotionOptions {
    duration?: MotionDuration;
    easing?: MotionEasing;
    spring?: MotionSpring;
    /** Fling velocity handed over from a gesture (spatial spring only). */
    velocity?: number;
    reduceMotion?: boolean;
}

/**
 * Keyboard tracking has to follow the OS curve, so it keeps its own preset:
 * iOS animates the keyboard slower than Android (was 250 / 150 hardcoded).
 */
export const KEYBOARD_TIMING = {
    duration: Platform.OS === "ios" ? "normal" : "fast",
    easing: "standard",
} as const;

/**
 * Completion callback for an animation.
 *
 * **It has to be a worklet.** Reanimated calls it from the frame queue
 * (`valueSetter.step` → `animation.callback(true)`), which runs on the UI
 * runtime; a plain JS function there becomes a "Remote Function" whose only
 * behaviour is to throw, and the throw escapes the frame callback and kills the
 * process. Mark the body with `"worklet"` and send anything that has to reach
 * JS through `runOnJS` — `scripts/check-animation-callbacks.js` enforces this.
 */
export type MotionCallback = (finished?: boolean) => void;

/**
 * Both builders are **worklets**, exactly like the Reanimated primitives they
 * wrap: `withTiming`/`withSpring` may be called on the UI runtime, so the
 * helpers around them have to survive that trip too. Anything that animates
 * from inside another animation callback (a chained `withDelay`, a panel that
 * animates out when the in-animation finishes) depends on this — a plain JS
 * helper there throws "[Worklets] Tried to synchronously call a Remote
 * Function" and takes the process down.
 */
export function withMotionTiming(
    toValue: number,
    options?: MotionOptions,
    callback?: MotionCallback,
) {
    "worklet";
    const {
        duration = "normal",
        easing = "standard",
        reduceMotion = false,
    } = options ?? {};
    return withTiming(
        toValue,
        {
            duration: motionDuration(duration, reduceMotion),
            easing: motionEasing[easing],
        },
        callback,
    );
}

/**
 * Spatial motion (position / size / rotation). Springs are interruptible and
 * carry the velocity of the gesture that released them, which tween-based
 * animations cannot do — that is the whole reason Mini ↔ Full uses springs.
 */
export function withMotionSpring(
    toValue: number,
    options?: MotionOptions,
    callback?: MotionCallback,
) {
    "worklet";
    const {
        spring = "spatial",
        velocity,
        reduceMotion = false,
    } = options ?? {};
    if (reduceMotion) {
        // No overshoot and no travel: land on the target with a short fade.
        return withTiming(
            toValue,
            {
                duration: motionDuration("fast", true),
                easing: motionEasing.decelerate,
            },
            callback,
        );
    }
    return withSpring(
        toValue,
        {
            ...motionTokens.spring[spring],
            ...(velocity != null ? { velocity } : null),
        },
        callback,
    );
}
