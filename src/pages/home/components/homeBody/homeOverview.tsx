import FastImage from "@/components/base/fastImage";
import Icon, { IIconName } from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import MusicItem from "@/components/mediaItem/musicItem";
import { showPanel } from "@/components/panels/usePanel";
import { ImgAsset } from "@/constants/assetsConst";
import { controlSize, radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { usePluginDisplayNameResolver } from "@/core/pluginManager";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import TrackPlayer from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import useMotion from "@/hooks/useMotion";
import rpx, { fontRpx } from "@/utils/rpx";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import HomeFeatureDeck from "../HomeFeatureDeck";
import useHomeDiscovery, { IHomeDiscoveryPreview } from "./useHomeDiscovery";
import useHomeOverview from "./useHomeOverview";

const minimumTouch = Math.max(44, controlSize.minimumTouch);

export default function HomeOverview() {
    const data = useHomeOverview();
    const preview = useHomeDiscovery(data.topListPlugins);
    const navigate = useNavigate();
    const colors = useColors();
    const { t } = useI18N();
    const { reduceMotion } = useMotion();
    const scroll = useRef<ScrollView>(null);
    const anchors = useRef({ favorites: 0, charts: 0 });
    const navigationHeight = useRef(0);
    const [activeSection, setActiveSection] = useState("recommend");
    const hasCharts = data.topListPlugins.length > 0 || preview.topLists.length > 0 || preview.loading;
    const sections = [
        { key: "recommend", title: t("home.forYou") },
        { key: "favorites", title: t("home.myCollection") },
        { key: "charts", title: t("home.topList") },
    ];
    const jumpTo = (key: string) => {
        if (key === "charts" && !hasCharts) {
            navigate(ROUTE_PATH.TOP_LIST);
            return;
        }
        const target = key === "recommend" ? 0 : anchors.current[key as "favorites" | "charts"] - navigationHeight.current;
        scroll.current?.scrollTo({ y: Math.max(0, target), animated: !reduceMotion });
    };

    return (
        <ScrollView
            testID="home-overview-scroll"
            ref={scroll}
            style={styles.wrapper}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            stickyHeaderIndices={[0]}
            scrollEventThrottle={64}
            onScroll={event => {
                const position = Math.max(0, event.nativeEvent.contentOffset.y) + navigationHeight.current + spacing.sm;
                const next = hasCharts && anchors.current.charts > 0 && position >= anchors.current.charts ? "charts"
                    : anchors.current.favorites > 0 && position >= anchors.current.favorites ? "favorites" : "recommend";
                setActiveSection(previous => previous === next ? previous : next);
            }}>
            <View testID="home-section-navigation" style={[styles.channels, { backgroundColor: colors.pageBackground }]} onLayout={event => {
                navigationHeight.current = event.nativeEvent.layout.height;
            }}>
                {sections.map(section => (
                    <Pressable
                        key={section.key}
                        accessibilityRole="button"
                        accessibilityLabel={section.title}
                        accessibilityState={{ selected: activeSection === section.key }}
                        style={styles.channelTarget}
                        onPress={() => jumpTo(section.key)}>
                        <View style={[styles.channelFill, activeSection === section.key ? { backgroundColor: colors.primary } : undefined]}>
                            <ThemeText fontSize="title" fontWeight={activeSection === section.key ? "semibold" : "regular"} color={activeSection === section.key ? colors.onPrimary : colors.textSecondary}>{section.title}</ThemeText>
                        </View>
                    </Pressable>
                ))}
            </View>
            <HomeFeatureDeck
                music={data.featuredMusic}
                favoriteSheet={data.favoriteSheet}
                favoriteCount={data.favoriteMusics.length}
                favoriteArtwork={data.favoriteMusics[0]?.artwork}
                topListPlugins={data.topListPlugins}
                topListCache={data.topListCache}
                recentHistory={data.recentHistory}
                tasteArtists={data.tasteArtists}
            />
            <View testID="home-favorites-section" onLayout={event => {
                anchors.current.favorites = event.nativeEvent.layout.y;
            }}>
                <FavoriteListening musics={data.favoriteMusics} sheet={data.favoriteSheet} />
            </View>
            <View testID="home-charts-section" onLayout={event => {
                anchors.current.charts = event.nativeEvent.layout.y;
            }}>
                <Discovery preview={preview} hasSource={data.topListPlugins.length > 0} />
            </View>
            <QuickAccess
                historyCount={data.historyCount}
                favoriteCount={data.favoriteSheet?.worksNum ?? 0}
                favoriteSheetId={data.favoriteSheet?.id}
            />
            <RecentListening musics={data.recentMusics} />
        </ScrollView>
    );
}

function TextAction({ title, onPress, label }: { title: string; onPress: () => void; label?: string }) {
    const colors = useColors();
    return (
        <Pressable accessibilityRole="button" accessibilityLabel={label ?? title} onPress={onPress} style={styles.textAction}>
            <ThemeText fontSize="description" fontColor="textSecondary">{title}</ThemeText>
            <Icon name="chevron-right" size={rpx(20)} color={colors.textSecondary} />
        </Pressable>
    );
}

function SectionHeader({ title, action, leadingAction }: { title: string; action?: React.ReactNode; leadingAction?: React.ReactNode }) {
    return (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionHeading}>
                <ThemeText fontSize="title" fontWeight="bold" style={styles.sectionTitle}>{title}</ThemeText>
                {leadingAction}
            </View>
            {action}
        </View>
    );
}

function QuickAccess({ historyCount, favoriteCount, favoriteSheetId }: {
    historyCount: number;
    favoriteCount: number;
    favoriteSheetId?: string;
}) {
    const { t } = useI18N();
    const navigate = useNavigate();
    const colors = useColors();
    const items: Array<{ icon: IIconName; title: string; subtitle: string; onPress: () => void }> = [
        { icon: "musical-note", title: t("home.recommendSheet"), subtitle: t("home.discovery"), onPress: () => navigate(ROUTE_PATH.RECOMMEND_SHEETS) },
        { icon: "clock-outline", title: t("home.playHistory"), subtitle: t("home.songCount", { count: historyCount }), onPress: () => showPanel("PlayList", { initialTab: "history" }) },
        { icon: "heart-outline", title: t("home.favoriteSheet"), subtitle: t("home.songCount", { count: favoriteCount }), onPress: () => {
            if (favoriteSheetId) navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, { id: favoriteSheetId });
        } },
        { icon: "inbox-arrow-down", title: t("home.importPlaylist.a11y"), subtitle: t("home.scanLocal"), onPress: () => navigate(ROUTE_PATH.LOCAL) },
    ];
    return (
        <View style={styles.quickRow}>
            {items.map(item => (
                <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={item.title} accessibilityHint={item.subtitle} onPress={item.onPress} style={styles.quickItem}>
                    <Icon name={item.icon} size={rpx(28)} color={colors.textSecondary} />
                    <ThemeText fontSize="tag" fontColor="textSecondary" style={styles.quickTitle}>{item.title}</ThemeText>
                </Pressable>
            ))}
        </View>
    );
}

function FavoriteListening({ musics = [], sheet }: { musics?: IMusic.IMusicItem[]; sheet: IMusic.IMusicSheetItemBase }) {
    const { t } = useI18N();
    const colors = useColors();
    const navigate = useNavigate();
    const { width } = useWindowDimensions();
    const groupWidth = Math.min(520, width * 0.86, width - spacing.xxxl * 2);
    const groups = Array.from({ length: Math.ceil(Math.min(9, musics.length) / 3) }, (_, index) => musics.slice(index * 3, index * 3 + 3));
    const fullSheet = { ...sheet, musicList: musics };
    const play = (music: IMusic.IMusicItem) => TrackPlayer.playWithReplacePlayList(music, musics, { sheet: fullSheet, routeName: ROUTE_PATH.LOCAL_SHEET_DETAIL });
    return (
        <View style={styles.section}>
            <SectionHeader
                title={t("home.favoriteReplayTitle")}
                leadingAction={musics.length ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("musicLibrary.playAllCount", { count: musics.length })}
                        onPress={() => play(musics[0])}
                        style={styles.iconAction}>
                        <View style={[styles.smallPlay, { backgroundColor: colors.card }]}><Icon name="play" size={rpx(22)} color={colors.text} /></View>
                    </Pressable>
                ) : null}
                action={<TextAction title={t("myMusic.viewAllShort")} label={`${t("home.favoriteSheet")} · ${t("home.viewAll")}`} onPress={() => navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, { id: sheet.id })} />}
            />
            {musics.length ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.favoriteStrip}
                    snapToInterval={groupWidth + spacing.xl}
                    decelerationRate="fast">
                    {groups.map((group, index) => (
                        <View key={index} style={{ width: groupWidth }}>
                            {group.map(music => (
                                <MusicItem
                                    key={music.platform + "@" + music.id}
                                    musicItem={music}
                                    showCover
                                    density="compact"
                                    presentation="discovery"
                                    actions={["favorite"]}
                                    onItemPress={play}
                                />
                            ))}
                        </View>
                    ))}
                </ScrollView>
            ) : (
                <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
                    <ThemeText fontSize="description" fontColor="textSecondary" style={styles.flexText}>{t("home.favoritePreviewEmpty")}</ThemeText>
                    <TextAction title={t("home.exploreMusic")} onPress={() => navigate(ROUTE_PATH.SEARCH_PAGE)} />
                </View>
            )}
        </View>
    );
}

function Discovery({ preview, hasSource }: { preview: IHomeDiscoveryPreview; hasSource: boolean }) {
    const colors = useColors();
    const { t } = useI18N();
    const navigate = useNavigate();
    const getDisplayName = usePluginDisplayNameResolver();
    const { width } = useWindowDimensions();
    const coverWidth = Math.min(180, (width - spacing.xxxl * 2 - spacing.xl * 2) / 3);
    const openAll = () => navigate(ROUTE_PATH.TOP_LIST, { initialPluginHash: preview.topListPluginHash });
    if (!hasSource && !preview.topLists.length && !preview.loading) return null;
    return (
        <View style={styles.section}>
            <SectionHeader title={t("home.topList")} action={<TextAction title={t("myMusic.viewAllShort")} label={t("home.topList")} onPress={openAll} />} />
            {preview.topListPluginName ? (
                <ThemeText fontSize="tag" fontColor="textSecondary" style={styles.sourceName}>{getDisplayName(preview.topListPluginName)}</ThemeText>
            ) : null}
            {preview.topLists.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coverStrip}>
                    {preview.topLists.map((sheet, index) => (
                        <Pressable
                            key={preview.topListPluginHash + "@" + (sheet.id ?? index)}
                            accessibilityRole="button"
                            accessibilityLabel={sheet.title || t("common.unknownName")}
                            style={{ width: coverWidth, minHeight: minimumTouch }}
                            onPress={() => navigate(ROUTE_PATH.TOP_LIST_DETAIL, { pluginHash: preview.topListPluginHash, topList: sheet })}>
                            <FastImage source={sheet.coverImg || sheet.artwork} placeholderSource={ImgAsset.albumDefault} style={[styles.cover, { backgroundColor: colors.card }]} />
                            <ThemeText numberOfLines={1} fontSize="subTitle" style={styles.coverTitle}>{sheet.title || t("common.unknownName")}</ThemeText>
                        </Pressable>
                    ))}
                </ScrollView>
            ) : (
                <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
                    {preview.loading ? <ActivityIndicator size="small" color={colors.textSecondary} /> : <Icon name="trophy" size={rpx(30)} color={colors.textSecondary} />}
                    <ThemeText fontSize="description" fontColor="textSecondary" style={styles.flexText}>{t(preview.loading ? "common.loading" : preview.hasError ? "common.failToLoad" : "common.emptyList")}</ThemeText>
                    {!preview.loading ? <TextAction title={t("common.view")} onPress={openAll} /> : null}
                </View>
            )}
        </View>
    );
}

function RecentListening({ musics }: { musics: IMusic.IMusicItem[] }) {
    const { t } = useI18N();
    const colors = useColors();
    const getDisplayName = usePluginDisplayNameResolver();
    const { width } = useWindowDimensions();
    const coverWidth = Math.min(180, (width - spacing.xxxl * 2 - spacing.xl * 2) / 3);
    if (!musics.length) return null;
    return (
        <View style={styles.section}>
            <SectionHeader title={t("home.recentListening")} action={<TextAction title={t("myMusic.viewAllShort")} onPress={() => showPanel("PlayList", { initialTab: "history" })} />} />
            <View style={styles.coverStrip}>
                {musics.map(music => (
                    <Pressable key={music.platform + "@" + music.id} accessibilityRole="button" accessibilityLabel={music.title + " · " + music.artist} onPress={() => TrackPlayer.play(music)} style={{ width: coverWidth, minHeight: minimumTouch }}>
                        <View>
                            <FastImage source={music.artwork} placeholderSource={ImgAsset.albumDefault} style={[styles.cover, { backgroundColor: colors.card }]} />
                            <View style={[styles.playBadge, { backgroundColor: colors.inverseSurface }]}><Icon name="play" size={rpx(20)} color={colors.onInverse} /></View>
                        </View>
                        <ThemeText numberOfLines={1} fontSize="subTitle" style={styles.coverTitle}>{music.title}</ThemeText>
                        <ThemeText numberOfLines={1} fontSize="tag" fontColor="textSecondary" style={styles.coverArtist}>{[music.artist, getDisplayName(music.platform)].filter(Boolean).join(" · ")}</ThemeText>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 1, width: "100%" },
    content: { paddingBottom: spacing.xxxl },
    channels: { paddingHorizontal: spacing.xxl, paddingVertical: spacing.xxs, flexDirection: "row", gap: spacing.sm },
    channelTarget: { minHeight: minimumTouch, minWidth: minimumTouch, justifyContent: "center" },
    channelFill: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
    quickRow: { paddingHorizontal: spacing.xxxl, paddingTop: spacing.lg, paddingBottom: spacing.sm, flexDirection: "row", alignItems: "stretch" },
    quickItem: { flex: 1, minWidth: 0, minHeight: minimumTouch, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xxs, paddingHorizontal: spacing.xxs },
    quickTitle: { flexShrink: 1, textAlign: "center" },
    section: { marginTop: spacing.xl },
    sectionHeader: { paddingHorizontal: spacing.xxxl, minHeight: minimumTouch, marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    sectionHeading: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.xs },
    sectionTitle: { flexShrink: 1, minWidth: 0, fontSize: fontRpx(30) },
    textAction: { minWidth: minimumTouch, minHeight: minimumTouch, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.xxs },
    iconAction: { minWidth: minimumTouch, minHeight: minimumTouch, alignItems: "center", justifyContent: "center" },
    smallPlay: { width: rpx(44), height: rpx(44), borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
    favoriteStrip: { paddingHorizontal: spacing.xxxl, gap: spacing.xl, alignItems: "flex-start" },
    emptyCard: { marginHorizontal: spacing.xxxl, padding: spacing.md, borderRadius: radius.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    flexText: { flex: 1, minWidth: 0 },
    sourceName: { paddingHorizontal: spacing.xxxl, marginBottom: spacing.sm },
    coverStrip: { paddingHorizontal: spacing.xxxl, gap: spacing.xl, flexDirection: "row" },
    cover: { width: "100%", aspectRatio: 1, borderRadius: radius.lg },
    coverTitle: { marginTop: spacing.sm },
    coverArtist: { marginTop: spacing.xs },
    playBadge: { position: "absolute", right: spacing.xs, bottom: spacing.xs, width: rpx(36), height: rpx(36), borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
