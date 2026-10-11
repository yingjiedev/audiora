import Icon, { IIconName } from "@/components/base/icon";
import PillTabBar from "@/components/base/pillTabBar";
import ThemeText from "@/components/base/themeText";
import MusicItem from "@/components/mediaItem/musicItem";
import { controlSize, radius, spacing } from "@/constants/designSystem";
import { localMusicSheetId, localPluginPlatform } from "@/constants/commonConst";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import LocalMusicSheet from "@/core/localMusicSheet";
import PluginManager, { usePluginDisplayNameResolver, useSortedPlugins } from "@/core/pluginManager";
import TrackPlayer from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import { openLocalMusicScanner } from "@/pages/localMusic/scanMusic";
import rpx, { fontRpx } from "@/utils/rpx";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { groupLocalMusic, LocalBrowserMode, LocalGroupMode, LocalMusicGroup } from "./libraryBrowser";

type LibraryTab = "local" | "online";
type LocalEntry = { key: LocalBrowserMode; icon: IIconName; title: string; count: number; unit: string };
type BrowserRow = { key: string } & ({ kind: "track"; music: IMusic.IMusicItem } | { kind: "group"; group: LocalMusicGroup });
const minimumTouch = Math.max(44, controlSize.minimumTouch);
const browserIcons: Record<LocalBrowserMode, IIconName> = {
    tracks: "musical-note", artists: "user", albums: "album-outline", folders: "folder-outline",
};

function LocalMusicContent({ musicList }: { musicList: IMusic.IMusicItem[] }) {
    const colors = useColors();
    const navigate = useNavigate();
    const { t, getLanguage } = useI18N();
    const [mode, setMode] = useState<LocalBrowserMode>("tracks");
    const [groupKey, setGroupKey] = useState<string | null>(null);
    const locale = getLanguage().locale;
    const groups = useMemo(() => ({
        artists: groupLocalMusic(musicList, "artists", locale),
        albums: groupLocalMusic(musicList, "albums", locale),
        folders: groupLocalMusic(musicList, "folders", locale),
    }), [musicList, locale]);
    const selectedGroup = mode === "tracks" ? undefined : groups[mode].find(group => group.key === groupKey);
    const visibleMusics = selectedGroup?.musicList ?? musicList;
    const showTracks = mode === "tracks" || !!selectedGroup;
    const unknownNames: Record<LocalGroupMode, string> = {
        artists: t("musicLibrary.unknownArtist"), albums: t("musicLibrary.unknownAlbum"), folders: t("musicLibrary.uncategorizedFolder"),
    };
    const groupTitle = (group: LocalMusicGroup) => group.name || unknownNames[mode as LocalGroupMode];
    const entries: LocalEntry[] = [
        { key: "tracks", icon: browserIcons.tracks, title: t("musicLibrary.tracks"), count: musicList.length, unit: t("musicLibrary.unit.track") },
        { key: "artists", icon: browserIcons.artists, title: t("musicLibrary.artists"), count: groups.artists.length, unit: t("musicLibrary.unit.artist") },
        { key: "albums", icon: browserIcons.albums, title: t("common.album"), count: groups.albums.length, unit: t("musicLibrary.unit.album") },
        { key: "folders", icon: browserIcons.folders, title: t("musicLibrary.folders"), count: groups.folders.length, unit: t("musicLibrary.unit.folder") },
    ];
    const titles: Record<LocalBrowserMode, string> = {
        tracks: t("musicLibrary.allTracks"), artists: t("musicLibrary.artists"), albums: t("common.album"), folders: t("musicLibrary.folders"),
    };
    const sheet: IMusic.IMusicSheetItem = { id: localMusicSheetId, platform: localPluginPlatform, title: selectedGroup ? groupTitle(selectedGroup) : t("home.localMusic"), musicList: visibleMusics };
    const play = (music: IMusic.IMusicItem) => TrackPlayer.playWithReplacePlayList(music, visibleMusics, { sheet, routeName: ROUTE_PATH.HOME });
    const rows: BrowserRow[] = showTracks
        ? visibleMusics.map(music => ({ kind: "track", key: `${music.platform}@${music.id}`, music }))
        : groups[mode as LocalGroupMode].map(group => ({ kind: "group", key: group.key, group }));

    return (
        <FlatList
            key={`${mode}:${selectedGroup?.key ?? "all"}`}
            testID="library-local-list"
            data={rows}
            keyExtractor={item => item.key}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={(
                <>
                    <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
                        <View style={styles.summaryTop}>
                            <View style={styles.summaryText}>
                                <View style={styles.summaryLabel}>
                                    <Icon name="folder-music-outline" size={rpx(26)} color={colors.textSecondary} />
                                    <ThemeText fontSize="description" fontWeight="medium">{t("musicLibrary.deviceMusic")}</ThemeText>
                                </View>
                                <ThemeText style={styles.summaryNumber} fontWeight="medium" fontColor="primary">
                                    {musicList.length}<ThemeText fontSize="description" fontColor="textSecondary"> {t("musicLibrary.unit.track")}</ThemeText>
                                </ThemeText>
                            </View>
                            <Pressable
                                accessibilityRole="button" accessibilityLabel={t("localMusic.scanLocalMusic")}
                                onPress={() => openLocalMusicScanner(navigate)}
                                style={({ pressed }) => [styles.tonalAction, { backgroundColor: colors.tonalSurface, opacity: pressed ? 0.7 : 1 }]}>
                                <Icon name="folder-plus" size={rpx(26)} color={colors.onTonal} />
                                <ThemeText color={colors.onTonal} fontSize="caption" fontWeight="medium" style={styles.actionLabel}>{t("musicLibrary.scanMusic")}</ThemeText>
                            </Pressable>
                        </View>
                        <View style={[styles.summaryFooter, { borderTopColor: colors.divider }]}>
                            <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.summaryHint}>{t("musicLibrary.localHint")}</ThemeText>
                            <Pressable accessibilityRole="button" accessibilityLabel={t("musicLibrary.viewAllLocal")}
                                style={styles.textAction} onPress={() => navigate(ROUTE_PATH.LOCAL)}>
                                <ThemeText fontSize="caption" fontColor="textSecondary">{t("musicLibrary.manageMusic")}</ThemeText>
                                <Icon name="chevron-right" size={rpx(18)} color={colors.textSecondary} />
                            </Pressable>
                        </View>
                    </View>
                    <View style={styles.quickRow}>
                        {entries.map(entry => {
                            const selected = mode === entry.key;
                            return (
                                <Pressable key={entry.key} testID={`library-category-${entry.key}`}
                                    accessibilityRole="tab" accessibilityLabel={t("musicLibrary.browseEntry", { name: entry.title })}
                                    accessibilityHint={`${entry.count} ${entry.unit}`} accessibilityState={{ selected }}
                                    onPress={() => {
                                        setMode(entry.key); setGroupKey(null);
                                    }}
                                    style={({ pressed }) => [styles.quickEntry, { opacity: pressed ? 0.7 : 1 }]}>
                                    <View style={styles.quickIcon}><Icon name={entry.icon} size={rpx(44)} color={selected ? colors.active : colors.text} /></View>
                                    <ThemeText fontSize="description" fontWeight={selected ? "semibold" : "medium"} color={selected ? colors.active : colors.text} style={styles.quickTitle}>{entry.title}</ThemeText>
                                    <ThemeText fontSize="tag" fontColor="textSecondary" style={styles.quickCount}>{entry.count} {entry.unit}</ThemeText>
                                    <View style={[styles.categoryIndicator, { backgroundColor: selected ? colors.active : colors.pageBackground }]} />
                                </Pressable>
                            );
                        })}
                    </View>
                    <View style={styles.sectionHeader}>
                        {selectedGroup ? (
                            <Pressable accessibilityRole="button" accessibilityLabel={t("musicLibrary.backToGroups", { name: titles[mode] })}
                                style={styles.groupHeading} onPress={() => setGroupKey(null)}>
                                <Icon name="arrow-left" size={rpx(22)} color={colors.textSecondary} />
                                <ThemeText style={styles.sectionTitle} fontWeight="semibold" numberOfLines={2}>{groupTitle(selectedGroup)}</ThemeText>
                            </Pressable>
                        ) : <ThemeText style={styles.sectionTitle} fontWeight="semibold">{titles[mode]}</ThemeText>}
                        {showTracks && visibleMusics.length > 0 ? (
                            <Pressable accessibilityRole="button" accessibilityLabel={t("musicLibrary.playAllCount", { count: visibleMusics.length })}
                                style={styles.textAction} onPress={() => play(visibleMusics[0])}>
                                <Icon name="play" size={rpx(24)} color={colors.primaryText} />
                                <ThemeText fontSize="caption" color={colors.primaryText} style={styles.actionLabel}>{t("playAllBar.title")}</ThemeText>
                            </Pressable>
                        ) : null}
                    </View>
                </>
            )}
            ListEmptyComponent={(
                <View style={styles.emptyState}>
                    <Icon name="folder-music-outline" size={rpx(44)} color={colors.textSecondary} />
                    <ThemeText fontSize="subTitle" fontWeight="medium" style={styles.emptyTitle}>{t("musicLibrary.emptyLocalTitle")}</ThemeText>
                    <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.emptyDescription}>{t("musicLibrary.emptyLocalDescription")}</ThemeText>
                </View>
            )}
            renderItem={({ item, index }) => item.kind === "track" ? (
                <MusicItem musicItem={item.music} index={index + 1} musicSheet={sheet}
                    onItemPress={play} actions={["addNext", "more"]} containerStyle={styles.musicRow} />
            ) : (
                <Pressable accessibilityRole="button" accessibilityLabel={t("musicLibrary.viewEntry", { name: groupTitle(item.group) })}
                    accessibilityHint={t("musicLibrary.musicCount", { count: item.group.musicList.length })}
                    onPress={() => setGroupKey(item.group.key)}
                    style={({ pressed }) => [styles.browserRow, { opacity: pressed ? 0.7 : 1 }]}>
                    <View style={styles.browserIcon}><Icon name={browserIcons[mode]} size={rpx(34)} color={colors.textSecondary} /></View>
                    <View style={styles.browserText}>
                        <ThemeText fontSize="description" fontWeight="medium" numberOfLines={1}>{groupTitle(item.group)}</ThemeText>
                        <ThemeText fontSize="caption" fontColor="textSecondary" numberOfLines={2} style={styles.description}>
                            {t("musicLibrary.musicCount", { count: item.group.musicList.length })}{item.group.detail ? ` · ${item.group.detail}` : ""}
                        </ThemeText>
                    </View>
                    <Icon name="chevron-right" size={rpx(20)} color={colors.textSecondary} />
                </Pressable>
            )}
        />
    );
}

function OnlineMusicContent() {
    const colors = useColors();
    const navigate = useNavigate();
    const { t } = useI18N();
    const getDisplayName = usePluginDisplayNameResolver();
    const enabledPlugins = useSortedPlugins().filter(plugin => PluginManager.isPluginEnabled(plugin));
    const openManagement = () => navigate(ROUTE_PATH.SETTING, { type: "plugin" });
    return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
                <View style={styles.summaryTop}>
                    <View style={styles.summaryText}>
                        <View style={styles.summaryLabel}>
                            <Icon name="circle-stack" size={rpx(26)} color={colors.textSecondary} />
                            <ThemeText fontSize="caption" fontColor="textSecondary">{t("musicLibrary.connectedSources")}</ThemeText>
                        </View>
                        <ThemeText style={styles.summaryNumber} fontWeight="medium" fontColor="primary">
                            {enabledPlugins.length}<ThemeText fontSize="description" fontColor="textSecondary"> {t("musicLibrary.unit.folder")}</ThemeText>
                        </ThemeText>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={t("musicLibrary.searchOnline")}
                        style={({ pressed }) => [styles.tonalAction, { backgroundColor: colors.tonalSurface, opacity: pressed ? 0.7 : 1 }]}
                        onPress={() => navigate(ROUTE_PATH.SEARCH_PAGE)}>
                        <Icon name="magnifying-glass" size={rpx(26)} color={colors.onTonal} />
                        <ThemeText fontSize="caption" color={colors.onTonal} style={styles.actionLabel}>{t("common.search")}</ThemeText>
                    </Pressable>
                </View>
                <View style={[styles.summaryFooter, { borderTopColor: colors.divider }]}>
                    <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.summaryHint}>{t("musicLibrary.onlineHint")}</ThemeText>
                    <Pressable accessibilityRole="button" accessibilityLabel={t("musicLibrary.manageSources")} style={styles.textAction} onPress={openManagement}>
                        <ThemeText fontSize="caption" fontColor="textSecondary">{t("musicLibrary.manage")}</ThemeText>
                        <Icon name="chevron-right" size={rpx(18)} color={colors.textSecondary} />
                    </Pressable>
                </View>
            </View>
            <View style={styles.sectionHeader}><ThemeText style={styles.sectionTitle} fontWeight="semibold">{t("musicLibrary.sourcesAndPlatforms")}</ThemeText></View>
            <View style={[styles.sourceList, { backgroundColor: colors.card }]}>
                {enabledPlugins.length ? enabledPlugins.map((plugin, index) => {
                    const searchable = plugin.supportedMethods.has("search");
                    return (
                        <Pressable key={plugin.hash} accessibilityRole="button"
                            accessibilityLabel={t(searchable ? "musicLibrary.searchWithSource" : "musicLibrary.viewEntry", { name: getDisplayName(plugin) })}
                            accessibilityHint={t(searchable ? "musicLibrary.searchSupported" : "musicLibrary.manageSources")}
                            style={({ pressed }) => [styles.sourceRow, { opacity: pressed ? 0.7 : 1 }]}
                            onPress={() => searchable ? navigate(ROUTE_PATH.SEARCH_PAGE, { pluginHash: plugin.hash }) : openManagement()}>
                            <View style={styles.browserIcon}><Icon name="circle-stack" size={rpx(34)} color={colors.textSecondary} /></View>
                            <View style={[styles.sourceContent, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }]}>
                                <View style={styles.browserText}>
                                    <ThemeText fontSize="description" fontWeight="medium" numberOfLines={1}>{getDisplayName(plugin)}</ThemeText>
                                    <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.description}>{t(searchable ? "musicLibrary.searchSupported" : "musicLibrary.sourceConnected")}</ThemeText>
                                </View>
                                <Icon name={searchable ? "magnifying-glass" : "chevron-right"} size={rpx(22)} color={colors.textSecondary} />
                            </View>
                        </Pressable>
                    );
                }) : (
                    <Pressable accessibilityRole="button" accessibilityLabel={t("musicLibrary.addSource")} style={styles.emptyState} onPress={openManagement}>
                        <Icon name="code-bracket-square" size={rpx(44)} color={colors.textSecondary} />
                        <ThemeText fontSize="subTitle" fontWeight="medium" style={styles.emptyTitle}>{t("musicLibrary.emptyOnlineTitle")}</ThemeText>
                        <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.emptyDescription}>{t("musicLibrary.emptyOnlineDescription")}</ThemeText>
                    </Pressable>
                )}
            </View>
        </ScrollView>
    );
}

export default function MusicLibraryOverview() {
    const colors = useColors();
    const navigate = useNavigate();
    const { t } = useI18N();
    const musicList = LocalMusicSheet.useMusicList();
    const [activeTab, setActiveTab] = useState<LibraryTab>("local");
    const libraryTabs: Array<{ key: LibraryTab; title: string }> = [
        { key: "local", title: t("home.localMusic") }, { key: "online", title: t("musicLibrary.onlineMusic") },
    ];
    return (
        <View style={[styles.wrapper, { backgroundColor: colors.pageBackground }]}>
            <View style={styles.header}>
                <ThemeText fontSize="appbar" fontWeight="bold">{t("home.musicLibrary")}</ThemeText>
                <Pressable accessibilityRole="button" accessibilityLabel={t(activeTab === "local" ? "musicLibrary.searchLocal" : "musicLibrary.searchOnline")}
                    style={styles.headerAction} onPress={() => activeTab === "local"
                        ? navigate(ROUTE_PATH.SEARCH_MUSIC_LIST, { musicList, musicSheet: { id: localMusicSheetId, platform: localPluginPlatform, musicList, title: t("home.localMusic") } })
                        : navigate(ROUTE_PATH.SEARCH_PAGE)}>
                    <Icon name="magnifying-glass" size={rpx(32)} color={colors.text} />
                </Pressable>
            </View>
            <PillTabBar routes={libraryTabs} index={activeTab === "local" ? 0 : 1} variant="underline"
                contentContainerStyle={styles.tabContent} onIndexChange={index => setActiveTab(libraryTabs[index].key)} />
            {activeTab === "local" ? <LocalMusicContent musicList={musicList} /> : <OnlineMusicContent />}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 1, width: "100%" },
    header: { minHeight: rpx(92), paddingHorizontal: spacing.xxxl, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    headerAction: { minWidth: minimumTouch, minHeight: minimumTouch, alignItems: "center", justifyContent: "center" },
    tabContent: { paddingHorizontal: spacing.xxl, gap: spacing.lg, justifyContent: "flex-start" },
    content: { paddingHorizontal: spacing.xxxl, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
    summaryCard: { borderRadius: radius.xl, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
    summaryTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md },
    summaryText: { flex: 1, minWidth: rpx(180) },
    summaryLabel: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    summaryNumber: { fontSize: Math.max(20, fontRpx(36)), marginTop: spacing.xs },
    tonalAction: { minHeight: minimumTouch, maxWidth: "100%", paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, flexDirection: "row", alignItems: "center" },
    actionLabel: { flexShrink: 1, marginLeft: spacing.xs },
    summaryFooter: { marginTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xxs },
    summaryHint: { flex: 1, minWidth: rpx(180), paddingVertical: spacing.xs },
    textAction: { minHeight: minimumTouch, minWidth: minimumTouch, flexShrink: 0, maxWidth: "100%", flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.xxs },
    quickRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", paddingTop: spacing.xl * 1.5, paddingBottom: spacing.sm },
    quickEntry: { flex: 1, minWidth: Math.max(64, rpx(100)), minHeight: minimumTouch, alignItems: "center", paddingHorizontal: spacing.xxs },
    quickIcon: { height: rpx(48), justifyContent: "center", alignItems: "center" },
    quickTitle: { flexGrow: 1, textAlign: "center", marginTop: spacing.xs },
    quickCount: { marginTop: spacing.xxs, textAlign: "center" },
    categoryIndicator: { width: rpx(24), height: Math.max(2, rpx(4)), borderRadius: radius.pill, marginTop: spacing.xs },
    sectionHeader: { minHeight: minimumTouch, marginTop: spacing.md, marginBottom: spacing.xs, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.xs },
    sectionTitle: { flex: 1, minWidth: 0, fontSize: fontRpx(30) },
    groupHeading: { flex: 1, minWidth: rpx(180), minHeight: minimumTouch, flexDirection: "row", alignItems: "center", gap: spacing.xxs },
    musicRow: { paddingLeft: 0, paddingRight: 0 },
    browserRow: { minHeight: minimumTouch, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
    browserIcon: { width: rpx(40), alignItems: "center", justifyContent: "center" },
    browserText: { flex: 1, minWidth: 0 },
    description: { marginTop: spacing.xxs },
    emptyState: { paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl, alignItems: "center", justifyContent: "center" },
    emptyTitle: { marginTop: spacing.md },
    emptyDescription: { marginTop: spacing.xs, textAlign: "center" },
    sourceList: { borderRadius: radius.lg, overflow: "hidden" },
    sourceRow: { minHeight: minimumTouch, paddingLeft: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
    sourceContent: { flex: 1, minWidth: 0, minHeight: minimumTouch, paddingVertical: spacing.md, paddingRight: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
