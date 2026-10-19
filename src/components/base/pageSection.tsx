import React, { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Icon, { IIconName } from "./icon";
import ThemeText from "./themeText";
import { buttonHeight, controlSize, radius, spacing } from "@/constants/designSystem";
import useColors from "@/hooks/useColors";
import rpx, { fontRpx } from "@/utils/rpx";

const minimumTouch = Math.max(44, controlSize.minimumTouch);

export function PageAction({ title, icon, onPress, disabled = false, variant = "tonal", size = "compact", fullWidth = false, textColor, allowFontScaling }: {
    title: string;
    icon?: IIconName;
    onPress: () => void;
    disabled?: boolean;
    variant?: "primary" | "tonal" | "danger" | "text";
    size?: keyof typeof buttonHeight;
    fullWidth?: boolean;
    /** Match text actions to their actual surface, such as a custom app bar. */
    textColor?: string;
    allowFontScaling?: boolean;
}) {
    const colors = useColors();
    const backgroundColor = variant === "text" ? "transparent" : variant === "primary" ? colors.primary : variant === "danger" ? colors.dangerSurface : colors.tonalSurface;
    const foreground = variant === "text" ? textColor ?? colors.primaryText : variant === "primary" ? colors.onPrimary : variant === "danger" ? colors.danger : colors.onTonal;
    return (
        <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled}
            onPress={onPress} style={({ pressed }) => [styles.actionTarget, fullWidth && styles.fullWidth, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}>
            <View pointerEvents="none" accessible={false} style={[styles.action, size === "standard" && styles.standardAction, fullWidth && styles.fullWidth, { backgroundColor }]}>
                {icon ? <Icon name={icon} size={fontRpx(28)} color={foreground} /> : null}
                <ThemeText fontSize="description" fontWeight="medium" color={foreground} allowFontScaling={allowFontScaling ?? (variant === "text")} style={styles.actionText}>{title}</ThemeText>
            </View>
        </Pressable>
    );
}

export function PageSummary({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
    return (
        <View style={styles.summary}>
            <View style={styles.summaryText}>
                <ThemeText fontSize="title" fontWeight="semibold">{title}</ThemeText>
                {description ? <ThemeText fontSize="description" fontColor="textSecondary" style={styles.description}>{description}</ThemeText> : null}
            </View>
            {action}
        </View>
    );
}

export function PageState({ title, description, icon = "musical-note", action, tone = "neutral" }: {
    title: string;
    description?: string;
    icon?: IIconName;
    action?: ReactNode;
    tone?: "neutral" | "danger";
}) {
    const colors = useColors();
    return (
        <View style={styles.state}>
            <View style={[styles.stateIcon, { backgroundColor: tone === "danger" ? colors.dangerSurface : colors.tonalSurface }]}><Icon name={icon} size={rpx(44)} color={tone === "danger" ? colors.danger : colors.onTonal} /></View>
            <ThemeText fontSize="subTitle" fontWeight="medium" style={styles.center}>{title}</ThemeText>
            {description ? <ThemeText fontSize="description" fontColor="textSecondary" style={styles.center}>{description}</ThemeText> : null}
            {action}
        </View>
    );
}

const styles = StyleSheet.create({
    actionTarget: { minWidth: minimumTouch, minHeight: minimumTouch, maxWidth: "100%", flexShrink: 1, alignSelf: "center", alignItems: "center", justifyContent: "center" },
    action: { minHeight: buttonHeight.compact, minWidth: buttonHeight.compact, maxWidth: "100%", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xxs },
    standardAction: { minHeight: buttonHeight.standard, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },
    fullWidth: { width: "100%", alignSelf: "stretch" },
    actionText: { flexShrink: 1, textAlign: "center" },
    summary: { paddingHorizontal: spacing.xxxl, paddingTop: spacing.lg, paddingBottom: spacing.lg, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md },
    summaryText: { flex: 1, minWidth: rpx(180) },
    description: { marginTop: spacing.xs },
    state: { width: "100%", minHeight: rpx(360), paddingHorizontal: spacing.xxxl, paddingVertical: spacing.xxl, alignItems: "center", justifyContent: "center", gap: spacing.md },
    stateIcon: { width: minimumTouch, height: minimumTouch, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
    center: { textAlign: "center" },
});
