export type HomeFeatureAppearance = "window" | "record";

/** Draw once per homepage mount. Music updates and scrolling do not draw again. */
export function pickHomeFeatureAppearance(sample = Math.random()): HomeFeatureAppearance {
    return Number.isFinite(sample) && sample >= 0.5 ? "record" : "window";
}

/** A smooth, reversible finger-driven turn, shared by paper, print and corners. */
export function homeFoldProgress(offset: number, distance: number) {
    "worklet";
    const progress = Math.max(0, Math.min(1, distance > 0 ? offset / distance : 0));
    return progress * progress * (3 - 2 * progress);
}
