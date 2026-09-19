import {
    Easing,
    EasingFunction,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import {
    MotionDuration,
    MotionEasing,
    MotionSpring,
    motion as motionTokens,
} from "@/constants/designSystem";

/**
 * Helpers built on top of the motion tokens.
 *
 * Everything that animates should go through these helpers so a single token
 * change (or a Reduce Motion override) reaches the whole app.
 */

export const motionEasing: Record<MotionEasing, EasingFunction> = {
    // bezierFn (not bezier) — `bezier` returns a factory in Reanimated's types.
    standard: Easing.bezierFn(...motionTokens.easing.standard),
    decelerate: Easing.bezierFn(...motionTokens.easing.decelerate),
    accelerate: Easing.bezierFn(...motionTokens.easing.accelerate),
    emphasized: Easing.bezierFn(...motionTokens.easing.emphasized),
};

/**
 * Reduce Motion collapses long travel to a short cross-fade instead of
 * removing it: a player that appears with no transition at all reads as a
 * freeze, which is worse than a 160ms fade.
 */
export function motionDuration(
    kind: MotionDuration,
    reduceMotion = false,
): number {
    if (!reduceMotion) {
        return motionTokens.duration[kind];
    }
    return Math.min(motionTokens.duration[kind], motionTokens.duration.fast);
}

export interface MotionOptions {
    duration?: MotionDuration;
    easing?: MotionEasing;
    spring?: MotionSpring;
    /** Fling velocity handed over from a gesture (spatial spring only). */
    velocity?: number;
    reduceMotion?: boolean;
}

export type MotionCallback = (finished?: boolean) => void;

export function withMotionTiming(
    toValue: number,
    options?: MotionOptions,
    callback?: MotionCallback,
) {
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
