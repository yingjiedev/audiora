import Color from "color";
import React, { ReactNode } from "react";
import {
    ActivityIndicator,
    GestureResponderEvent,
    Pressable,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from "react-native";

import Icon, { IIconName } from "@/components/base/icon";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";

/**
 * 圆形动作键。全仓库只有三种底色规则，新增圆钮必须落在其中一种：
 *
 * - `solid`：主色实底 + `onPrimary` 图标。给「这个视图里最强的那一个动作」
 *   （底部音乐栏的播放键）。同屏出现第二个 solid 会互相抢焦点。
 * - `inverse`：白底 + 深色图标 + 投影。只给压在图片 / 插画上的圆钮
 *   （首页 hero）。它刻意不跟随主题，两模式都是白底深图，所以写死并标
 *   `color-exempt`。
 * - `tonal`：主色 16% 底 + 主色图标。卡片内的次级动作（拾音卡的播放键），
 *   比 solid 轻一档，不会跟页面主动作抢视觉重心。
 *
 * 本组件只收敛「颜色规则 + 圆心几何」；圆钮直径仍然按场景传 `size`
 * （70 / 72 / 76 rpx 是三处历史值，不是同一套刻度，别强行统一）。
 */
export type IRoundActionVariant = "solid" | "inverse" | "tonal";

/** tonal 底的主色透明度：图标容器与 tonal 圆钮共用这一档。 */
export const TONAL_ALPHA = 0.16;

/** 默认直径（拾音卡的尾部播放键）。 */
export const DEFAULT_ROUND_ACTION_SIZE = rpx(70);

const INVERSE_BACKGROUND = "#FFFFFF"; // color-exempt: 压在图上，与主题无关，两模式恒为白底
const INVERSE_FOREGROUND = "#17213E"; // color-exempt: 白底上的深色图标，同上不跟随主题
const INVERSE_SHADOW = "#13244E"; // color-exempt: 仅 inverse 的投影，同上

/**
 * 圆钮上的前景色（文字 / 图标）取法：主色被调亮后白字只剩 2.9:1，统一按
 * onPrimary 的对比度结果取白或近黑。需要跟圆钮同色的叠加层（例如底部音乐栏
 * 的播放进度环）也调这个 hook，避免又长出一套规则。
 */
export function useRoundActionForeground() {
    const colors = useColors();
    return colors.onPrimary ?? "#FFFFFF"; // color-exempt: onPrimary 缺失时的兜底白
}

export interface IRoundActionButtonProps {
    variant: IRoundActionVariant;
    iconName: IIconName;
    /** 圆钮直径，默认 rpx(70) */
    size?: number;
    iconSize?: number;
    /** 图标的附加样式，例如播放三角的光学居中外补 */
    iconStyle?: StyleProp<ViewStyle>;
    /** 为 true 时用转圈替代图标，且不响应点击 */
    loading?: boolean;
    disabled?: boolean;
    hitSlop?: number;
    accessibilityLabel?: string;
    onPress?: (event: GestureResponderEvent) => void;
    style?: StyleProp<ViewStyle>;
    /** 图标下方的叠加层，例如底部音乐栏的播放进度环 */
    children?: ReactNode;
}

export default function RoundActionButton(props: IRoundActionButtonProps) {
    const {
        variant,
        iconName,
        size = DEFAULT_ROUND_ACTION_SIZE,
        iconSize = rpx(36),
        iconStyle,
        loading,
        disabled,
        hitSlop,
        accessibilityLabel,
        onPress,
        style,
        children,
    } = props;
    const colors = useColors();
    const foreground = useRoundActionForeground();

    let background: string;
    let iconColor: string;
    if (variant === "solid") {
        background = colors.primary;
        iconColor = foreground;
    } else if (variant === "inverse") {
        background = INVERSE_BACKGROUND;
        iconColor = INVERSE_FOREGROUND;
    } else {
        background = Color(colors.primary).alpha(TONAL_ALPHA).toString();
        iconColor = colors.primary;
    }

    // 图标也走绝对定位层：与 children 叠加层共用同一个圆心。图标如果作为
    // 流内子节点，在有叠加层（音乐栏进度环）的机器上实测会被顶出圆心，
    // 两层全部 absolute-fill 才能保证几何上锁死在同一个方框里。
    const body = (
        <>
            {children ? (
                <View style={styles.overlay} pointerEvents="none">
                    {children}
                </View>
            ) : null}
            {loading ? (
                <View style={styles.overlay} pointerEvents="none">
                    <ActivityIndicator size="small" color={iconColor} />
                </View>
            ) : (
                <View style={styles.overlay} pointerEvents="none">
                    <Icon
                        name={iconName}
                        size={iconSize}
                        color={iconColor}
                        style={iconStyle}
                    />
                </View>
            )}
        </>
    );

    const boxStyle = [
        styles.base,
        // 圆心几何：图标与叠加层共用同一个方框，不会各自偏移
        { width: size, height: size, borderRadius: size / 2 },
        { backgroundColor: background },
        variant === "inverse" ? styles.inverse : null,
        variant === "inverse" ? { shadowColor: INVERSE_SHADOW } : null,
        style,
    ];

    // 没有 onPress 时渲染成纯 View：卡片整块可点的场景里，内层 Pressable
    // 会抢走外层的点击。
    if (!onPress) {
        return <View style={boxStyle}>{body}</View>;
    }

    return (
        <Pressable
            // 没有名字的圆钮不给 button 角色，否则读屏只念"按钮"
            accessibilityRole={accessibilityLabel ? "button" : undefined}
            accessibilityLabel={accessibilityLabel}
            disabled={disabled || loading}
            hitSlop={hitSlop}
            onPress={onPress}
            style={boxStyle}>
            {body}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        alignItems: "center",
        justifyContent: "center",
    },
    overlay: {
        // RN 0.86 移除了 StyleSheet.absoluteFillObject，展开 undefined 会静默
        // 丢失 position（实机翻过车），这里显式写全，别再改回展开写法。
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
    },
    inverse: {
        shadowOffset: { width: 0, height: rpx(6) },
        shadowOpacity: 0.18,
        shadowRadius: rpx(10),
        elevation: 4,
    },
});
