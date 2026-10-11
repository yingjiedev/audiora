import FastImage from "@/components/base/fastImage";
import Icon, { IIconName } from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { showPanel } from "@/components/panels/usePanel";
import { ImgAsset } from "@/constants/assetsConst";
import { controlSize, radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { useMusicHistory } from "@/core/musicHistory";
import MusicSheet, { useSheetsBase, useStarredSheets } from "@/core/musicSheet";
import { usePluginDisplayNameResolver } from "@/core/pluginManager";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import TrackPlayer from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import DeviceInfo from "react-native-device-info";

const RECENT_PREVIEW_LIMIT = 6;
const minimumTouch = Math.max(44, controlSize.minimumTouch);

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
    const favoriteSheet = sheets.find(sheet => sheet.id === MusicSheet.defaultSheet.id);
    const userSheets = sheets.filter(sheet => sheet.id !== MusicSheet.defaultSheet.id);
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
            description: t("home.currentVersion", { version: DeviceInfo.getVersion() }),
            onPress: () => navigate(ROUTE_PATH.SETTING, { type: "about" }),
        },
    ];

    return (
        <View style={[styles.wrapper, { backgroundColor: colors.pageBackground }]}>
            <View style={styles.header}>
                <ThemeText fontSize="appbar" fontWeight="bolder">{t("home.mine")}</ThemeText>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("common.setting")}
                    style={({ pressed }) => [styles.headerAction, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => navigate(ROUTE_PATH.SETTING, { type: "overview" })}>
                    <Icon name="cog-8-tooth" size={rpx(36)} color={colors.text} />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.profileCard, { backgroundColor: colors.tonalSurface }]}>
                    <View style={styles.identityRow}>
                        <Image source={ImgAsset.logo} resizeMode="contain" style={styles.logo} accessible={false} />
                        <View style={styles.identityText}>
                            <ThemeText fontSize="subTitle" fontWeight="bold" color={colors.onTonal}>Audiora</ThemeText>
                            <ThemeText fontSize="description" color={colors.onTonal} style={styles.description}>
                                {t("home.personalTagline")}
                            </ThemeText>
                        </View>
                    </View>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("home.favoriteSheet")}
                        accessibilityHint={t("home.songCount", { count: favoriteSheet?.worksNum ?? 0 })}
                        accessibilityState={{ disabled: !favoriteSheet }}
                        disabled={!favoriteSheet}
                        style={({ pressed }) => [styles.favoriteEntry, { opacity: pressed ? 0.7 : 1 }]}
                        onPress={() => {
                            if (favoriteSheet) navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, { id: favoriteSheet.id });
                        }}>
                        <View style={styles.favoriteText}>
                            <View style={styles.favoriteTitle}>
                                <Icon name="heart" size={rpx(26)} color={colors.favorite} />
                                <ThemeText fontSize="subTitle" fontWeight="semibold" color={colors.onTonal} style={styles.inlineLabel}>
                                    {t("home.favoriteSheet")}
                                </ThemeText>
                            </View>
                            <ThemeText fontSize="hero" fontWeight="bold" color={colors.onTonal} style={styles.favoriteCount}>
                                {t("home.songCount", { count: favoriteSheet?.worksNum ?? 0 })}
                            </ThemeText>
                        </View>
                        <FastImage
                            source={favoriteSheet?.coverImg ?? favoriteSheet?.artwork}
                            placeholderSource={ImgAsset.quickFavorite}
                            style={styles.favoriteCover}
                        />
                        <Icon name="chevron-right" size={rpx(26)} color={colors.onTonal} />
                    </Pressable>
                </View>

                <View style={styles.quickRow}>
                    {quickEntries.map(entry => (
                        <Pressable
                            key={entry.key}
                            accessibilityRole="button"
                            accessibilityLabel={entry.title}
                            accessibilityHint={entry.hint ?? entry.description}
                            style={({ pressed }) => [styles.quickEntry, { opacity: pressed ? 0.7 : 1 }]}
                            onPress={entry.onPress}>
                            <View style={[styles.quickIcon, { backgroundColor: colors.card }]}>
                                <Icon name={entry.icon} size={rpx(36)} color={colors.primaryText} />
                            </View>
                            <ThemeText fontSize="description" fontWeight="semibold" style={styles.quickTitle}>{entry.title}</ThemeText>
                            <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.description}>{entry.description}</ThemeText>
                        </Pressable>
                    ))}
                </View>

                <View style={styles.sectionHeader}>
                    <ThemeText fontSize="title" fontWeight="bold">{t("home.recentListening")}</ThemeText>
                    <TextAction title={t("home.viewAll")} label={t("myMusic.viewRecent")} onPress={openHistory} />
                </View>
                <RecentMusic musics={history.slice(0, RECENT_PREVIEW_LIMIT)} />

                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitle}>
                        <ThemeText fontSize="title" fontWeight="bold">{t("home.myPlaylists")}</ThemeText>
                        <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.inlineLabel}>
                            {t("home.playlistCount", { count: userSheets.length })}
                        </ThemeText>
                    </View>
                    <TextAction
                        title={t("home.viewAll")}
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
                            style={({ pressed }) => [styles.playlistAction, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
                            onPress={entry.onPress}>
                            <Icon name={entry.icon} size={rpx(28)} color={colors.primaryText} />
                            <ThemeText fontSize="description" fontWeight="semibold" style={styles.inlineLabel}>{entry.title}</ThemeText>
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
                                        <ThemeText fontSize="content" fontWeight="semibold" numberOfLines={1}>{sheet.title ?? t("common.unknownName")}</ThemeText>
                                        <ThemeText fontSize="description" fontColor="textSecondary" style={styles.description}>
                                            {t("home.songCount", { count: sheet.worksNum ?? 0 })}
                                        </ThemeText>
                                    </View>
                                    <Icon name="chevron-right" size={rpx(24)} color={colors.textSecondary} />
                                </View>
                            </Pressable>
                        ))}
                    </View>
                ) : (
                    <View style={[styles.emptyPlaylists, { backgroundColor: colors.card }]}>
                        <Icon name="playlist" size={rpx(44)} color={colors.primaryText} />
                        <ThemeText fontSize="content" fontWeight="semibold" style={styles.emptyTitle}>{t("home.noCustomPlaylists")}</ThemeText>
                        <ThemeText fontSize="description" fontColor="textSecondary" style={styles.emptyDescription}>{t("myMusic.playlistsHint")}</ThemeText>
                    </View>
                )}

                <View style={styles.sectionHeader}>
                    <ThemeText fontSize="title" fontWeight="bold">{t("myMusic.tools")}</ThemeText>
                </View>
                <View style={[styles.toolsList, { backgroundColor: colors.card }]}>
                    {managementEntries.map((entry, index) => (
                        <Pressable
                            key={entry.key}
                            accessibilityRole="button"
                            accessibilityLabel={entry.title}
                            accessibilityHint={entry.description}
                            style={({ pressed }) => [styles.toolRow, { opacity: pressed ? 0.7 : 1 }]}
                            onPress={entry.onPress}>
                            <Icon name={entry.icon} size={rpx(32)} color={colors.textSecondary} />
                            <View style={[
                                styles.toolContent,
                                index === 0 ? { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth } : null,
                            ]}>
                                <View style={styles.rowText}>
                                    <ThemeText fontSize="content" fontWeight="semibold">{entry.title}</ThemeText>
                                    <ThemeText fontSize="description" fontColor="textSecondary" style={styles.description}>{entry.description}</ThemeText>
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
            <ThemeText fontSize="description" color={colors.primaryText}>{title}</ThemeText>
            <Icon name="chevron-right" size={rpx(24)} color={colors.primaryText} />
        </Pressable>
    );
}

function RecentMusic({ musics }: { musics: IMusic.IMusicItem[] }) {
    const colors = useColors();
    const { t } = useI18N();
    const navigate = useNavigate();
    const getDisplayName = usePluginDisplayNameResolver();

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentStrip}>
            {musics.map(music => (
                <Pressable
                    key={`${music.platform}:${music.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={t("myMusic.playRecent", { title: music.title ?? t("common.unknownName"), artist: music.artist || t("musicLibrary.unknownArtist") })}
                    style={({ pressed }) => [styles.recentItem, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => TrackPlayer.play(music)}>
                    <View>
                        <FastImage source={music.artwork} placeholderSource={ImgAsset.albumDefault} style={styles.recentCover} />
                        <View style={[styles.playBadge, { backgroundColor: colors.inverseSurface }]}>
                            <Icon name="play" size={rpx(24)} color={colors.onInverse} />
                        </View>
                    </View>
                    <ThemeText fontSize="subTitle" fontWeight="semibold" numberOfLines={2} style={styles.recentTitle}>{music.title ?? t("common.unknownName")}</ThemeText>
                    <ThemeText fontSize="description" fontColor="textSecondary" numberOfLines={1} style={styles.description}>{music.artist || getDisplayName(music.platform)}</ThemeText>
                </Pressable>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 1, width: "100%" },
    header: { minHeight: rpx(92), paddingHorizontal: spacing.xl, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerAction: { minWidth: minimumTouch, minHeight: minimumTouch, alignItems: "center", justifyContent: "center" },
    content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
    profileCard: { borderRadius: radius.xl, padding: spacing.xl },
    identityRow: { flexDirection: "row", alignItems: "center" },
    logo: { width: rpx(64), height: rpx(64), borderRadius: radius.md },
    identityText: { flex: 1, minWidth: 0, marginLeft: spacing.md },
    favoriteEntry: { minHeight: rpx(140), marginTop: spacing.lg, flexDirection: "row", alignItems: "center" },
    favoriteText: { flex: 1, minWidth: 0, marginRight: spacing.md },
    favoriteTitle: { flexDirection: "row", alignItems: "center" },
    favoriteCount: { marginTop: spacing.xs },
    favoriteCover: { width: rpx(124), height: rpx(124), borderRadius: radius.md, marginRight: spacing.sm },
    inlineLabel: { marginLeft: spacing.xs },
    description: { marginTop: spacing.xxs },
    quickRow: { flexDirection: "row", alignItems: "flex-start", paddingTop: spacing.xl, paddingBottom: spacing.xs },
    quickEntry: { flex: 1, minWidth: 0, minHeight: minimumTouch, alignItems: "center", paddingHorizontal: spacing.xxs, paddingBottom: spacing.xs },
    quickIcon: { width: minimumTouch, height: minimumTouch, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
    quickTitle: { marginTop: spacing.sm, textAlign: "center" },
    sectionHeader: { minHeight: minimumTouch, marginTop: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs },
    sectionTitle: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
    textAction: { minHeight: minimumTouch, minWidth: minimumTouch, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
    recentStrip: { gap: spacing.md, paddingVertical: spacing.xs },
    recentItem: { width: rpx(226), minWidth: minimumTouch },
    recentCover: { width: "100%", aspectRatio: 1, borderRadius: radius.lg },
    playBadge: { position: "absolute", right: spacing.sm, bottom: spacing.sm, width: rpx(48), height: rpx(48), borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
    recentTitle: { marginTop: spacing.sm },
    playlistActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
    playlistAction: { flex: 1, minWidth: rpx(180), minHeight: minimumTouch, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xs },
    playlistList: { borderRadius: radius.lg, overflow: "hidden" },
    playlistRow: { minHeight: rpx(116), paddingLeft: spacing.md, flexDirection: "row", alignItems: "center" },
    playlistCover: { width: rpx(84), height: rpx(84), borderRadius: radius.sm },
    playlistText: { flex: 1, minWidth: 0, minHeight: rpx(116), marginLeft: spacing.md, paddingVertical: spacing.md, paddingRight: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    rowText: { flex: 1, minWidth: 0 },
    emptyPlaylists: { padding: spacing.xxl, borderRadius: radius.lg, alignItems: "center" },
    emptyTitle: { marginTop: spacing.sm, textAlign: "center" },
    emptyDescription: { marginTop: spacing.xs, textAlign: "center" },
    emptyRecent: { minHeight: rpx(144), padding: spacing.lg, borderRadius: radius.lg, flexDirection: "row", alignItems: "center", gap: spacing.md },
    searchAction: { minWidth: minimumTouch, minHeight: minimumTouch, alignItems: "center", justifyContent: "center" },
    toolsList: { borderRadius: radius.lg, overflow: "hidden" },
    toolRow: { minHeight: minimumTouch, paddingLeft: spacing.lg, flexDirection: "row", alignItems: "center" },
    toolContent: { flex: 1, minWidth: 0, marginLeft: spacing.md, minHeight: rpx(108), paddingVertical: spacing.lg, paddingRight: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
