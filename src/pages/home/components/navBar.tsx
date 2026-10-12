import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import { useNavigation } from "@react-navigation/native";
import { showPanel } from "@/components/panels/usePanel";
import { controlSize, radius, spacing } from "@/constants/designSystem";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

export default function NavBar() {
    const navigation = useNavigation<any>();
    const colors = useColors();
    const { t } = useI18N();

    return (
        <View style={styles.appbar}>
            <View style={styles.titleRow}>
                <ThemeText fontSize="appbar" fontWeight="bolder">
                    {t("home.home")}
                </ThemeText>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("sidebar.scheduleClose")}
                    style={styles.roundButton}
                    onPress={() => showPanel("TimingClose")}>
                    <Icon name="alarm-outline" size={rpx(38)} color={colors.text} />
                </Pressable>
            </View>

            <Pressable
                style={[
                    styles.searchBar,
                    {
                        backgroundColor: colors.surface,
                    },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("home.clickToSearch")}
                onPress={() => navigation.navigate(ROUTE_PATH.SEARCH_PAGE)}>
                <Icon
                    name="magnifying-glass"
                    size={rpx(30)}
                    color={colors.textSecondary}
                />
                <ThemeText
                    fontSize="description"
                    fontColor="textSecondary"
                    numberOfLines={1}
                    style={styles.searchText}>
                    {t("home.clickToSearch")}
                </ThemeText>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    appbar: {
        width: "100%",
        paddingHorizontal: spacing.xxxl,
        paddingTop: spacing.xxs,
        backgroundColor: "transparent",
    },
    titleRow: {
        minHeight: Math.max(44, controlSize.minimumTouch),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    roundButton: {
        width: Math.max(44, controlSize.minimumTouch),
        height: Math.max(44, controlSize.minimumTouch),
        alignItems: "center",
        justifyContent: "center",
    },
    searchBar: {
        minHeight: Math.max(44, rpx(64)),
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        marginTop: spacing.xs,
        flexDirection: "row",
        alignItems: "center",
    },
    searchText: {
        flex: 1,
        minWidth: 0,
        marginLeft: spacing.sm,
    },
});
