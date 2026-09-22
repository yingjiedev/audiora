import { useMemo } from "react";
import { EasingFunction, useReducedMotion } from "react-native-reanimated";
import { MotionEasing, MotionDuration } from "@/constants/designSystem";
import {
    MotionCallback,
    MotionOptions,
    motionDuration,
    motionEasing,
    withMotionSpring,
    withMotionTiming,
} from "@/utils/motion";

export interface MotionApi {
    /** True when the system asks for reduced motion. */
    reduceMotion: boolean;
    duration: (kind: MotionDuration) => number;
    easing: (kind: MotionEasing) => EasingFunction;
    timing: (
        toValue: number,
        options?: Omit<MotionOptions, "reduceMotion">,
        callback?: MotionCallback,
    ) => number;
    spring: (
        toValue: number,
        options?: Omit<MotionOptions, "reduceMotion">,
        callback?: MotionCallback,
    ) => number;
}

/**
 * Motion tokens bound to the current Reduce Motion setting.
 *
 * Use this instead of raw `withTiming` / `withSpring` so every animation in a
 * component degrades the same way when the user turns "reduce motion" on.
 */
export default function useMotion(): MotionApi {
    const reduceMotion = useReducedMotion();

    return useMemo(
        () => ({
            reduceMotion,
            duration: (kind: MotionDuration) =>
                motionDuration(kind, reduceMotion),
            easing: (kind: MotionEasing) => motionEasing[kind],
            timing: (
                toValue: number,
                options?: Omit<MotionOptions, "reduceMotion">,
                callback?: MotionCallback,
            ) => withMotionTiming(toValue, { ...options, reduceMotion }, callback),
            spring: (
                toValue: number,
                options?: Omit<MotionOptions, "reduceMotion">,
                callback?: MotionCallback,
            ) => withMotionSpring(toValue, { ...options, reduceMotion }, callback),
        }),
        [reduceMotion],
    );
}
