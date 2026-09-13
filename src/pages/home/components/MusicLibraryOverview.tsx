import Icon, { IIconName } from "@/components/base/icon";
import PillTabBar from "@/components/base/pillTabBar";
import ThemeText from "@/components/base/themeText";
import i18n, { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import LocalMusicSheet from "@/core/localMusicSheet";
import PluginManager, { useSortedPlugins } from "@/core/pluginManager";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Color from "color";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

type LibraryTab = "local" | "online";
type LocalBrowserMode = "tracks" | "artists" | "albums" | "folders";

type LocalEntry = {
    key: LocalBrowserMode;
    icon: IIconName;
    title: string;
    count: number;
    unit: string;
    accent: string;
};

type BrowserItem = {
    key: string;
    title: string;
    description: string;
};

function getFolderName(item: IMusic.IMusicItem) {
    const extra = item[Symbol.for("$")] as { localPath?: string } | undefined;
    const path = item.localPath ?? extra?.localPath ?? "";
    const parts = String(path).split(/[\\/]/).filter(Boolean);
    return parts.length > 1
        ? parts[parts.length - 2]
        : i18n.t("musicLibrary.uncategorizedFolder");
}

function countBy(items: IMusic.IMusicItem[], getName: (item: IMusic.IMusicItem) => string) {
    return items.reduce<Record<string, number>>((result, item) => {
        const name = getName(item) || i18n.t("common.unknownName");
        result[name] = (result[name] ?? 0) + 1;
        return result;
    }, {});
}

function buildBrowserItems(
    mode: LocalBrowserMode,
    items: IMusic.IMusicItem[],
    locale: string,
): BrowserItem[] {
    if (mode === "tracks") {
        return items.slice(0, 6).map(item => ({
            key: `${item.platform}-${item.id}`,
            title: item.title || i18n.t("musicLibrary.unknownTrack"),
            description: item.artist || i18n.t("musicLibrary.unknownArtist"),
        }));
    }

    const getName = mode === "artists"
        ? (item: IMusic.IMusicItem) => item.artist
        : mode === "albums"
            ? (item: IMusic.IMusicItem) => item.album
            : getFolderName;

    return Object.entries(countBy(items, getName))
        .sort(([left], [right]) => left.localeCompare(right, locale))
        .slice(0, 6)
        .map(([title, count]) => ({
            key: title,
            title,
            description: i18n.t("musicLibrary.musicCount", { count }),
        }));
}

function EmptyLocalBrowser() {
    const { t } = useI18N();

    return (
        <View style={styles.emptyState}>
            <Icon name="folder-music-outline" size={rpx(48)} color="#7892C9" />
            <ThemeText fontSize="subTitle" fontWeight="semibold" style={styles.emptyTitle}>
                {t("musicLibrary.emptyLocalTitle")}
            </ThemeText>
            <ThemeText fontSize="description" fontColor="textSecondary" style={styles.emptyDescription}>
                {t("musicLibrary.emptyLocalDescription")}
            </ThemeText>
        </View>
    );
}

function LocalMusicContent() {
    const colors = useColors();
    const navigate = useNavigate();
    const { t, getLanguage } = useI18N();
    const locale = getLanguage().locale;
    const localMusics = LocalMusicSheet.useMusicList();
    const [browserMode, setBrowserMode] = useState<LocalBrowserMode>("tracks");

    const artistCount = useMemo(
        () => new Set(localMusics.map(item => item.artist).filter(Boolean)).size,
        [localMusics],
    );
    const albumCount = useMemo(
        () => new Set(localMusics.map(item => item.album).filter(Boolean)).size,
        [localMusics],
    );
    const folderCount = useMemo(
        () => new Set(localMusics.map(getFolderName)).size,
        [localMusics],
    );
    const browserItems = useMemo(
        () => buildBrowserItems(browserMode, localMusics, locale),
        [browserMode, localMusics, locale],
    );
    const browseTitles: Record<LocalBrowserMode, string> = {
        tracks: t("musicLibrary.allTracks"),
        artists: t("musicLibrary.browseArtists"),
        albums: t("musicLibrary.browseAlbums"),
        folders: t("musicLibrary.browseFolders"),
    };

    const entries: LocalEntry[] = [
        {
            key: "tracks",
            icon: "musical-note",
            title: t("home.localMusic"),
            count: localMusics.length,
            unit: t("musicLibrary.unit.track"),
            accent: "#5B72FF",
        },
        {
            key: "artists",
            icon: "user",
            title: t("musicLibrary.artists"),
            count: artistCount,
            unit: t("musicLibrary.unit.artist"),
            accent: "#8563F2",
        },
        {
            key: "albums",
            icon: "album-outline",
            title: t("common.album"),
            count: albumCount,
            unit: t("musicLibrary.unit.album"),
            accent: "#1F9DF0",
        },
        {
            key: "folders",
            icon: "folder-outline",
            title: t("musicLibrary.folders"),
            count: folderCount,
            unit: t("musicLibrary.unit.folder"),
            accent: "#18BFA3",
        },
    ];

    return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("musicLibrary.viewAllLocal")}
                style={[styles.localHero, { backgroundColor: Color(colors.primary).alpha(0.1).toString() }]}
                onPress={() => navigate(ROUTE_PATH.LOCAL)}>
                <View style={[styles.heroIcon, { backgroundColor: Color(colors.primary).alpha(0.16).toString() }]}>
                    <Icon name="folder-music-outline" size={rpx(48)} color={colors.primary} />
                </View>
                <View style={styles.heroText}>
                    <ThemeText fontSize="subTitle" fontWeight="bold">
                        {t("home.localMusic")}
                    </ThemeText>
                    <ThemeText fontSize="description" fontColor="textSecondary" style={styles.heroDescription}>
                        {t("musicLibrary.localSummary", { count: localMusics.length })}
                    </ThemeText>
                </View>
                <Icon name="arrow-long-left" size={rpx(30)} color={colors.textSecondary} style={styles.chevron} />
            </Pressable>

            <View style={styles.localGrid}>
                {entries.map(entry => {
                    const selected = browserMode === entry.key;
                    return (
                        <Pressable
                            key={entry.key}
                            accessibilityRole="button"
                            accessibilityLabel={t("musicLibrary.browseEntry", { name: entry.title })}
                            style={[styles.localCard, { backgroundColor: Color(entry.accent).alpha(selected ? 0.16 : 0.08).toString() }]}
                            onPress={() => setBrowserMode(entry.key)}>
                            <View style={[styles.localIcon, { backgroundColor: Color(entry.accent).alpha(0.16).toString() }]}>
                                <Icon name={entry.icon} size={rpx(32)} color={entry.accent} />
                            </View>
                            <ThemeText fontSize="description" fontWeight="semibold" numberOfLines={1}>
                                {entry.title}
                            </ThemeText>
                            <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.cardCount}>
                                {entry.count} {entry.unit}
                            </ThemeText>
                        </Pressable>
                    );
                })}
            </View>

            <View style={styles.sectionHeader}>
                <ThemeText fontSize="title" fontWeight="bold">{browseTitles[browserMode]}</ThemeText>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("localMusic.scanLocalMusic")}
                    style={[styles.scanAction, { backgroundColor: Color(colors.primary).alpha(0.1).toString() }]}
                    onPress={() => navigate(ROUTE_PATH.LOCAL)}>
                    <Icon name="folder-plus" size={rpx(26)} color={colors.primary} />
                    <ThemeText color={colors.primary} fontSize="caption" fontWeight="semibold" style={styles.scanText}>
                        {t("musicLibrary.scanMusic")}
                    </ThemeText>
                </Pressable>
            </View>

            <View style={[styles.browserCard, { backgroundColor: colors.card }]}>
                {browserItems.length ? browserItems.map((item, index) => (
                    <Pressable
                        key={item.key}
                        accessibilityRole="button"
                        accessibilityLabel={t("musicLibrary.viewEntry", { name: item.title })}
                        style={[styles.browserRow, index < browserItems.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Color(colors.text).alpha(0.07).toString() } : null]}
                        onPress={() => navigate(ROUTE_PATH.LOCAL)}>
                        <View style={[styles.browserIcon, { backgroundColor: Color(colors.primary).alpha(0.1).toString() }]}>
                            <Icon name={browserMode === "tracks" ? "musical-note" : browserMode === "artists" ? "user" : browserMode === "albums" ? "album-outline" : "folder-outline"} size={rpx(28)} color={colors.primary} />
                        </View>
                        <View style={styles.browserText}>
                            <ThemeText fontSize="description" fontWeight="semibold" numberOfLines={1}>{item.title}</ThemeText>
                            <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.browserDescription}>{item.description}</ThemeText>
                        </View>
                        <Icon name="arrow-long-left" size={rpx(28)} color={colors.textSecondary} style={styles.chevron} />
                    </Pressable>
                )) : <EmptyLocalBrowser />}
            </View>
        </ScrollView>
    );
}

function OnlineMusicContent() {
    const colors = useColors();
    const navigate = useNavigate();
    const { t } = useI18N();
    const enabledPlugins = useSortedPlugins().filter(plugin => PluginManager.isPluginEnabled(plugin));

    return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={[styles.onlineHero, { backgroundColor: Color(colors.primary).alpha(0.1).toString() }]}>
                <View style={[styles.heroIcon, { backgroundColor: Color(colors.primary).alpha(0.16).toString() }]}>
                    <Icon name="circle-stack" size={rpx(48)} color={colors.primary} />
                </View>
                <View style={styles.heroText}>
                    <ThemeText fontSize="subTitle" fontWeight="bold">
                        {t("musicLibrary.onlineMusic")}
                    </ThemeText>
                    <ThemeText fontSize="description" fontColor="textSecondary" style={styles.heroDescription}>
                        {t("musicLibrary.onlineSummary", { count: enabledPlugins.length })}
                    </ThemeText>
                </View>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("musicLibrary.searchOnline")}
                    style={[styles.onlineSearch, { backgroundColor: colors.primary }]}
                    onPress={() => navigate(ROUTE_PATH.SEARCH_PAGE)}>
                    <Icon name="magnifying-glass" size={rpx(28)} color="#FFFFFF" />
                </Pressable>
            </View>

            <View style={styles.sectionHeader}>
                <ThemeText fontSize="title" fontWeight="bold">
                    {t("musicLibrary.sourcesAndPlatforms")}
                </ThemeText>
                <Pressable accessibilityRole="button" accessibilityLabel={t("musicLibrary.manageSources")} onPress={() => navigate(ROUTE_PATH.SETTING, { type: "plugin" })}>
                    <ThemeText fontSize="caption" color={colors.primary} fontWeight="semibold">
                        {t("musicLibrary.manage")}
                    </ThemeText>
                </Pressable>
            </View>

            <View style={[styles.browserCard, { backgroundColor: colors.card }]}>
                {enabledPlugins.length ? enabledPlugins.map((plugin, index) => (
                    <Pressable
                        key={plugin.hash}
                        accessibilityRole="button"
                        accessibilityLabel={t("musicLibrary.searchWithSource", { name: plugin.name })}
                        style={[styles.browserRow, index < enabledPlugins.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Color(colors.text).alpha(0.07).toString() } : null]}
                        onPress={() => navigate(ROUTE_PATH.SEARCH_PAGE)}>
                        <View style={[styles.browserIcon, { backgroundColor: Color(colors.primary).alpha(0.1).toString() }]}>
                            <Icon name="circle-stack" size={rpx(28)} color={colors.primary} />
                        </View>
                        <View style={styles.browserText}>
                            <ThemeText fontSize="description" fontWeight="semibold" numberOfLines={1}>{plugin.name}</ThemeText>
                            <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.browserDescription}>
                                {plugin.supportedMethods.has("search")
                                    ? t("musicLibrary.searchSupported")
                                    : t("musicLibrary.sourceConnected")}
                            </ThemeText>
                        </View>
                        <Icon name="arrow-long-left" size={rpx(28)} color={colors.textSecondary} style={styles.chevron} />
                    </Pressable>
                )) : (
                    <Pressable accessibilityRole="button" accessibilityLabel={t("musicLibrary.addSource")} style={styles.emptyState} onPress={() => navigate(ROUTE_PATH.SETTING, { type: "plugin" })}>
                        <Icon name="javascript" size={rpx(48)} color="#7892C9" />
                        <ThemeText fontSize="subTitle" fontWeight="semibold" style={styles.emptyTitle}>
                            {t("musicLibrary.emptyOnlineTitle")}
                        </ThemeText>
                        <ThemeText fontSize="description" fontColor="textSecondary" style={styles.emptyDescription}>
                            {t("musicLibrary.emptyOnlineDescription")}
                        </ThemeText>
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
    const [activeTab, setActiveTab] = useState<LibraryTab>("local");
    const libraryTabs: Array<{ key: LibraryTab; title: string }> = [
        { key: "local", title: t("home.localMusic") },
        { key: "online", title: t("musicLibrary.onlineMusic") },
    ];
    const activeIndex = libraryTabs.findIndex(tab => tab.key === activeTab);

    return (
        <View style={[styles.wrapper, { backgroundColor: colors.pageBackground }]}>
            <View style={styles.header}>
                <ThemeText fontSize="appbar" fontWeight="bolder">
                    {t("home.musicLibrary")}
                </ThemeText>
                <Pressable accessibilityRole="button" accessibilityLabel={t("musicLibrary.searchMusic")} style={styles.headerAction} onPress={() => navigate(ROUTE_PATH.SEARCH_PAGE)}>
                    <Icon name="magnifying-glass" size={rpx(32)} color={colors.text} />
                </Pressable>
            </View>
            <PillTabBar
                routes={libraryTabs}
                index={activeIndex}
                variant="underline"
                contentContainerStyle={styles.tabContent}
                onIndexChange={index => setActiveTab(libraryTabs[index].key)}
            />
            {activeTab === "local" ? <LocalMusicContent /> : null}
            {activeTab === "online" ? <OnlineMusicContent /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 1, width: "100%" },
    header: { height: rpx(92), paddingHorizontal: rpx(24), flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerAction: { width: rpx(58), height: rpx(58), alignItems: "center", justifyContent: "center" },
    tabContent: { width: "100%", justifyContent: "space-between", paddingHorizontal: rpx(12) },
    flexContent: { flex: 1, minHeight: 0 },
    rankingHint: { minHeight: rpx(82), paddingHorizontal: rpx(24), flexDirection: "row", alignItems: "center" },
    hintIcon: { width: rpx(56), height: rpx(56), borderRadius: rpx(18), alignItems: "center", justifyContent: "center" },
    hintText: { flex: 1, minWidth: 0, marginLeft: rpx(14) },
    hintDescription: { marginTop: rpx(4) },
    content: { paddingHorizontal: rpx(24), paddingTop: rpx(18), paddingBottom: rpx(40) },
    localHero: { minHeight: rpx(116), paddingHorizontal: rpx(18), borderRadius: rpx(22), flexDirection: "row", alignItems: "center" },
    onlineHero: { minHeight: rpx(116), paddingHorizontal: rpx(18), borderRadius: rpx(22), flexDirection: "row", alignItems: "center" },
    heroIcon: { width: rpx(76), height: rpx(76), borderRadius: rpx(22), alignItems: "center", justifyContent: "center" },
    heroText: { flex: 1, minWidth: 0, marginLeft: rpx(16) },
    heroDescription: { marginTop: rpx(8) },
    chevron: { transform: [{ rotate: "180deg" }] },
    localGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: rpx(18) },
    localCard: { width: "48.5%", minHeight: rpx(126), padding: rpx(16), borderRadius: rpx(18), marginBottom: rpx(12) },
    localIcon: { width: rpx(52), height: rpx(52), borderRadius: rpx(16), alignItems: "center", justifyContent: "center", marginBottom: rpx(10) },
    cardCount: { marginTop: rpx(5) },
    sectionHeader: { minHeight: rpx(64), marginTop: rpx(14), flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    scanAction: { minHeight: rpx(46), paddingHorizontal: rpx(14), borderRadius: rpx(23), flexDirection: "row", alignItems: "center" },
    scanText: { marginLeft: rpx(6) },
    browserCard: { borderRadius: rpx(22), overflow: "hidden" },
    browserRow: { minHeight: rpx(94), paddingHorizontal: rpx(16), flexDirection: "row", alignItems: "center" },
    browserIcon: { width: rpx(56), height: rpx(56), borderRadius: rpx(16), alignItems: "center", justifyContent: "center" },
    browserText: { flex: 1, minWidth: 0, marginHorizontal: rpx(14) },
    browserDescription: { marginTop: rpx(6) },
    emptyState: { minHeight: rpx(230), paddingHorizontal: rpx(32), alignItems: "center", justifyContent: "center" },
    emptyTitle: { marginTop: rpx(14) },
    emptyDescription: { marginTop: rpx(8), textAlign: "center", lineHeight: rpx(34) },
    onlineSearch: { width: rpx(58), height: rpx(58), borderRadius: rpx(29), alignItems: "center", justifyContent: "center" },
});
