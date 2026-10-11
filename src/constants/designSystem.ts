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

export { audioraGradient, topListGradients } from "./colorPalette";

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

/**
 * 层级阴影。同一类浮层（贴地卡片 / 常驻浮条）在所有页面共用一套值，
 * 避免逐页手调导致「两个相邻卡片看起来是同一层」。
 *
 * 只描述几何，颜色交给 colors.shadow，深浅主题各自取色。
 */
export const elevation = {
    /** 贴地：列表项、内容卡片 */
    low: {
        shadowOffset: { width: 0, height: rpx(4) },
        shadowOpacity: 0.08,
        shadowRadius: rpx(10),
        elevation: 2,
    },
    /** 抬起：吸附在内容之上的常驻面板 */
    mid: {
        shadowOffset: { width: 0, height: rpx(6) },
        shadowOpacity: 0.14,
        shadowRadius: rpx(18),
        elevation: 6,
    },
    /** 悬浮：Mini Player 这类压在一切内容之上的层 */
    high: {
        shadowOffset: { width: 0, height: rpx(12) },
        shadowOpacity: 0.22,
        shadowRadius: rpx(26),
        elevation: 12,
    },
} as const;

/**
 * 沉浸层（播放页底图永远是压暗后的封面）上的中性前景色。
 *
 * 这组和主题无关 —— 底图不跟随深浅主题 —— 所以集中在 colorPalette，
 * 页面侧一律通过 useColors() 的 onMedia* 语义 token 引用，不再出现色值字面量。
 */
export { mediaOnDark, mediaScrim } from "./colorPalette";
