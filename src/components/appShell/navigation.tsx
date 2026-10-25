import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Icon, { IIconName } from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { HomeTab } from "@/core/homeNavigation";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";

export default function PrimaryNavigation(props: {
    width: number;
    top: number;
    selected: HomeTab | null;
    onSelect: (tab: HomeTab) => void;
    onSearch: () => void;
    onSettings: () => void;
}) {
    const colors = useColors();
    const { t } = useI18N();
    const expanded = props.width > 80;
    const destinations: Array<{ key: HomeTab; icon: IIconName; activeIcon: IIconName; title: string }> = [
        { key: "home", icon: "home-outline", activeIcon: "home-filled", title: t("home.home") },
        { key: "library", icon: "library-outline", activeIcon: "library-filled", title: t("home.musicLibrary") },
        { key: "mine", icon: "user", activeIcon: "user-filled", title: t("home.mine") },
    ];
    const action = (key: string, title: string, icon: IIconName, onPress: () => void, selected = false) => (
        <Pressable
            key={key}
            testID={`shell-navigation-${key}`}
            accessibilityRole={key === "search" || key === "settings" ? "button" : "tab"}
            accessibilityLabel={title}
            accessibilityState={{ selected }}
            onPress={onPress}
            style={({ pressed }) => [styles.item, expanded && styles.expandedItem, pressed && styles.pressed]}>
            <Icon name={icon} size={24} color={selected ? colors.active : colors.textSecondary} />
            <ThemeText numberOfLines={2} fontSize={expanded ? "content" : "caption"} color={selected ? colors.active : colors.textSecondary} fontWeight={selected ? "bold" : "regular"}>
                {title}
            </ThemeText>
        </Pressable>
    );
    return (
        <ScrollView style={[styles.navigation, { width: props.width, backgroundColor: colors.surface }]} contentContainerStyle={[styles.content, { paddingTop: props.top + 16 }]}>
            {expanded ? <ThemeText fontSize="title" fontWeight="bold" style={styles.brand}>Audiora</ThemeText> : null}
            <View accessibilityRole="tablist">
                {destinations.map(item => action(item.key, item.title, props.selected === item.key ? item.activeIcon : item.icon, () => props.onSelect(item.key), props.selected === item.key))}
            </View>
            {action("search", t("common.search"), "magnifying-glass", props.onSearch)}
            {action("settings", t("common.setting"), "cog-8-tooth", props.onSettings)}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    navigation: { flexGrow: 0, flexShrink: 0 },
    content: { paddingHorizontal: 8, paddingBottom: 16 },
    brand: { marginHorizontal: 16, marginBottom: 24 },
    item: { minHeight: 64, paddingVertical: 8, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", gap: 4 },
    expandedItem: { flexDirection: "row", justifyContent: "flex-start", paddingHorizontal: 16, gap: 16 },
    pressed: { opacity: 0.65 },
});
