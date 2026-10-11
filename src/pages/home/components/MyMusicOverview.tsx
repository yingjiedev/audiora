import FastImage from "@/components/base/fastImage";
import Icon, { IIconName } from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { showPanel } from "@/components/panels/usePanel";
import { ImgAsset } from "@/constants/assetsConst";
import { controlSize, radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { useMusicHistory } from "@/core/musicHistory";
import MusicSheet, { useSheetItem, useSheetsBase, useStarredSheets } from "@/core/musicSheet";
import { usePluginDisplayNameResolver, usePlugins } from "@/core/pluginManager";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import TrackPlayer from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import rpx, { fontRpx } from "@/utils/rpx";
import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import DeviceInfo from "react-native-device-info";
import { getRecentPageLayout } from "./myMusicLayout";

const RECENT_PREVIEW_LIMIT = 6;
const minimumTouch = Math.max(44, controlSize.minimumTouch);
const recentTitleLineHeight = fontRpx(26) * 1.35;

type QuickEntry = {
    key: string;
    icon: IIconName;
    title: string;
    description: string;
    hint?: string;
    onPress: () => void;
};

export default function MyMusicOverview() {
    const colors = useColors();
    const { t } = useI18N();
    const navigate = useNavigate();
    const history = useMusicHistory();
    const sheets = useSheetsBase();
    const starredSheets = useStarredSheets();
    const plugins = usePlugins();
    const favoriteSheet = sheets.find(sheet => sheet.id === MusicSheet.defaultSheet.id);
    const favoriteContents = useSheetItem(MusicSheet.defaultSheet.id);
    const favoriteCover = favoriteSheet?.coverImg || favoriteSheet?.artwork
        || favoriteContents.musicList?.find(music => music.artwork?.trim())?.artwork;
    const userSheets = sheets.filter(sheet => sheet.id !== MusicSheet.defaultSheet.id);
    const version = DeviceInfo.getVersion();
    const previewBase = /^(\d+\.\d+\.\d+)-preview(?:\.|$)/.exec(version)?.[1];
    const openHistory = () => showPanel("PlayList", { initialTab: "history" });
    const quickEntries: QuickEntry[] = [
        {
            key: "history",
            icon: "clock-outline",
            title: t("home.playHistory"),
            description: t("home.songCount", { count: history.length }),
            onPress: openHistory,
        },
        {
            key: "downloads",
            icon: "arrow-down-tray",
            title: t("home.downloadManagement"),
            description: t("myMusic.downloadsHint"),
            hint: t("home.downloadManagementDescription"),
            onPress: () => navigate(ROUTE_PATH.DOWNLOADING),
        },
        {
            key: "starred",
            icon: "bookmark-square",
            title: t("home.starredPlaylists"),
            description: t("home.playlistCount", { count: starredSheets.length }),
            onPress: () => navigate(ROUTE_PATH.SHEET_BROWSER, { sheetType: "starred" }),
        },
        {
            key: "plugins",
            icon: "code-bracket-square",
            title: t("sidebar.pluginManagement"),
            description: t("myMusic.pluginCount", { count: plugins.length }),
            hint: t("settingsOverview.sourceDescription"),
            onPress: () => navigate(ROUTE_PATH.SETTING, { type: "plugin" }),
        },
    ];
    const playlistActions: QuickEntry[] = [
        {
            key: "import",
            icon: "inbox-arrow-down",
            title: t("home.import.short"),
            description: t("home.importPlaylist.a11y"),
            onPress: () => showPanel("ImportMusicSheet"),
        },
        {
            key: "id",
            icon: "id",
            title: t("home.playById.short"),
            description: t("home.playById.a11y"),
            onPress: () => showPanel("PlayById"),
        },
        {
            key: "create",
            icon: "plus",
            title: t("myMusic.createPlaylist"),
            description: t("home.newPlaylist.a11y"),
            onPress: () => showPanel("CreateMusicSheet"),
        },
    ];
    const managementEntries: QuickEntry[] = [
        {
            key: "backup",
            icon: "circle-stack",
            title: t("sidebar.backupAndResume"),
            description: t("settingsOverview.backupDescription"),
            onPress: () => navigate(ROUTE_PATH.SETTING, { type: "backup" }),
        },
        {
            key: "about",
            icon: "information-circle",
            title: t("home.aboutAndUpdate"),
            description: previewBase ? t("myMusic.previewVersion", { version: previewBase }) : t("home.currentVersion", { version }),
            hint: t("home.currentVersion", { version }),
            onPress: () => navigate(ROUTE_PATH.SETTING, { type: "about" }),
        },
    ];

    return (
        <View style={[styles.wrapper, { backgroundColor: colors.pageBackground }]}>
            <View style={styles.header}>
                <View style={styles.headerTitle}>
                    <ThemeText fontSize="appbar" fontWeight="bold">{t("home.mine")}</ThemeText>
                    <View style={styles.brandMark} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                        <Image source={ImgAsset.logo} resizeMode="contain" style={styles.logo} accessible={false} />
                        <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.inlineLabel}>Audiora</ThemeText>
                    </View>
                </View>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("common.setting")}
                    style={({ pressed }) => [styles.headerAction, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => navigate(ROUTE_PATH.SETTING, { type: "overview" })}>
                    <Icon name="cog-8-tooth" size={rpx(36)} color={colors.text} />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("home.favoriteSheet")}
                    accessibilityHint={t("home.songCount", { count: favoriteSheet?.worksNum ?? 0 })}
                    accessibilityState={{ disabled: !favoriteSheet }}
                    disabled={!favoriteSheet}
                    style={({ pressed }) => [styles.favoriteEntry, { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => {
                        if (favoriteSheet) navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, { id: favoriteSheet.id });
                    }}>
                    {favoriteCover ? (
                        <FastImage source={favoriteCover} placeholderSource={ImgAsset.albumDefault} style={styles.favoriteCover} />
                    ) : (
                        <View style={[styles.favoriteCover, styles.favoritePlaceholder, { backgroundColor: colors.tonalSurface }]}>
                            <Icon name="heart" size={rpx(40)} color={colors.favorite} />
                        </View>
                    )}
                    <View style={styles.favoriteText}>
                        <ThemeText fontSize="title" fontWeight="semibold" style={styles.favoriteTitle}>{t("home.favoriteSheet")}</ThemeText>
                        <ThemeText fontSize="description" color={colors.primaryText} style={styles.favoriteCount}>
                            {t("home.songCount", { count: favoriteSheet?.worksNum ?? 0 })}
                        </ThemeText>
                    </View>
                    <Icon name="chevron-right" size={rpx(26)} color={colors.textSecondary} />
                </Pressable>

                <View style={styles.quickRow}>
                    {quickEntries.map(entry => (
                        <Pressable
                            key={entry.key}
                            accessibilityRole="button"
                            accessibilityLabel={entry.title}
                            accessibilityHint={entry.hint ?? entry.description}
                            style={({ pressed }) => [styles.quickEntry, { opacity: pressed ? 0.7 : 1 }]}
                            onPress={entry.onPress}>
                            <View style={styles.quickIcon}>
                                <Icon name={entry.icon} size={rpx(44)} color={colors.text} />
                            </View>
                            <ThemeText fontSize="description" fontWeight="medium" style={styles.quickTitle}>{entry.title}</ThemeText>
                            <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.description}>{entry.description}</ThemeText>
                        </Pressable>
                    ))}
                </View>

                <View style={styles.sectionHeader}>
                    <ThemeText fontSize="title" fontWeight="semibold" style={styles.sectionHeading}>{t("home.recentListening")}</ThemeText>
                    <TextAction title={t("myMusic.viewAllShort")} label={t("myMusic.viewRecent")} onPress={openHistory} />
                </View>
                <RecentMusic musics={history.slice(0, RECENT_PREVIEW_LIMIT)} />

                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitle}>
                        <ThemeText fontSize="title" fontWeight="semibold" style={styles.sectionHeading}>{t("home.myPlaylists")}</ThemeText>
                        <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.inlineLabel}>
                            {t("home.playlistCount", { count: userSheets.length })}
                        </ThemeText>
                    </View>
                    <TextAction
                        title={t("myMusic.viewAllShort")}
                        label={t("home.viewAll")}
                        onPress={() => navigate(ROUTE_PATH.SHEET_BROWSER, { sheetType: "local" })}
                    />
                </View>
                <View style={styles.playlistActions}>
                    {playlistActions.map(entry => (
                        <Pressable
                            key={entry.key}
                            accessibilityRole="button"
                            accessibilityLabel={entry.description}
                            style={({ pressed }) => [styles.playlistAction, { opacity: pressed ? 0.7 : 1 }]}
                            onPress={entry.onPress}>
                            <View style={[styles.playlistActionContent, entry.key === "create" ? [styles.createPlaylistContent, { backgroundColor: colors.tonalSurface }] : null]}>
                                <Icon name={entry.icon} size={rpx(28)} color={entry.key === "create" ? colors.onTonal : colors.textSecondary} />
                                <ThemeText fontSize="description" fontWeight="medium" color={entry.key === "create" ? colors.onTonal : colors.textSecondary} style={[styles.inlineLabel, styles.playlistActionLabel]}>{entry.title}</ThemeText>
                            </View>
                        </Pressable>
                    ))}
                </View>
                {userSheets.length ? (
                    <View style={[styles.playlistList, { backgroundColor: colors.card }]}>
                        {userSheets.map((sheet, index) => (
                            <Pressable
                                key={sheet.id}
                                accessibilityRole="button"
                                accessibilityLabel={t("myMusic.openPlaylist", { title: sheet.title ?? t("common.unknownName") })}
                                style={({ pressed }) => [styles.playlistRow, { opacity: pressed ? 0.7 : 1 }]}
                                onPress={() => navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, { id: sheet.id })}>
                                <FastImage source={sheet.coverImg ?? sheet.artwork} placeholderSource={ImgAsset.albumDefault} style={styles.playlistCover} />
                                <View style={[
                                    styles.playlistText,
                                    index < userSheets.length - 1 ? { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth } : null,
                                ]}>
                                    <View style={styles.rowText}>
                                        <ThemeText fontSize="subTitle" fontWeight="medium" numberOfLines={1} style={styles.rowLabel}>{sheet.title ?? t("common.unknownName")}</ThemeText>
                                        <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.description}>
                                            {t("home.songCount", { count: sheet.worksNum ?? 0 })}
                                        </ThemeText>
                                    </View>
                                    <Icon name="chevron-right" size={rpx(24)} color={colors.textSecondary} />
                                </View>
                            </Pressable>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyPlaylists}>
                        <View style={styles.rowText}>
                            <ThemeText fontSize="caption" fontColor="textSecondary">{t("myMusic.playlistsHint")}</ThemeText>
                        </View>
                    </View>
                )}

                <View style={styles.toolsHeader}>
                    <ThemeText fontSize="tag" fontWeight="medium" fontColor="textSecondary">{t("myMusic.tools")}</ThemeText>
                </View>
                <View style={[styles.toolsList, { backgroundColor: colors.card }]}>
                    {managementEntries.map((entry, index) => (
                        <Pressable
                            key={entry.key}
                            accessibilityRole="button"
                            accessibilityLabel={entry.title}
                            accessibilityHint={entry.hint ?? entry.description}
                            style={({ pressed }) => [styles.toolRow, { opacity: pressed ? 0.7 : 1 }]}
                            onPress={entry.onPress}>
                            <Icon name={entry.icon} size={rpx(32)} color={colors.textSecondary} />
                            <View style={[
                                styles.toolContent,
                                index === 0 ? { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth } : null,
                            ]}>
                                <View style={styles.rowText}>
                                    <ThemeText fontSize="subTitle" fontWeight="medium" style={styles.rowLabel}>{entry.title}</ThemeText>
                                    <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.description}>{entry.description}</ThemeText>
                                </View>
                                <Icon name="chevron-right" size={rpx(24)} color={colors.textSecondary} />
                            </View>
                        </Pressable>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

function TextAction({ title, label, onPress }: { title: string; label: string; onPress: () => void }) {
    const colors = useColors();
    return (
        <Pressable accessibilityRole="button" accessibilityLabel={label} style={styles.textAction} onPress={onPress}>
            <ThemeText fontSize="tag" fontColor="textSecondary">{title}</ThemeText>
            <Icon name="chevron-right" size={rpx(20)} color={colors.textSecondary} />
        </Pressable>
    );
}

function RecentMusic({ musics }: { musics: IMusic.IMusicItem[] }) {
    const colors = useColors();
    const { t } = useI18N();
    const navigate = useNavigate();
    const getDisplayName = usePluginDisplayNameResolver();
    const { width: windowWidth } = useWindowDimensions();
    const [viewportWidth, setViewportWidth] = useState(Math.max(0, windowWidth - spacing.xxxl * 2));
    const layout = getRecentPageLayout(viewportWidth, spacing.xl, Math.max(96, rpx(160)));
    const pages = Array.from({ length: Math.ceil(musics.length / layout.columns) }, (_, index) => musics.slice(index * layout.columns, (index + 1) * layout.columns));

    if (!musics.length) {
        return (
            <View style={[styles.emptyRecent, { backgroundColor: colors.surface }]}>
                <View style={styles.rowText}>
                    <ThemeText fontSize="content" fontWeight="semibold">{t("myMusic.historyEmpty")}</ThemeText>
                    <ThemeText fontSize="description" fontColor="textSecondary" style={styles.description}>{t("myMusic.historyHint")}</ThemeText>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={t("home.exploreMusic")} style={styles.searchAction} onPress={() => navigate(ROUTE_PATH.SEARCH_PAGE)}>
                    <Icon name="magnifying-glass" size={rpx(34)} color={colors.primaryText} />
                </Pressable>
            </View>
        );
    }

    return (
        <ScrollView
            key={layout.width}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentStrip}
            onLayout={event => {
                const width = event.nativeEvent.layout.width;
                if (width > 0) setViewportWidth(width);
            }}>
            {pages.map((page, index) => (
                <View key={index} style={[styles.recentPage, { width: layout.width, gap: layout.gap }]}>
                    {page.map(music => (
                        <Pressable
                            key={`${music.platform}:${music.id}`}
                            accessibilityRole="button"
                            accessibilityLabel={t("myMusic.playRecent", { title: music.title ?? t("common.unknownName"), artist: music.artist || t("musicLibrary.unknownArtist") })}
                            style={({ pressed }) => [styles.recentItem, { width: layout.coverWidth, opacity: pressed ? 0.7 : 1 }]}
                            onPress={() => TrackPlayer.play(music)}>
                            <View>
                                <FastImage source={music.artwork} placeholderSource={ImgAsset.albumDefault} style={styles.recentCover} />
                                <View style={[styles.playBadge, { backgroundColor: colors.inverseSurface }]}>
                                    <Icon name="play" size={rpx(24)} color={colors.onInverse} />
                                </View>
                            </View>
                            <ThemeText fontSize="subTitle" fontWeight="medium" numberOfLines={1} style={styles.recentTitle}>{music.title ?? t("common.unknownName")}</ThemeText>
                            <ThemeText fontSize="tag" fontColor="textSecondary" numberOfLines={1} style={styles.recentArtist}>{music.artist || getDisplayName(music.platform)}</ThemeText>
                        </Pressable>
                    ))}
                </View>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 1, width: "100%" },
    header: { minHeight: rpx(92), paddingHorizontal: spacing.xxxl, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerTitle: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.md },
    brandMark: { flexDirection: "row", alignItems: "center" },
    headerAction: { minWidth: minimumTouch, minHeight: minimumTouch, alignItems: "center", justifyContent: "center" },
    content: { paddingHorizontal: spacing.xxxl, paddingBottom: spacing.xxxl },
    logo: { width: rpx(24), height: rpx(24), borderRadius: radius.xs },
    favoriteEntry: { minHeight: Math.max(minimumTouch, rpx(152)), borderRadius: radius.xl, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md },
    favoriteTitle: { fontSize: fontRpx(30) },
    favoriteText: { flex: 1, minWidth: 0 },
    favoriteCount: { marginTop: spacing.xs },
    favoriteCover: { width: rpx(112), height: rpx(112), borderRadius: radius.md },
    favoritePlaceholder: { alignItems: "center", justifyContent: "center" },
    inlineLabel: { marginLeft: spacing.xs },
    description: { marginTop: spacing.xxs },
    quickRow: { flexDirection: "row", alignItems: "stretch", paddingTop: spacing.xl, paddingBottom: spacing.xs },
    quickEntry: { flex: 1, minWidth: 0, minHeight: minimumTouch, alignItems: "center", paddingHorizontal: spacing.xxs, paddingBottom: spacing.xs },
    quickIcon: { height: rpx(48), alignItems: "center", justifyContent: "center" },
    quickTitle: { flexGrow: 1, marginTop: spacing.xs, textAlign: "center" },
    sectionHeader: { minHeight: minimumTouch, marginTop: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs },
    sectionHeading: { fontSize: fontRpx(30) },
    sectionTitle: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
    textAction: { minHeight: minimumTouch, minWidth: minimumTouch, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
    recentStrip: { paddingVertical: spacing.xs },
    recentPage: { flexDirection: "row", alignItems: "flex-start" },
    recentItem: { minHeight: minimumTouch },
    recentCover: { width: "100%", aspectRatio: 1, borderRadius: radius.lg },
    playBadge: { position: "absolute", right: spacing.xs, bottom: spacing.xs, width: rpx(40), height: rpx(40), borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
    recentTitle: { marginTop: spacing.xs, lineHeight: recentTitleLineHeight, height: recentTitleLineHeight },
    recentArtist: { marginTop: spacing.xs },
    playlistActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.xl },
    playlistAction: { flex: 1, minWidth: rpx(160), minHeight: minimumTouch, alignItems: "center", justifyContent: "center" },
    playlistActionContent: { minHeight: Math.max(32, rpx(64)), maxWidth: "100%", flexShrink: 1, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.xxs },
    createPlaylistContent: { minWidth: rpx(152) },
    playlistActionLabel: { flexShrink: 1 },
    playlistList: { borderRadius: radius.lg, overflow: "hidden" },
    playlistRow: { minHeight: rpx(116), paddingLeft: spacing.md, flexDirection: "row", alignItems: "center" },
    playlistCover: { width: rpx(84), height: rpx(84), borderRadius: radius.sm },
    playlistText: { flex: 1, minWidth: 0, minHeight: rpx(116), marginLeft: spacing.md, paddingVertical: spacing.md, paddingRight: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    rowText: { flex: 1, minWidth: 0 },
    rowLabel: { fontSize: fontRpx(24) },
    emptyPlaylists: { paddingVertical: spacing.sm },
    emptyRecent: { minHeight: rpx(144), padding: spacing.lg, borderRadius: radius.lg, flexDirection: "row", alignItems: "center", gap: spacing.md },
    searchAction: { minWidth: minimumTouch, minHeight: minimumTouch, alignItems: "center", justifyContent: "center" },
    toolsList: { borderRadius: radius.md, overflow: "hidden" },
    toolsHeader: { marginTop: spacing.xl, marginBottom: spacing.sm },
    toolRow: { minHeight: minimumTouch, paddingLeft: spacing.lg, flexDirection: "row", alignItems: "center" },
    toolContent: { flex: 1, minWidth: 0, marginLeft: spacing.md, minHeight: minimumTouch, paddingVertical: spacing.md, paddingRight: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
