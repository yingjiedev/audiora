import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import React, { ReactNode } from "react";
import {
    Pressable,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from "react-native";
import { settingsLayout } from "./settingsLayout";

interface ISettingRowProps {
    /** 左侧主标题 */
    title: ReactNode;
    /** 标题下方的次要说明 */
    description?: ReactNode;
    /** 右侧「当前值」文本：超过可用宽度自动省略，不会挤压标题 */
    value?: ReactNode;
    /** 右侧控件（开关、按钮等）：不参与收缩，始终完整显示 */
    right?: ReactNode;
    onPress?: () => void;
    onLongPress?: () => void;
    /** 是否显示层级箭头，默认不显示 */
    showChevron?: boolean;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
    /** 行内左右内边距，默认 settingsLayout.rowPadding */
    paddingHorizontal?: number;
}

/**
 * 设置首页 / 子设置页统一使用的一行。
 *
 * 布局契约（这是子页右侧内容被裁切的根因，改这里的时候不要破坏）：
 * 1. 标题区 flex:1 + minWidth:0，可无限收缩；
 * 2. 值文本 flexShrink:1 + maxWidth 百分比，超长时自己省略；
 * 3. 控件 flexShrink:0 + maxWidth 百分比，永远完整留在卡片内；
 * 4. 箭头 flexShrink:0，永远不被挤掉。
 *
 * RN 的 flexShrink 默认是 0，所以第 2、3 条必须显式写出来，
 * 只靠 flex:1 是拦不住右侧内容溢出的。
 */
export default function SettingRow(props: ISettingRowProps) {
    const {
        accessibilityLabel,
        description,
        onLongPress,
        onPress,
        paddingHorizontal,
        right,
        showChevron = false,
        style,
        title,
        value,
    } = props;
    const colors = useColors();

    const hasValue =
        value !== undefined && value !== null && value !== "";

    const padding = paddingHorizontal ?? settingsLayout.rowPadding;

    return (
        <Pressable
            accessibilityRole={onPress ? "button" : undefined}
            accessibilityLabel={accessibilityLabel}
            android_ripple={
                onPress && colors.listActive
                    ? { color: colors.listActive }
                    : undefined
            }
            onPress={onPress}
            onLongPress={onLongPress}
            style={({ pressed }) => [
                styles.row,
                { paddingHorizontal: padding },
                style,
                pressed && onPress ? styles.pressed : null,
            ]}>
            <View style={styles.content}>
                <ThemeText numberOfLines={2}>{title}</ThemeText>
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
            {hasValue ? (
                <ThemeText
                    fontColor="textSecondary"
                    numberOfLines={1}
                    style={styles.value}>
                    {value}
                </ThemeText>
            ) : null}
            {right ? <View style={styles.control}>{right}</View> : null}
            {showChevron ? (
                <Icon
                    name="chevron-right"
                    size={rpx(28)}
                    color={colors.textSecondary}
                    style={styles.chevron}
                />
            ) : null}
        </Pressable>
    );
}

/**
 * 供 right 插槽里的文本复用。
 * 子页里有些「当前值」是自定义 JSX（例如 createRadio 生成的选项值），
 * 套上这个样式才能获得和 value 一致的收缩 / 省略行为。
 */
export const settingValueTextStyle = StyleSheet.create({
    text: {
        textAlignVertical: "center",
        flexShrink: 1,
    },
}).text;

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: settingsLayout.rowMinHeight,
    },
    content: {
        flex: 1,
        minWidth: 0,
        flexShrink: 1,
    },
    description: {
        marginTop: rpx(4),
    },
    value: {
        flexShrink: 1,
        marginLeft: settingsLayout.valueGap,
        maxWidth: settingsLayout.valueMaxWidth,
    },
    control: {
        flexShrink: 0,
        marginLeft: settingsLayout.valueGap,
        maxWidth: settingsLayout.valueMaxWidth,
    },
    chevron: {
        flexShrink: 0,
        marginLeft: settingsLayout.trailingGap,
        opacity: 0.45,
    },
    pressed: {
        opacity: 0.68,
    },
});
