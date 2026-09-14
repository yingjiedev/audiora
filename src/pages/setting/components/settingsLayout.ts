import rpx from "@/utils/rpx";

/**
 * 设置首页与所有子设置页共用的横向布局令牌。
 *
 * 之前子页各自手写 marginHorizontal / paddingHorizontal / maxWidth，
 * 导致同一套视觉在不同页面里出现多份不一致的实现，窄机型和横屏下
 * 右侧控件会顶出安全区。所有设置类页面都应该从这里取值，
 * 不要再用固定像素做补偿。
 */
export const settingsLayout = {
    /** 分组卡片距离屏幕安全区左右边缘的距离 */
    groupMargin: rpx(24),
    /** 分组卡片圆角 */
    cardRadius: rpx(16),
    /** 分组标题与卡片之间的间距 */
    titleGap: rpx(12),
    /** 设置行内容的左右内边距（卡片内的安全呼吸区） */
    rowPadding: rpx(24),
    /** 设置行最小高度 */
    rowMinHeight: rpx(92),
    /** 标题与右侧「当前值 / 控件」之间的间距 */
    valueGap: rpx(24),
    /** 右侧控件与层级箭头之间的间距 */
    trailingGap: rpx(12),
    /**
     * 右侧「当前值」最多能占的宽度。
     * 必须是百分比：用固定 rpx 在窄机型 / 横屏下会反过来把标题挤出卡片。
     */
    valueMaxWidth: "48%",
} as const;

export default settingsLayout;
