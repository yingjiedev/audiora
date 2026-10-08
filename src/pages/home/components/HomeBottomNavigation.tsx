import Icon, { IIconName } from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { elevation, radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface INavigationItem {
    key: "home" | "library" | "mine";
    /** 未选中态：描边图标 */
    icon: IIconName;
    /** 选中态：同形状的实心图标，和描边版构成「形状 + 颜色」双通道 */
    activeIcon: IIconName;
    title: string;
    onPress: () => void;
}

/**
 * 导航条图标尺寸。选中态用「实心图标 + 主色加粗文字」两路表达，
 * 不再画指示器底色（盖住图标的胶囊在实际观感上很突兀）。
 */
const ICON_SIZE = rpx(38);

/**
 * Main navigation stays in the home shell so the mini player sits directly
 * above it and each primary destination keeps its bottom navigation visible.
 */
export default function HomeBottomNavigation(props: {
    activeTab: "home" | "library" | "mine";
    onSelectHome: () => void;
    onSelectLibrary: () => void;
    onSelectMine: () => void;
}) {
    const { activeTab, onSelectHome, onSelectLibrary, onSelectMine } = props;
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { t } = useI18N();

    const items: INavigationItem[] = [
        {
            key: "home",
            icon: "home-outline",
            activeIcon: "home-filled",
            title: t("home.home"),
            onPress: onSelectHome,
        },
        {
            key: "library",
            // 音乐库的通用语义是「库 / 集合」，同心圆的 album-outline 更像单张专辑。
            icon: "library-outline",
            activeIcon: "library-filled",
            title: t("home.musicLibrary"),
            onPress: onSelectLibrary,
        },
        {
            key: "mine",
            icon: "user",
            activeIcon: "user-filled",
            title: t("home.mine"),
            onPress: onSelectMine,
        },
    ];

    return (
        <View
            accessibilityRole="tablist"
            style={[
                styles.wrapper,
                {
                    backgroundColor: colors.tabBar ?? colors.surface,
                    paddingBottom: Math.max(insets.bottom, spacing.xs),
                    shadowColor: colors.shadow ?? colors.text,
                },
                elevation.mid,
            ]}>
            {items.map(item => {
                const selected = item.key === activeTab;
                const color = selected ? colors.primary : colors.textSecondary;

                return (
                    <Pressable
                        key={item.key}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        accessibilityLabel={item.title}
                        style={styles.item}
                        onPress={item.onPress}>
                        <Icon
                            name={selected ? item.activeIcon : item.icon}
                            size={ICON_SIZE}
                            color={color}
                        />
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
        flexDirection: "row",
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
    },
    item: {
        minHeight: rpx(88),
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    label: {
        marginTop: rpx(6),
    },
});
