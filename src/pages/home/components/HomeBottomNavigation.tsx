import Icon, { IIconName } from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface INavigationItem {
    key: "home" | "library" | "music" | "settings";
    icon: IIconName;
    title: string;
    onPress: () => void;
}

/**
 * Main navigation stays in the home shell so the mini player sits directly
 * above it, while each destination keeps using the existing stack routes.
 */
export default function HomeBottomNavigation() {
    const colors = useColors();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { t } = useI18N();

    const items: INavigationItem[] = [
        {
            key: "home",
            icon: "home-outline",
            title: t("home.home"),
            onPress: () => undefined,
        },
        {
            key: "library",
            icon: "album-outline",
            title: t("home.musicLibrary"),
            onPress: () => navigation.navigate(ROUTE_PATH.LOCAL),
        },
        {
            key: "music",
            icon: "heart-outline",
            title: t("home.myMusic"),
            onPress: () =>
                navigation.navigate(ROUTE_PATH.SHEET_BROWSER, {
                    sheetType: "local",
                }),
        },
        {
            key: "settings",
            icon: "cog-8-tooth",
            title: t("common.setting"),
            onPress: () => navigation.openDrawer(),
        },
    ];

    return (
        <View
            style={[
                styles.wrapper,
                {
                    backgroundColor: colors.tabBar ?? colors.surface,
                    borderTopColor: colors.border,
                    paddingBottom: Math.max(insets.bottom, spacing.xs),
                },
            ]}>
            {items.map(item => {
                const selected = item.key === "home";
                const color = selected ? colors.primary : colors.textSecondary;

                return (
                    <Pressable
                        key={item.key}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        accessibilityLabel={item.title}
                        style={styles.item}
                        onPress={item.onPress}>
                        <Icon name={item.icon} size={rpx(38)} color={color} />
                        <ThemeText
                            fontSize="caption"
                            color={color}
                            fontWeight={selected ? "bold" : "regular"}
                            style={styles.label}>
                            {item.title}
                        </ThemeText>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        minHeight: rpx(112),
        paddingTop: rpx(12),
        borderTopWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
    },
    item: {
        minHeight: rpx(72),
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    label: {
        marginTop: rpx(4),
    },
});
