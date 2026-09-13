import FastImage from "@/components/base/fastImage";
import Icon, { IIconName } from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { showPanel } from "@/components/panels/usePanel";
import { ImgAsset } from "@/constants/assetsConst";
import { useI18N } from "@/core/i18n";
import { useMusicHistory } from "@/core/musicHistory";
import MusicSheet, { useSheetsBase, useStarredSheets } from "@/core/musicSheet";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Color from "color";
import React, { useMemo } from "react";
import DeviceInfo from "react-native-device-info";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";

type IQuickEntry = {
    key: string;
    icon: IIconName;
    title: string;
    description: string;
    accent: string;
    onPress: () => void;
};

export default function MyMusicOverview() {
    const colors = useColors();
    const { t } = useI18N();
    const navigate = useNavigate();
    const history = useMusicHistory();
    const sheets = useSheetsBase();
    const starredSheets = useStarredSheets();
    const version = DeviceInfo.getVersion();

    const favoriteSheet = useMemo(
        () =>
            sheets.find(sheet => sheet.id === MusicSheet.defaultSheet.id) ??
            sheets[0] ??
            null,
        [sheets],
    );
    const userSheets = useMemo(
        () => sheets.filter(sheet => sheet.id !== MusicSheet.defaultSheet.id),
        [sheets],
    );

    const quickEntries: IQuickEntry[] = [
        {
            key: "favorite",
            icon: "heart",
            title: t("home.favoriteSheet"),
            description: t("home.songCount", {
                count: favoriteSheet?.worksNum ?? 0,
            }),
            accent: "#FF6E91",
            onPress: () => {
                if (favoriteSheet) {
                    navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, {
                        id: favoriteSheet.id,
                    });
                }
            },
        },
        {
            key: "history",
            icon: "clock-outline",
            title: t("home.playHistory"),
            description: t("home.songCount", { count: history.length }),
            accent: "#4D7CFF",
            onPress: () => navigate(ROUTE_PATH.HISTORY),
        },
        {
            key: "downloads",
            icon: "arrow-down-tray",
            title: t("home.downloadManagement"),
            description: t("home.downloadManagementDescription"),
            accent: "#19C69F",
            onPress: () => navigate(ROUTE_PATH.DOWNLOADING),
        },
        {
            key: "starred",
            icon: "bookmark-square",
            title: t("home.starredPlaylists"),
            description: t("home.playlistCount", {
                count: starredSheets.length,
            }),
            accent: "#F7A719",
            onPress: () =>
                navigate(ROUTE_PATH.SHEET_BROWSER, { sheetType: "starred" }),
        },
    ];

    const playlistRows = [
        ...(favoriteSheet ? [favoriteSheet] : []),
        ...userSheets,
    ];
    const managementEntries: IQuickEntry[] = [
        {
            key: "backup",
            icon: "circle-stack",
            title: t("sidebar.backupAndResume"),
            description: t("settingsOverview.backupDescription"),
            accent: "#1ABAA5",
            onPress: () => navigate(ROUTE_PATH.SETTING, { type: "backup" }),
        },
        {
            key: "about",
            icon: "information-circle",
            title: t("home.aboutAndUpdate"),
            description: t("home.currentVersion", { version }),
            accent: "#337DF7",
            onPress: () => navigate(ROUTE_PATH.SETTING, { type: "about" }),
        },
    ];

    return (
        <View style={[styles.wrapper, { backgroundColor: colors.pageBackground }]}>
            <View style={styles.header}>
                <ThemeText fontSize="appbar" fontWeight="bolder">
                    {t("home.mine")}
                </ThemeText>
                <View style={styles.headerActions}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("common.setting")}
                        style={styles.headerAction}
                        onPress={() =>
                            navigate(ROUTE_PATH.SETTING, { type: "overview" })
                        }>
                        <Icon
                            name="cog-8-tooth"
                            size={rpx(34)}
                            color={colors.text}
                        />
                    </Pressable>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("home.aboutAndUpdate")}
                    style={[styles.profileCard, { backgroundColor: colors.card }]}
                    onPress={() => navigate(ROUTE_PATH.SETTING, { type: "about" })}>
                    <View
                        style={[
                            styles.avatarWrap,
                            {
                                backgroundColor: Color(colors.primary)
                                    .alpha(0.12)
                                    .toString(),
                            },
                        ]}>
                        <Image
                            source={ImgAsset.logo}
                            resizeMode="contain"
                            style={styles.avatar}
                        />
                    </View>
                    <View style={styles.profileText}>
                        <ThemeText fontSize="subTitle" fontWeight="bold">
                            Audiora
                        </ThemeText>
                        <ThemeText
                            fontSize="caption"
                            fontColor="textSecondary"
                            numberOfLines={1}
                            style={styles.profileDescription}>
                            {t("home.personalTagline")}
                        </ThemeText>
                    </View>
                    <Icon
                        name="arrow-long-left"
                        size={rpx(30)}
                        color={colors.textSecondary}
                        style={styles.forwardIcon}
                    />
                </Pressable>

                <View style={styles.quickGrid}>
                    {quickEntries.map(entry => (
                        <Pressable
                            key={entry.key}
                            accessibilityRole="button"
                            accessibilityLabel={entry.title}
                            style={[
                                styles.quickCard,
                                {
                                    backgroundColor: Color(entry.accent)
                                        .alpha(0.09)
                                        .toString(),
                                },
                            ]}
                            onPress={entry.onPress}>
                            <View
                                style={[
                                    styles.quickIcon,
                                    {
                                        backgroundColor: Color(entry.accent)
                                            .alpha(0.15)
                                            .toString(),
                                    },
                                ]}>
                                <Icon
                                    name={entry.icon}
                                    size={rpx(32)}
                                    color={entry.accent}
                                />
                            </View>
                            <View style={styles.quickText}>
                                <ThemeText
                                    fontSize="description"
                                    fontWeight="semibold"
                                    numberOfLines={1}>
                                    {entry.title}
                                </ThemeText>
                                <ThemeText
                                    fontSize="caption"
                                    fontColor="textSecondary"
                                    numberOfLines={1}
                                    style={styles.quickDescription}>
                                    {entry.description}
                                </ThemeText>
                            </View>
                        </Pressable>
                    ))}
                </View>

                <View style={[styles.managementCard, { backgroundColor: colors.card }]}>
                    {managementEntries.map((entry, index) => (
                        <Pressable
                            key={entry.key}
                            accessibilityRole="button"
                            accessibilityLabel={entry.title}
                            style={[
                                styles.managementRow,
                                index < managementEntries.length - 1
                                    ? {
                                        borderBottomColor: Color(colors.text)
                                            .alpha(0.07)
                                            .toString(),
                                        borderBottomWidth: StyleSheet.hairlineWidth,
                                    }
                                    : null,
                            ]}
                            onPress={entry.onPress}>
                            <View
                                style={[
                                    styles.managementIcon,
                                    {
                                        backgroundColor: Color(entry.accent)
                                            .alpha(0.14)
                                            .toString(),
                                    },
                                ]}>
                                <Icon name={entry.icon} size={rpx(30)} color={entry.accent} />
                            </View>
                            <View style={styles.managementText}>
                                <ThemeText fontSize="description" fontWeight="semibold" numberOfLines={1}>
                                    {entry.title}
                                </ThemeText>
                                <ThemeText fontSize="caption" fontColor="textSecondary" numberOfLines={1} style={styles.quickDescription}>
                                    {entry.description}
                                </ThemeText>
                            </View>
                            <Icon name="arrow-long-left" size={rpx(28)} color={colors.textSecondary} style={styles.forwardIcon} />
                        </Pressable>
                    ))}
                </View>

                <View style={styles.sectionHeader}>
                    <ThemeText fontSize="title" fontWeight="bold">
                        {t("home.myPlaylists")}
                    </ThemeText>
                    <View style={styles.sectionActions}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t("home.importPlaylist.a11y")}
                            style={styles.sectionAction}
                            onPress={() => showPanel("ImportMusicSheet")}>
                            <Icon name="inbox-arrow-down" size={rpx(28)} color={colors.text} />
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t("home.playById.a11y")}
                            style={styles.sectionAction}
                            onPress={() => showPanel("PlayById")}>
                            <Icon name="id" size={rpx(28)} color={colors.text} />
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t("home.newPlaylist.a11y")}
                            style={styles.sectionAction}
                            onPress={() => showPanel("CreateMusicSheet")}>
                            <Icon name="plus" size={rpx(28)} color={colors.text} />
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t("home.viewAll")}
                            style={styles.viewAllAction}
                            onPress={() =>
                                navigate(ROUTE_PATH.SHEET_BROWSER, {
                                    sheetType: "local",
                                })
                            }>
                            <ThemeText
                                fontSize="caption"
                                fontWeight="semibold"
                                color={colors.primary}>
                                {t("home.viewAll")}
                            </ThemeText>
                            <Icon
                                name="arrow-long-left"
                                size={rpx(22)}
                                color={colors.primary}
                                style={styles.forwardIcon}
                            />
                        </Pressable>
                    </View>
                </View>

                <View style={[styles.playlistCard, { backgroundColor: colors.card }]}>
                    {playlistRows.length ? (
                        playlistRows.map((sheet, index) => (
                            <Pressable
                                key={sheet.id}
                                style={[
                                    styles.playlistRow,
                                    index < playlistRows.length - 1
                                        ? {
                                            borderBottomColor: Color(colors.text)
                                                .alpha(0.07)
                                                .toString(),
                                            borderBottomWidth:
                                                StyleSheet.hairlineWidth,
                                        }
                                        : null,
                                ]}
                                onPress={() =>
                                    navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, {
                                        id: sheet.id,
                                    })
                                }>
                                <FastImage
                                    source={sheet.coverImg ?? sheet.artwork}
                                    placeholderSource={ImgAsset.albumDefault}
                                    style={styles.playlistCover}
                                />
                                <View style={styles.playlistText}>
                                    <ThemeText
                                        fontSize="description"
                                        fontWeight="semibold"
                                        numberOfLines={1}>
                                        {sheet.title ?? t("common.unknownName")}
                                    </ThemeText>
                                    <ThemeText
                                        fontSize="caption"
                                        fontColor="textSecondary"
                                        style={styles.playlistDescription}>
                                        {t("home.songCount", {
                                            count: sheet.worksNum ?? 0,
                                        })}
                                    </ThemeText>
                                </View>
                                <Icon
                                    name="arrow-long-left"
                                    size={rpx(28)}
                                    color={colors.textSecondary}
                                    style={styles.forwardIcon}
                                />
                            </Pressable>
                        ))
                    ) : (
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            style={styles.emptyText}>
                            {t("home.noCustomPlaylists")}
                        </ThemeText>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        width: "100%",
    },
    header: {
        height: rpx(92),
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    headerActions: {
        flexDirection: "row",
        alignItems: "center",
    },
    headerAction: {
        width: rpx(58),
        height: rpx(58),
        marginLeft: rpx(6),
        alignItems: "center",
        justifyContent: "center",
    },
    content: {
        paddingHorizontal: rpx(24),
        paddingBottom: rpx(40),
    },
    profileCard: {
        minHeight: rpx(112),
        borderRadius: rpx(22),
        paddingHorizontal: rpx(18),
        flexDirection: "row",
        alignItems: "center",
    },
    avatarWrap: {
        width: rpx(76),
        height: rpx(76),
        borderRadius: rpx(38),
        alignItems: "center",
        justifyContent: "center",
    },
    avatar: {
        width: rpx(58),
        height: rpx(58),
    },
    profileText: {
        flex: 1,
        minWidth: 0,
        marginHorizontal: rpx(16),
    },
    profileDescription: {
        marginTop: rpx(8),
    },
    forwardIcon: {
        transform: [{ rotate: "180deg" }],
    },
    quickGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginTop: rpx(18),
    },
    quickCard: {
        width: "48.5%",
        minHeight: rpx(106),
        borderRadius: rpx(18),
        padding: rpx(16),
        marginBottom: rpx(12),
        flexDirection: "row",
        alignItems: "center",
    },
    quickIcon: {
        width: rpx(56),
        height: rpx(56),
        borderRadius: rpx(18),
        alignItems: "center",
        justifyContent: "center",
    },
    quickText: {
        flex: 1,
        minWidth: 0,
        marginLeft: rpx(12),
    },
    quickDescription: {
        marginTop: rpx(6),
    },
    managementCard: {
        borderRadius: rpx(22),
        overflow: "hidden",
        marginTop: rpx(6),
    },
    managementRow: {
        minHeight: rpx(94),
        paddingHorizontal: rpx(16),
        flexDirection: "row",
        alignItems: "center",
    },
    managementIcon: {
        width: rpx(54),
        height: rpx(54),
        borderRadius: rpx(16),
        alignItems: "center",
        justifyContent: "center",
    },
    managementText: {
        flex: 1,
        minWidth: 0,
        marginHorizontal: rpx(14),
    },
    sectionHeader: {
        minHeight: rpx(64),
        marginTop: rpx(16),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    sectionActions: {
        flexDirection: "row",
        alignItems: "center",
    },
    sectionAction: {
        width: rpx(48),
        height: rpx(48),
        marginLeft: rpx(4),
        borderRadius: rpx(24),
        alignItems: "center",
        justifyContent: "center",
    },
    viewAllAction: {
        height: rpx(48),
        paddingHorizontal: rpx(8),
        marginLeft: rpx(4),
        flexDirection: "row",
        alignItems: "center",
    },
    playlistCard: {
        borderRadius: rpx(22),
        overflow: "hidden",
    },
    playlistRow: {
        minHeight: rpx(104),
        paddingHorizontal: rpx(16),
        flexDirection: "row",
        alignItems: "center",
    },
    playlistCover: {
        width: rpx(70),
        height: rpx(70),
        borderRadius: rpx(14),
    },
    playlistText: {
        flex: 1,
        minWidth: 0,
        marginHorizontal: rpx(14),
    },
    playlistDescription: {
        marginTop: rpx(8),
    },
    emptyText: {
        paddingVertical: rpx(34),
        textAlign: "center",
    },
});
