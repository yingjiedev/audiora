import Color from "color";
import React, { ReactNode } from "react";
import {
    Pressable,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from "react-native";

import ThemeText from "@/components/base/themeText";
import { radius } from "@/constants/designSystem";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";

/**
 * 横向信息卡：左侧图标 + 标题 + 可选副标题 + 可选尾部插槽。
 *
 * 卡片壳的尺寸（minHeight / 圆角 / 边框 / 左右内边距）在这里收敛成一组
 * token，使用方不要再各写一份 —— 之前拾音卡和已删除的 ActionButton 各自
 * 维护了一套差 12rpx 高、2rpx 圆角的值，改一处就会漏另一处。
 */
const CARD_MIN_HEIGHT = rpx(116);
const CARD_PADDING_HORIZONTAL = rpx(18);
const CARD_BORDER_WIDTH = StyleSheet.hairlineWidth;
const LEADING_GAP = rpx(16);
const TRAILING_GAP = rpx(14);

export interface ICardRowProps {
    /** 左侧图标区，通常是 tonal 底的图标容器 */
    leading?: ReactNode;
    title: string;
    /** 标题下方的副标题，单行截断 */
    description?: string;
    /** 尾部插槽，例如拾音卡的播放键 */
    trailing?: ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
}

export default function CardRow(props: ICardRowProps) {
    const {
        leading,
        title,
        description,
        trailing,
        onPress,
        disabled,
        accessibilityLabel,
        style,
    } = props;
    const colors = useColors();

    const body = (
        <>
            {leading}
            <View style={styles.textBlock}>
                <ThemeText
                    numberOfLines={1}
                    fontSize="subTitle"
                    fontWeight="bold">
                    {title}
                </ThemeText>
                {description ? (
                    <ThemeText
                        numberOfLines={1}
                        fontSize="description"
                        fontColor="textSecondary"
                        style={styles.description}>
                        {description}
                    </ThemeText>
                ) : null}
            </View>
            {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        </>
    );

    const cardStyle = [
        styles.wrapper,
        {
            backgroundColor: colors.card,
            borderColor: Color(colors.text).alpha(0.06).toString(),
        },
        style,
    ];

    if (!onPress) {
        return <View style={cardStyle}>{body}</View>;
    }

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            disabled={disabled}
            onPress={onPress}
            style={cardStyle}>
            {body}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        minHeight: CARD_MIN_HEIGHT,
        borderRadius: radius.lg,
        borderWidth: CARD_BORDER_WIDTH,
        paddingHorizontal: CARD_PADDING_HORIZONTAL,
        flexDirection: "row",
        alignItems: "center",
    },
    textBlock: {
        flex: 1,
        minWidth: 0,
        marginLeft: LEADING_GAP,
    },
    description: {
        marginTop: rpx(8),
    },
    trailing: {
        marginLeft: TRAILING_GAP,
    },
});
