import React, { memo } from "react";
import { StyleSheet, Text, View, StyleProp, ViewStyle } from "react-native";
import rpx, { fontRpx } from "@/utils/rpx";
import useColors from "@/hooks/useColors";

export type BadgeType = "quality" | "vip" | "source" | "hires" | "master" | "atmos" | "flac24bit";

interface IBadgeProps {
    type?: BadgeType;
    children: string;
    style?: StyleProp<ViewStyle>;
}

function Badge(props: IBadgeProps) {
    const { type = "quality", children, style } = props;
    const colors = useColors();
    // The label carries the factual quality/VIP meaning; its treatment follows the app theme.
    const foreground = type === "source" ? colors.textSecondary : colors.onTonal;
    const background = type === "source" ? colors.surface : colors.tonalSurface;

    return (
        <View
            style={[
                styles.badge,
                {
                    borderColor: colors.border,
                    backgroundColor: background,
                },
                style,
            ]}>
            <Text style={[styles.text, { color: foreground }]}>
                {children}
            </Text>
        </View>
    );
}

export default memo(Badge);

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: rpx(6),
        paddingVertical: rpx(1),
        borderRadius: rpx(4),
        borderWidth: 0.5,
        marginRight: rpx(6),
        justifyContent: "center",
        alignItems: "center",
    },
    text: {
        fontSize: fontRpx(16),
        fontWeight: "500",
    },
});
