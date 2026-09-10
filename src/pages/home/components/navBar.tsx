import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import { useNavigation } from "@react-navigation/native";
import { showPanel } from "@/components/panels/usePanel";
import Color from "color";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

export default function NavBar() {
    const navigation = useNavigation<any>();
    const colors = useColors();
    const { t } = useI18N();

    return (
        <View style={styles.appbar}>
            <View style={styles.titleRow}>
                <View style={styles.tabs}>
                    <View style={styles.activeTab}>
                        <ThemeText fontSize="appbar" fontWeight="bolder">
                            {t("home.recommend")}
                        </ThemeText>
                        <View
                            style={[
                                styles.activeLine,
                                { backgroundColor: colors.accentCool },
                            ]}
                        />
                    </View>
                    <Pressable
                        style={styles.tabButton}
                        onPress={() => navigation.navigate(ROUTE_PATH.TOP_LIST)}>
                        <ThemeText
                            fontSize="title"
                            fontWeight="semibold"
                            fontColor="textSecondary">
                            {t("home.discovery")}
                        </ThemeText>
                    </Pressable>
                </View>
                <Pressable
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
                        backgroundColor: Color(colors.primary)
                            .alpha(0.07)
                            .toString(),
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
                <Icon
                    name="crosshair"
                    size={rpx(31)}
                    color={colors.textSecondary}
                />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    appbar: {
        width: "100%",
        height: rpx(170),
        paddingHorizontal: rpx(24),
        paddingTop: rpx(4),
        backgroundColor: "transparent",
    },
    titleRow: {
        height: rpx(84),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    tabs: {
        flexDirection: "row",
        alignItems: "center",
    },
    activeTab: {
        alignItems: "flex-start",
        justifyContent: "center",
    },
    tabButton: {
        minHeight: rpx(64),
        marginLeft: rpx(28),
        justifyContent: "center",
    },
    activeLine: {
        width: rpx(54),
        height: rpx(6),
        marginTop: rpx(2),
        borderRadius: rpx(3),
    },
    roundButton: {
        width: rpx(64),
        height: rpx(64),
        borderRadius: rpx(32),
        alignItems: "center",
        justifyContent: "center",
    },
    searchBar: {
        height: rpx(64),
        paddingHorizontal: rpx(20),
        borderRadius: rpx(32),
        flexDirection: "row",
        alignItems: "center",
    },
    searchText: {
        flex: 1,
        minWidth: 0,
        marginHorizontal: rpx(12),
    },
});
