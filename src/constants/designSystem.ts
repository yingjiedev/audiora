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

export const motion = {
    fast: 160,
    normal: 240,
    slow: 360,
} as const;

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
 * 这组和主题无关 —— 底图不跟随深浅主题 —— 所以只能是常量；集中放在这里，
 * 页面侧一律通过 useColors() 的 onMedia* 语义 token 引用，不再出现色值字面量。
 */
export const mediaOnDark = "#FFFFFF";
/** 沉浸层的压暗底色，用于顶部遮罩与分隔线 */
export const mediaScrim = "#050C1C";
