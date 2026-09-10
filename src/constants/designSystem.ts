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
