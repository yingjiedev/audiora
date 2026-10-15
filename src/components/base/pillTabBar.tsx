/**
 * Custom tab bar for use with react-native-tab-view v4+.
 *
 * TabBar no longer supports top-level `renderLabel`; its dual-opacity
 * label stack also breaks pill backgrounds. Use this component via
 * `renderTabBar={() => <PillTabBar ... />}` instead.
 */
import React, { memo } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from "react-native";
import Color from "color";
import rpx, { fontRpx } from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import { fontWeightConst } from "@/constants/uiConst";
import { buttonHeight, controlSize, radius, spacing } from "@/constants/designSystem";

const minimumTouch = Math.max(44, controlSize.minimumTouch);

export type PillTabRoute = {
    key: string;
    title?: string;
    /** 分栏计数，配合 `getBadge` 使用；不传默认取这个字段 */
    count?: number | string;
};

export type PillTabBarVariant = "pill" | "underline" | "compact";

interface IPillTabBarProps {
    routes: PillTabRoute[];
    index: number;
    onIndexChange: (index: number) => void;
    /** Compact chips provide a quieter second-level selector. Default: pill. */
    variant?: PillTabBarVariant;
    getTitle?: (route: PillTabRoute, index: number) => string;
    getAccessibilityLabel?: (route: PillTabRoute, index: number) => string;
    /**
     * 分栏计数徽标。返回 null / undefined / 0 时不显示。
     * issue #87：下载管理页的三个分栏都要带数量，否则用户看不出哪栏有内容。
     */
    getBadge?: (route: PillTabRoute, index: number) => number | string | null;
    style?: StyleProp<ViewStyle>;
    contentContainerStyle?: StyleProp<ViewStyle>;
}

function PillTabBar(props: IPillTabBarProps) {
    const {
        routes,
        index,
        onIndexChange,
        variant = "pill",
        getTitle,
        getAccessibilityLabel,
        getBadge,
        style,
        contentContainerStyle,
    } = props;
    const colors = useColors();
    const activeBg = Color(colors.primary).alpha(0.2).toString();
    const activeBorder = Color(colors.primary).alpha(0.5).toString();
    const compact = variant === "compact";

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.bar, style]}
            contentContainerStyle={[styles.barContent, compact && styles.compactBarContent, contentContainerStyle]}>
            {routes.map((route, routeIndex) => {
                const focused = routeIndex === index;
                const title =
                    getTitle?.(route, routeIndex) ?? route.title ?? route.key;
                const accessibilityLabel = getAccessibilityLabel?.(route, routeIndex) ?? title;
                const rawBadge = getBadge?.(route, routeIndex);
                const badge = rawBadge === 0 ? null : rawBadge;
                const badgeNode = badge ? (
                    <View
                        style={[
                            styles.badge,
                            focused
                                ? { backgroundColor: colors.primary }
                                : {
                                    backgroundColor: Color(colors.text)
                                        .alpha(0.12)
                                        .toString(),
                                },
                        ]}>
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.badgeText,
                                {
                                    color: focused ? colors.onPrimary : colors.textSecondary ?? colors.text,
                                },
                            ]}>
                            {badge}
                        </Text>
                    </View>
                ) : null;

                if (variant === "underline") {
                    return (
                        <Pressable
                            key={route.key}
                            accessibilityRole="tab"
                            accessibilityLabel={accessibilityLabel}
                            accessibilityState={{ selected: focused }}
                            onPress={() => onIndexChange(routeIndex)}
                            style={styles.underlineItem}>
                            <View style={styles.labelRow}>
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.underlineLabel,
                                        {
                                            fontWeight: focused
                                                ? fontWeightConst.bolder
                                                : fontWeightConst.medium,
                                            color: focused
                                                ? colors.active
                                                : colors.textSecondary ??
                                                  colors.text,
                                        },
                                    ]}>
                                    {title}
                                </Text>
                                {badgeNode}
                            </View>
                            <View
                                style={[
                                    styles.underlineIndicator,
                                    {
                                        backgroundColor: focused
                                            ? colors.active
                                            : "transparent",
                                    },
                                ]}
                            />
                        </Pressable>
                    );
                }

                return (
                    <Pressable
                        key={route.key}
                        accessibilityRole="tab"
                        accessibilityLabel={accessibilityLabel}
                        accessibilityState={{ selected: focused }}
                        onPress={() => onIndexChange(routeIndex)}
                        style={[styles.pillTarget, compact && styles.compactTarget]}>
                        <View pointerEvents="none" accessible={false} style={[
                            styles.pillItem,
                            compact && styles.compactItem,
                            focused && (compact ? { backgroundColor: colors.tonalSurface } : {
                                backgroundColor: activeBg,
                                borderColor: activeBorder,
                            }),
                        ]}>
                            <View style={styles.labelRow}>
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.pillLabel,
                                        compact && styles.compactLabel,
                                        {
                                            fontWeight: focused
                                                ? compact ? fontWeightConst.semibold : fontWeightConst.bolder
                                                : fontWeightConst.medium,
                                            color: focused
                                                ? colors.active
                                                : colors.textSecondary ?? colors.text,
                                        },
                                    ]}>
                                    {title}
                                </Text>
                                {badgeNode}
                            </View>
                        </View>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexGrow: 0,
        flexShrink: 0,
        backgroundColor: "transparent",
    },
    barContent: {
        paddingHorizontal: rpx(16),
        paddingTop: rpx(10),
        paddingBottom: rpx(6),
        alignItems: "center",
    },
    pillTarget: {
        minWidth: minimumTouch,
        minHeight: minimumTouch,
        marginHorizontal: rpx(4),
        maxWidth: rpx(220),
        alignItems: "center",
        justifyContent: "center",
    },
    pillItem: {
        minHeight: buttonHeight.compact,
        minWidth: buttonHeight.compact,
        maxWidth: "100%",
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "transparent",
    },
    pillLabel: {
        fontSize: fontRpx(26),
        textAlign: "center",
        flexShrink: 1,
        minWidth: 0,
    },
    compactBarContent: {
        paddingHorizontal: 0,
        paddingTop: 0,
        paddingBottom: 0,
        gap: spacing.sm,
    },
    compactTarget: {
        marginHorizontal: 0,
        maxWidth: rpx(280),
    },
    compactItem: {
        minHeight: 28,
        minWidth: 28,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.sm,
        borderWidth: 0,
    },
    compactLabel: {
        fontSize: fontRpx(24),
    },
    underlineItem: {
        minWidth: Math.max(minimumTouch, rpx(120)),
        minHeight: minimumTouch,
        maxWidth: rpx(200),
        paddingHorizontal: rpx(12),
        paddingTop: rpx(12),
        paddingBottom: rpx(8),
        alignItems: "center",
    },
    underlineLabel: {
        fontSize: fontRpx(28),
        textAlign: "center",
    },
    labelRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        maxWidth: "100%",
    },
    badge: {
        marginLeft: rpx(6),
        paddingHorizontal: rpx(8),
        paddingVertical: rpx(1),
        borderRadius: rpx(999),
        justifyContent: "center",
        alignItems: "center",
    },
    badgeText: {
        fontSize: fontRpx(20),
        fontWeight: fontWeightConst.bold,
        textAlign: "center",
    },
    underlineIndicator: {
        width: rpx(40),
        height: rpx(6),
        borderRadius: rpx(999),
        marginTop: rpx(10),
    },
});

export default memo(PillTabBar);
