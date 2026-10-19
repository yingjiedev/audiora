import React from "react";
import { Pressable, StyleSheet, TextInputProps, View } from "react-native";
import Input from "./input";
import Icon from "./icon";
import { controlSize, radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
interface ISearchFieldProps extends TextInputProps { value: string; onClear: () => void; }
export default function SearchField({ onClear, ...props }: ISearchFieldProps) {
    const colors = useColors();
    const { t } = useI18N();
    return <View style={[styles.wrapper, { backgroundColor: colors.surface }]}>
        <Icon name="magnifying-glass" size={rpx(30)} color={colors.textSecondary} />
        <Input {...props} hasHorizontalPadding={false} returnKeyType="search" placeholderTextColor={colors.textSecondary} fontColor={colors.text} style={[styles.input, props.style]} />
        {props.value.length ? <Pressable accessibilityRole="button" accessibilityLabel={t("common.clear")} onPress={onClear} style={styles.clear}><Icon name="x-mark" size={rpx(26)} color={colors.textSecondary} /></Pressable> : null}
    </View>;
}
const minimumTouch = Math.max(44, controlSize.minimumTouch);
const styles = StyleSheet.create({
    wrapper: { flex: 1, minWidth: 0, minHeight: minimumTouch, flexDirection: "row", alignItems: "center", borderRadius: radius.pill, paddingLeft: spacing.md, paddingRight: spacing.xxs, gap: spacing.xs },
    input: { flex: 1, minWidth: 0, minHeight: minimumTouch, paddingVertical: spacing.xs },
    clear: { minWidth: minimumTouch, minHeight: minimumTouch, alignItems: "center", justifyContent: "center" },
});
