import useContentDimensions from "@/hooks/useContentDimensions";
import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import MusicItem from "@/components/mediaItem/musicItem";
import { controlSize, radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import PluginManager, { usePluginDisplayNameResolver, useSortedPlugins } from "@/core/pluginManager";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import TrackPlayer, { useCurrentMusic } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import { isSameMediaItem } from "@/utils/mediaUtils";
import rpx, { fontRpx } from "@/utils/rpx";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";
import useLibraryCharts, { libraryChartKey } from "./useLibraryCharts";

const minimumTouch = Math.max(44, controlSize.minimumTouch);

export default function OnlineMusicLibrary() {
    const colors = useColors();
    const { t } = useI18N();
    const navigate = useNavigate();
    const displayName = usePluginDisplayNameResolver();
    const currentMusic = useCurrentMusic();
    const enabledPlugins = useSortedPlugins().filter(plugin => PluginManager.isPluginEnabled(plugin));
    const [selectedHash, setSelectedHash] = useState<string>();
    const [visibleCard, setVisibleCard] = useState<{ hash?: string; index: number }>({ index: 0 });
    const plugin = enabledPlugins.find(source => source.hash === selectedHash) ?? enabledPlugins[0];
    // A disabled or removed source must never keep showing its previous charts.
    const effectiveIndex = plugin?.hash === visibleCard.hash ? visibleCard.index : 0;
    const charts = useLibraryCharts(plugin, effectiveIndex);
    const { width } = useContentDimensions();
    const contentWidth = width - spacing.xxxl * 2;
    const cardWidth = Math.min(480, charts.charts.length > 1 ? width * 0.62 : contentWidth);
    const cardStride = cardWidth + spacing.sm;
    const openManagement = () => navigate(ROUTE_PATH.SETTING, { type: "plugin" });
    const openCatalog = () => navigate(ROUTE_PATH.TOP_LIST, { initialPluginHash: plugin?.hash });
    const searchable = !!plugin?.supportedMethods.has("search");

    return (
        <ScrollView testID="library-online-content" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {plugin ? (
                <View style={styles.sourceBar}>
                    <Icon name="circle-stack" size={rpx(26)} color={colors.textSecondary} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sourcePicker} contentContainerStyle={styles.sourceOptions}>
                        {enabledPlugins.map(source => {
                            const selected = source.hash === plugin.hash;
                            return (
                                <Pressable key={source.hash} accessibilityRole="tab"
                                    accessibilityLabel={t("musicLibrary.selectSource", { name: displayName(source) })} accessibilityState={{ selected }}
                                    onPress={() => {
                                        setSelectedHash(source.hash); setVisibleCard({ hash: source.hash, index: 0 });
                                    }} style={({ pressed }) => [styles.sourceOption, { opacity: pressed ? 0.7 : 1 }]}>
                                    <View style={[styles.sourceOptionContent, enabledPlugins.length > 1 && selected && { backgroundColor: colors.tonalSurface }]}>
                                        <ThemeText numberOfLines={1} fontSize="subTitle" fontWeight="semibold"
                                            color={enabledPlugins.length > 1 && selected ? colors.onTonal : colors.text}>{displayName(source)}</ThemeText>
                                    </View>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                    {searchable ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={t("musicLibrary.searchWithSource", { name: displayName(plugin) })}
                            style={styles.iconAction} onPress={() => navigate(ROUTE_PATH.SEARCH_PAGE, { pluginHash: plugin.hash })}>
                            <Icon name="magnifying-glass" size={rpx(26)} color={colors.textSecondary} />
                        </Pressable>
                    ) : null}
                    <Pressable accessibilityRole="button" accessibilityLabel={t("musicLibrary.manageSources")}
                        style={styles.iconAction} onPress={openManagement}>
                        <ThemeText fontSize="description" fontColor="textSecondary">{t("musicLibrary.manage")}</ThemeText>
                    </Pressable>
                    {charts.hasCatalog ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={t("musicLibrary.allCharts")} style={styles.textAction} onPress={openCatalog}>
                            <ThemeText fontSize="description" fontColor="textSecondary">{t("myMusic.viewAllShort")}</ThemeText>
                            <Icon name="chevron-right" size={rpx(18)} color={colors.textSecondary} />
                        </Pressable>
                    ) : null}
                </View>
            ) : <View style={styles.heading}>
                <ThemeText fontSize="title" fontWeight="semibold" style={styles.headingTitle}>{t("musicLibrary.charts")}</ThemeText>
            </View>}

            {charts.charts.length ? (
                <FlatList key={plugin?.hash} testID="library-chart-deck" horizontal data={charts.charts}
                    keyExtractor={libraryChartKey} showsHorizontalScrollIndicator={false}
                    style={styles.deck} contentContainerStyle={styles.deckContent}
                    initialNumToRender={2} maxToRenderPerBatch={2} windowSize={3}
                    snapToInterval={cardStride} decelerationRate="fast" scrollEventThrottle={100}
                    onScroll={event => {
                        setVisibleCard({ hash: plugin?.hash, index: Math.max(0, Math.min(charts.charts.length - 1, Math.round(event.nativeEvent.contentOffset.x / cardStride))) });
                    }}
                    renderItem={({ item }) => {
                        const preview = charts.getPreview(item);
                        const musicList = preview?.musicList ?? [];
                        const sheet = { ...(preview?.sheet ?? item), musicList };
                        const title = sheet.title || t("musicLibrary.charts");
                        const ready = preview?.state === "ready" && musicList.length > 0;
                        const play = (music: IMusic.IMusicItem) => TrackPlayer.playWithReplacePlayList(music, musicList, { sheet, routeName: ROUTE_PATH.TOP_LIST_DETAIL });
                        const openDetail = () => navigate(ROUTE_PATH.TOP_LIST_DETAIL, { pluginHash: plugin!.hash, topList: item });
                        return (
                            <View style={[styles.chartCard, { width: cardWidth, backgroundColor: colors.card }]}>
                                <View style={styles.chartHeader}>
                                    <View style={styles.chartTitleBlock}>
                                        <ThemeText fontSize="title" fontWeight="semibold" numberOfLines={2}>{title}</ThemeText>
                                    </View>
                                    {charts.hasDetails ? (
                                        <Pressable accessibilityRole="button" accessibilityLabel={t("musicLibrary.playChartPreview", { name: title, count: musicList.length })}
                                            accessibilityState={{ disabled: !ready }} disabled={!ready}
                                            style={({ pressed }) => [styles.playAction, { opacity: pressed ? 0.7 : 1 }]}
                                            onPress={() => play(musicList[0])}>
                                            <View style={[styles.playContent, { backgroundColor: colors.surface }]}>
                                                <Icon name="play" size={rpx(20)} color={ready ? colors.text : colors.textSecondary} />
                                            </View>
                                        </Pressable>
                                    ) : null}
                                </View>
                                {musicList.length ? musicList.map((music, index) => (
                                    <MusicItem key={`${music.platform}@${music.id}`} musicItem={music} musicSheet={sheet} actions={[]} density="compact"
                                        left={<ThemeText style={styles.rank} fontWeight={index < 3 ? "bold" : "medium"}
                                            color={isSameMediaItem(music, currentMusic) ? colors.active : colors.textSecondary}>{index + 1}</ThemeText>}
                                        onItemPress={play} />
                                )) : (
                                    <View style={styles.chartState}>
                                        {charts.hasDetails && (!preview || preview.state === "loading") ? (
                                            <ActivityIndicator color={colors.primaryText} accessibilityLabel={t("common.loading")} />
                                        ) : <Icon name="musical-note" size={rpx(32)} color={colors.textSecondary} />}
                                        <ThemeText fontSize="description" fontColor="textSecondary" style={styles.stateDescription}>
                                            {t(!charts.hasDetails ? "musicLibrary.chartPreviewUnavailable" : preview?.state === "error" ? "common.failToLoad" : preview?.state === "ready" ? "common.emptyList" : "common.loading")}
                                        </ThemeText>
                                        {preview?.state === "error" ? (
                                            <Pressable accessibilityRole="button" accessibilityLabel={t("common.clickToRetry")} style={styles.textAction} onPress={() => charts.retryPreview(item)}>
                                                <ThemeText fontSize="description" color={colors.primaryText}>{t("common.clickToRetry")}</ThemeText>
                                            </Pressable>
                                        ) : null}
                                    </View>
                                )}
                                <Pressable accessibilityRole="button" accessibilityLabel={t("musicLibrary.openChart", { name: title })}
                                    style={[styles.chartFooter, { borderTopColor: colors.divider }]} onPress={charts.hasDetails ? openDetail : openCatalog}>
                                    <ThemeText fontSize="caption" fontColor="textSecondary">{t(charts.hasDetails ? "musicLibrary.fullChart" : "musicLibrary.allCharts")}</ThemeText>
                                    <Icon name="chevron-right" size={rpx(18)} color={colors.textSecondary} />
                                </Pressable>
                            </View>
                        );
                    }}
                />
            ) : (
                <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
                    {charts.loading ? <ActivityIndicator color={colors.primaryText} /> : <Icon name="musical-note" size={rpx(42)} color={colors.textSecondary} />}
                    <ThemeText fontSize="subTitle" fontWeight="medium" style={styles.stateDescription}>
                        {t(!plugin ? "musicLibrary.emptyOnlineTitle" : charts.loading ? "common.loading" : charts.hasError ? "common.failToLoad" : !charts.hasCatalog ? "musicLibrary.chartsUnsupported" : "musicLibrary.noCharts")}
                    </ThemeText>
                    {!charts.loading ? <ThemeText fontSize="description" fontColor="textSecondary" style={styles.stateDescription}>
                        {t(!plugin ? "musicLibrary.emptyOnlineDescription" : !charts.hasCatalog ? "musicLibrary.chartsUnsupportedHint" : "musicLibrary.chartsRetryHint")}
                    </ThemeText> : null}
                    {!charts.loading ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={t(!plugin ? "musicLibrary.addSource" : charts.hasCatalog ? "common.clickToRetry" : "musicLibrary.manageSources")}
                            style={styles.textAction} onPress={!plugin || !charts.hasCatalog ? openManagement : charts.retryCatalog}>
                            <ThemeText fontSize="description" color={colors.primaryText}>{t(!plugin ? "musicLibrary.addSource" : charts.hasCatalog ? "common.clickToRetry" : "musicLibrary.manageSources")}</ThemeText>
                        </Pressable>
                    ) : null}
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: { paddingHorizontal: spacing.xxxl, paddingTop: spacing.xs, paddingBottom: spacing.xxxl },
    sourceBar: { flexDirection: "row", alignItems: "center", gap: spacing.xxs },
    sourcePicker: { flex: 1, minWidth: 0 },
    sourceOptions: { alignItems: "center", gap: spacing.xxs },
    sourceOption: { minHeight: minimumTouch, minWidth: minimumTouch, justifyContent: "center" },
    sourceOptionContent: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs, borderRadius: radius.sm, maxWidth: rpx(220) },
    iconAction: { minHeight: minimumTouch, minWidth: minimumTouch, alignItems: "center", justifyContent: "center" },
    heading: { minHeight: minimumTouch, flexDirection: "row", alignItems: "center" },
    headingTitle: { flex: 1, minWidth: 0 },
    textAction: { minHeight: minimumTouch, minWidth: minimumTouch, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xxs },
    deck: { marginHorizontal: -spacing.xxxl, marginTop: spacing.sm },
    deckContent: { paddingHorizontal: spacing.xxxl, gap: spacing.sm, alignItems: "flex-start" },
    chartCard: { borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    chartHeader: { minHeight: minimumTouch, flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.xxs },
    chartTitleBlock: { flex: 1, minWidth: 0 },
    playAction: { minWidth: minimumTouch, minHeight: minimumTouch, alignItems: "center", justifyContent: "center" },
    playContent: { width: rpx(64), height: rpx(40), borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
    rank: { width: rpx(32), marginRight: spacing.xs, textAlign: "center", fontSize: fontRpx(22) },
    chartFooter: { minHeight: minimumTouch, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs },
    chartState: { minHeight: rpx(200), alignItems: "center", justifyContent: "center", paddingVertical: spacing.lg },
    emptyCard: { borderRadius: radius.xl, padding: spacing.xl, marginTop: spacing.xs, alignItems: "center" },
    stateDescription: { marginTop: spacing.sm, textAlign: "center" },
});
