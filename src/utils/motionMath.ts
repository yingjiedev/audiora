/**
 * Pure geometry / gesture math plus the easing solver for the motion system.
 *
 * Deliberately free of Reanimated: the animation layer only feeds numbers in
 * and applies numbers out, so the interesting behaviour (interrupt thresholds,
 * shared-element geometry, easing curves, Reduce Motion clamping) is
 * unit-testable without a Reanimated runtime — every Jest suite that touches
 * the real package fails to parse its ESM build.
 */

import { motion as motionTokens } from "@/constants/designSystem";
import type { MotionDuration } from "@/constants/designSystem";

/**
 * Cubic-bezier easing, solved in JS.
 *
 * `Easing.bezierFn` would do the same inside the app, but it is resolved at
 * module load: any suite that installs a partial `react-native-reanimated` mock
 * (see localPlayback.test.ts) then fails to import the whole motion system.
 * Solving the curve here keeps one implementation with no runtime dependency
 * on Reanimated's Easing surface.
 */
export function cubicBezier(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
): (t: number) => number {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;

    const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
    const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;
    const slopeX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;

    const solveU = (t: number) => {
        let u = t;
        // Newton-Raphson: converges in 2-4 steps for the M3 curves.
        for (let i = 0; i < 8; i++) {
            const dx = sampleX(u) - t;
            if (Math.abs(dx) < 1e-6) {
                return u;
            }
            const d = slopeX(u);
            if (Math.abs(d) < 1e-6) {
                break;
            }
            u -= dx / d;
        }
        // Flat segment fallback: bisect the whole range.
        let low = 0;
        let high = 1;
        u = t;
        for (let i = 0; i < 24 && high - low > 1e-6; i++) {
            if (sampleX(u) < t) {
                low = u;
            } else {
                high = u;
            }
            u = (low + high) / 2;
        }
        return u;
    };

    return (t: number) => {
        if (t <= 0) {
            return 0;
        }
        if (t >= 1) {
            return 1;
        }
        return sampleY(solveU(t));
    };
}

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

export interface MotionRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Share of the screen that must be dragged before the player is fully mini. */
export const DRAG_FULL_RATIO = 0.6;
/** Share of the screen after which releasing dismisses the player. */
export const DISMISS_DISTANCE_RATIO = 0.25;
/** Downward fling speed (points/second) that dismisses regardless of distance. */
export const DISMISS_VELOCITY = 1000;

export function clamp(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) {
        return min;
    }
    return Math.min(max, Math.max(min, value));
}

export function lerp(from: number, to: number, progress: number): number {
    return from + (to - from) * clamp(progress, 0, 1);
}

/**
 * Transform that morphs `target` (the full-screen album cover) into `origin`
 * (the mini player artwork) and back.
 *
 * `progress` 0 = sitting exactly on top of the mini artwork, 1 = resting
 * layout. Only a uniform scale plus a translate is used, so the artwork keeps
 * its aspect ratio — the mini artwork and the full cover are both squares.
 */
export function coverMorphTransform(
    origin: MotionRect,
    target: MotionRect,
    progress: number,
) {
    const p = clamp(progress, 0, 1);
    const targetWidth = Math.max(1, target.width);
    const collapsedScale = Math.max(0.01, origin.width / targetWidth);
    const dx =
        origin.x + origin.width / 2 - (target.x + target.width / 2);
    const dy =
        origin.y + origin.height / 2 - (target.y + target.height / 2);

    return {
        translateX: dx * (1 - p),
        translateY: dy * (1 - p),
        scale: lerp(collapsedScale, 1, p),
    };
}

/**
 * Finger position → transition progress. Upward drags never collapse the
 * player, so the gesture cannot fight a scroll or a fling back to the top.
 */
export function dragProgress(translationY: number, screenHeight: number) {
    if (screenHeight <= 0 || translationY <= 0) {
        return 1;
    }
    return clamp(1 - translationY / (screenHeight * DRAG_FULL_RATIO), 0, 1);
}

export type DismissDecision = "dismiss" | "cancel";

export function dismissDecision(
    translationY: number,
    velocityY: number,
    screenHeight: number,
): DismissDecision {
    if (screenHeight <= 0) {
        return "cancel";
    }
    if (translationY / screenHeight > DISMISS_DISTANCE_RATIO) {
        return "dismiss";
    }
    if (velocityY > DISMISS_VELOCITY) {
        return "dismiss";
    }
    return "cancel";
}
