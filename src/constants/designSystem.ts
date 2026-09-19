import rpx from "@/utils/rpx";

/** Shared Audiora layout tokens. Keep business screens on one visual rhythm. */
export const spacing = {
    xxs: rpx(4),
    xs: rpx(8),
    sm: rpx(12),
    md: rpx(16),
    lg: rpx(20),
    xl: rpx(24),
    xxl: rpx(32),
    xxxl: rpx(40),
} as const;

export const radius = {
    xs: rpx(8),
    sm: rpx(12),
    md: rpx(16),
    lg: rpx(22),
    xl: rpx(28),
    sheet: rpx(36),
    pill: rpx(999),
} as const;

export const controlSize = {
    compact: rpx(40),
    minimumTouch: rpx(88),
    standard: rpx(96),
    hero: rpx(112),
} as const;

export const audioraGradient = [
    "#00DDB5",
    "#00BDF2",
    "#3B82F6",
    "#6366F1",
    "#B26EF3",
] as const;

export const topListGradients = [
    ["#00DDB5", "#3B82F6"],
    ["#00BDF2", "#6366F1"],
    ["#3B82F6", "#B26EF3"],
    ["#22C7A9", "#667EEA"],
    ["#4F7DFF", "#D16BA5"],
] as const;

/**
 * Motion tokens — the single source of truth for every animation in the app.
 *
 * Durations are grouped by how much of the screen the motion covers, easings
 * follow the Material 3 emphasis set, and springs are split into `spatial`
 * (position/size, may overshoot) and `effects` (color/opacity, never
 * overshoots). Components must never hardcode a duration or easing: import
 * `timingConfig` from `@/constants/commonConst` or use `useMotion()`.
 */
export const motion = {
    duration: {
        /** Opacity-only feedback: press states, color swaps. */
        micro: 120,
        /** Small components: switches, buttons, inline swaps. */
        fast: 160,
        /** Contained motion: panels, sheets, cards. */
        normal: 240,
        /** Large surfaces and multi-step transitions. */
        slow: 360,
        /** Full-screen transitions. */
        screen: 320,
    },
    /** cubic-bezier(x1, y1, x2, y2) — kept as data so this file stays dependency-free. */
    easing: {
        standard: [0.2, 0, 0, 1],
        /** Entering the screen: fast start, long settle. */
        decelerate: [0.05, 0.7, 0.1, 1],
        /** Leaving the screen: slow start, fast exit. */
        accelerate: [0.3, 0, 0.8, 0.15],
        /** Starts and ends on screen (container transform). */
        emphasized: [0.2, 0, 0, 1],
    },
    spring: {
        /** Position / size / rotation — allowed to overshoot. */
        spatial: {
            stiffness: 200,
            damping: 26,
            mass: 1,
        },
        /** Color / opacity — must never overshoot past the target value. */
        effects: {
            stiffness: 300,
            damping: 30,
            mass: 1,
        },
    },
} as const;

export type MotionDuration = keyof typeof motion.duration;
export type MotionEasing = keyof typeof motion.easing;
export type MotionSpring = keyof typeof motion.spring;
