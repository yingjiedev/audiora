/**
 * Pure geometry / gesture math for the Mini ↔ Full player transition.
 *
 * Deliberately dependency-free: the animation layer only feeds numbers in and
 * applies numbers out, so the interesting behaviour (interrupt thresholds,
 * shared-element geometry) is unit-testable without a Reanimated runtime.
 */

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
