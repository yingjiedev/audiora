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
import rpx, { fontRpx } from "@/utils/rpx";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import HomeHero from "../HomeHero";
import ShiYinCard from "../ShiYinCard";
import useHomeDiscovery, { IHomeDiscoveryPreview } from "./useHomeDiscovery";
import useHomeOverview from "./useHomeOverview";

const minimumTouch = Math.max(44, controlSize.minimumTouch);

export default function HomeOverview() {
    const data = useHomeOverview();
    const preview = useHomeDiscovery(data.topListPlugins);
    const { width } = useWindowDimensions();
    const cardWidth = Math.min(420, width - spacing.xxxl * 2, width * 0.76);
    const cardHeight = Math.max(180, rpx(252));

    return (
        <ScrollView style={styles.wrapper} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.featureDeck}
                snapToInterval={cardWidth + spacing.md}
                decelerationRate="fast">
                <View style={{ width: cardWidth, minHeight: cardHeight }}>
                    <HomeHero music={data.featuredMusic} />
                </View>
                <View style={{ width: cardWidth, minHeight: cardHeight }}>
                    <ShiYinCard
                        topListPlugins={data.topListPlugins}
                        topListCache={data.topListCache}
                        excludeMusicItems={data.recentHistory}
                        preferredArtists={data.tasteArtists}
                    />
                </View>
            </ScrollView>
            <QuickAccess
                historyCount={data.historyCount}
                favoriteCount={data.favoriteSheet?.worksNum ?? 0}
                favoriteSheetId={data.favoriteSheet?.id}
            />
            <FavoriteListening musics={data.favoriteMusics} sheet={data.favoriteSheet} />
            <Discovery preview={preview} hasSource={data.topListPlugins.length > 0} />
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

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
    return (
        <View style={styles.sectionHeader}>
            <ThemeText fontSize="title" fontWeight="bold" style={styles.sectionTitle}>{title}</ThemeText>
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
                <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={item.title} onPress={item.onPress} style={styles.quickItem}>
                    <View style={styles.quickIcon}><Icon name={item.icon} size={rpx(40)} color={colors.text} /></View>
                    <ThemeText fontSize="description" style={styles.quickTitle}>{item.title}</ThemeText>
                    <ThemeText fontSize="tag" fontColor="textSecondary" style={styles.quickCount}>{item.subtitle}</ThemeText>
                </Pressable>
            ))}
        </View>
    );
}

function FavoriteListening({ musics = [], sheet }: { musics?: IMusic.IMusicItem[]; sheet: IMusic.IMusicSheetItemBase }) {
    const { t } = useI18N();
    const colors = useColors();
    const navigate = useNavigate();
    const fullSheet = { ...sheet, musicList: musics };
    const play = (music: IMusic.IMusicItem) => TrackPlayer.playWithReplacePlayList(music, musics, { sheet: fullSheet, routeName: ROUTE_PATH.LOCAL_SHEET_DETAIL });
    return (
        <View style={styles.section}>
            <SectionHeader
                title={t("home.favoriteSheet")}
                action={
                    <View style={styles.sectionActions}>
                        {musics.length ? (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t("musicLibrary.playAllCount", { count: musics.length })}
                                onPress={() => play(musics[0])}
                                style={styles.iconAction}>
                                <View style={[styles.smallPlay, { backgroundColor: colors.card }]}><Icon name="play" size={rpx(22)} color={colors.text} /></View>
                            </Pressable>
                        ) : null}
                        <TextAction title={t("myMusic.viewAllShort")} label={`${t("home.favoriteSheet")} · ${t("home.viewAll")}`} onPress={() => navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, { id: sheet.id })} />
                    </View>
                }
            />
            {musics.length ? musics.slice(0, 3).map(music => (
                <MusicItem
                    key={music.platform + "@" + music.id}
                    musicItem={music}
                    showCover
                    density="compact"
                    actions={["favorite"]}
                    onItemPress={play}
                    containerStyle={styles.songRow}
                />
            )) : (
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
    content: { paddingTop: spacing.md, paddingBottom: spacing.xxxl },
    featureDeck: { paddingHorizontal: spacing.xxxl, gap: spacing.md, alignItems: "stretch" },
    quickRow: { paddingHorizontal: spacing.xxxl, paddingTop: spacing.xl * 1.5, paddingBottom: spacing.sm, flexDirection: "row", alignItems: "stretch" },
    quickItem: { flex: 1, minWidth: 0, minHeight: minimumTouch, alignItems: "center", paddingHorizontal: spacing.xxs },
    quickIcon: { height: rpx(48), alignItems: "center", justifyContent: "center" },
    quickTitle: { flexGrow: 1, marginTop: spacing.xs, textAlign: "center" },
    quickCount: { marginTop: spacing.xxs, textAlign: "center" },
    section: { marginTop: spacing.xl },
    sectionHeader: { paddingHorizontal: spacing.xxxl, minHeight: minimumTouch, marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    sectionTitle: { flex: 1, minWidth: 0, fontSize: fontRpx(30) },
    sectionActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    textAction: { minWidth: minimumTouch, minHeight: minimumTouch, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.xxs },
    iconAction: { minWidth: minimumTouch, minHeight: minimumTouch, alignItems: "center", justifyContent: "center" },
    smallPlay: { width: rpx(44), height: rpx(44), borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
    songRow: { marginHorizontal: spacing.xxxl },
    emptyCard: { marginHorizontal: spacing.xxxl, padding: spacing.md, borderRadius: radius.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    flexText: { flex: 1, minWidth: 0 },
    sourceName: { paddingHorizontal: spacing.xxxl, marginBottom: spacing.sm },
    coverStrip: { paddingHorizontal: spacing.xxxl, gap: spacing.xl, flexDirection: "row" },
    cover: { width: "100%", aspectRatio: 1, borderRadius: radius.lg },
    coverTitle: { marginTop: spacing.sm },
    coverArtist: { marginTop: spacing.xs },
    playBadge: { position: "absolute", right: spacing.xs, bottom: spacing.xs, width: rpx(36), height: rpx(36), borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
