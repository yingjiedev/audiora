import FastImage from "@/components/base/fastImage";
import Icon, { IIconName } from "@/components/base/icon.tsx";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import i18n, { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import TrackPlayer, { useMusicState, useProgress } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import { musicIsPaused } from "@/utils/trackUtils";
import Color from "color";
import React, { ReactNode, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { DimensionValue } from "react-native";
import type { Plugin } from "@/core/pluginManager";
import useHomeDiscovery, {
    IHomeDiscoveryPreview,
} from "./useHomeDiscovery";
import useHomeOverview from "./useHomeOverview";
import HomeHero from "../HomeHero";

function formatTime(value?: number) {
    const seconds = Math.max(0, Math.floor(value ?? 0));
    const minute = Math.floor(seconds / 60);
    const second = seconds % 60;
    return `${minute}:${String(second).padStart(2, "0")}`;
}

function getProgressPercent(
    position?: number,
    duration?: number,
): DimensionValue {
    if (!position || !duration || duration <= 0) {
        return "0%";
    }
    return `${Math.min(
        100,
        Math.max(0, (position / duration) * 100),
    )}%` as DimensionValue;
}

function getMusicDescription(musicItem?: IMusic.IMusicItem | null) {
    if (!musicItem) {
        return "";
    }
    return [musicItem.artist, musicItem.platform].filter(Boolean).join(" · ");
}

function ForwardIcon(props: { size: number; color: string }) {
    return (
        <Icon
            name="arrow-left"
            size={props.size}
            color={props.color}
            style={styles.forwardIcon}
        />
    );
}

export default function HomeOverview() {
    const data = useHomeOverview();
    const discoveryPreview = useHomeDiscovery(data.topListPlugins);

    return (
        <ScrollView
            style={styles.wrapper}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}>
            <HomeHero />
            <RecommendedPlaylists />
            <Discovery
                topListPlugins={data.topListPlugins}
                preview={discoveryPreview}
            />
            <ContinueListening
                currentMusic={data.currentMusic}
                featuredMusic={data.featuredMusic}
            />
            <RecentListening musics={data.recentMusics} />
        </ScrollView>
    );
}

function ContinueListening(props: {
    currentMusic: IMusic.IMusicItem | null;
    featuredMusic: IMusic.IMusicItem | null;
}) {
    const { currentMusic, featuredMusic } = props;
    // 进度/播放态是高频更新源，仅在本子组件内订阅，避免整个首页随进度每秒重渲染。
    const musicState = useMusicState();
    const { position, duration } = useProgress();
    const colors = useColors();
    const { t } = useI18N();
    const navigate = useNavigate();

    const isCurrent =
        !!currentMusic &&
        !!featuredMusic &&
        currentMusic.platform === featuredMusic.platform &&
        currentMusic.id === featuredMusic.id;
    const progressDuration = isCurrent
        ? duration || featuredMusic?.duration
        : featuredMusic?.duration;
    const progressPosition = isCurrent ? position : 0;

    if (!featuredMusic) {
        return (
            <Section title={t("home.continueListening")}>
                <View
                    style={[styles.emptyStart, { backgroundColor: colors.card }]}>
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        style={styles.emptyStartText}>
                        {t("home.continueListeningEmpty")}
                    </ThemeText>
                    <QuickPill
                        icon="magnifying-glass"
                        title={t("home.exploreMusic")}
                        onPress={() => navigate(ROUTE_PATH.SEARCH_PAGE)}
                    />
                </View>
            </Section>
        );
    }

    return (
        <Section title={t("home.continueListening")}>
            <Pressable
                style={[
                    styles.continueCard,
                    {
                        backgroundColor: colors.card,
                        borderColor: Color(colors.text).alpha(0.06).toString(),
                    },
                ]}
                onPress={() => {
                    if (isCurrent) {
                        navigate(ROUTE_PATH.MUSIC_DETAIL);
                    } else {
                        TrackPlayer.play(featuredMusic);
                    }
                }}>
                <FastImage
                    source={featuredMusic.artwork}
                    placeholderSource={ImgAsset.albumDefault}
                    style={styles.continueCover}
                />
                <View style={styles.continueContent}>
                    <View style={styles.continueTopLine}>
                        <ThemeText
                            numberOfLines={1}
                            fontSize="title"
                            fontWeight="bold"
                            style={styles.continueTitle}>
                            {featuredMusic.title}
                        </ThemeText>
                        <View
                            style={[
                                styles.platformBadge,
                                {
                                    backgroundColor: Color(colors.primary)
                                        .alpha(0.14)
                                        .toString(),
                                },
                            ]}>
                            <ThemeText fontSize="tag" color={colors.primary}>
                                {featuredMusic.platform}
                            </ThemeText>
                        </View>
                    </View>
                    <ThemeText
                        numberOfLines={1}
                        fontSize="description"
                        fontColor="textSecondary"
                        style={styles.continueDesc}>
                        {featuredMusic.artist || featuredMusic.album}
                    </ThemeText>
                    <View style={styles.progressRow}>
                        <ThemeText fontSize="tag" fontColor="textSecondary">
                            {formatTime(progressPosition)}
                        </ThemeText>
                        <View
                            style={[
                                styles.progressTrack,
                                {
                                    backgroundColor: Color(colors.text)
                                        .alpha(0.1)
                                        .toString(),
                                },
                            ]}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        backgroundColor: colors.primary,
                                        width: getProgressPercent(
                                            progressPosition,
                                            progressDuration,
                                        ),
                                    },
                                ]}
                            />
                        </View>
                        <ThemeText fontSize="tag" fontColor="textSecondary">
                            {formatTime(progressDuration)}
                        </ThemeText>
                    </View>
                </View>
                <Pressable
                    style={[
                        styles.playButton,
                        {
                            backgroundColor: Color(colors.primary)
                                .alpha(0.2)
                                .toString(),
                        },
                    ]}
                    onPress={() => {
                        if (isCurrent && !musicIsPaused(musicState)) {
                            TrackPlayer.pause();
                        } else {
                            TrackPlayer.play(featuredMusic);
                        }
                    }}>
                    <Icon
                        name={
                            isCurrent && !musicIsPaused(musicState)
                                ? "pause"
                                : "play"
                        }
                        size={rpx(36)}
                        color={colors.primary}
                    />
                </Pressable>
            </Pressable>
        </Section>
    );
}

function RecentListening(props: { musics: IMusic.IMusicItem[] }) {
    const { musics } = props;
    const { t } = useI18N();
    const colors = useColors();

    if (!musics.length) {
        return null;
    }

    return (
        <Section title={t("home.recentListening")} compact>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentContainer}>
                {musics.map(musicItem => (
                    <Pressable
                        key={`${musicItem.platform}-${musicItem.id}`}
                        style={[
                            styles.recentItem,
                            { backgroundColor: colors.card },
                        ]}
                        onPress={() => TrackPlayer.play(musicItem)}>
                        <FastImage
                            source={musicItem.artwork}
                            placeholderSource={ImgAsset.albumDefault}
                            style={styles.recentCover}
                        />
                        <View style={styles.recentText}>
                            <ThemeText
                                numberOfLines={1}
                                fontSize="description"
                                fontWeight="semibold">
                                {musicItem.title}
                            </ThemeText>
                            <ThemeText
                                numberOfLines={1}
                                fontSize="tag"
                                fontColor="textSecondary"
                                style={styles.smallTextMargin}>
                                {getMusicDescription(musicItem)}
                            </ThemeText>
                        </View>
                    </Pressable>
                ))}
            </ScrollView>
        </Section>
    );
}

function RecommendedPlaylists() {
    const colors = useColors();
    const { t } = useI18N();
    const navigate = useNavigate();

    return (
        <Section
            title={t("home.recommendSheet")}
            right={
                <Pressable
                    style={styles.sectionTextButton}
                    onPress={() => navigate(ROUTE_PATH.RECOMMEND_SHEETS)}>
                    <ThemeText fontSize="description" fontWeight="semibold" color={colors.primary}>
                        {t("home.viewAll")}
                    </ThemeText>
                    <ForwardIcon size={rpx(26)} color={colors.primary} />
                </Pressable>
            }>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("home.recommendSheet")}
                style={[
                    styles.recommendCard,
                    { backgroundColor: Color(colors.primary).alpha(0.1).toString() },
                ]}
                onPress={() => navigate(ROUTE_PATH.RECOMMEND_SHEETS)}>
                <View
                    style={[
                        styles.recommendIcon,
                        { backgroundColor: Color(colors.primary).alpha(0.16).toString() },
                    ]}>
                    <Icon name="motion-play" size={rpx(38)} color={colors.primary} />
                </View>
                <View style={styles.recommendText}>
                    <ThemeText fontSize="subTitle" fontWeight="bold" numberOfLines={1}>
                        {t("home.recommendForYou")}
                    </ThemeText>
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        numberOfLines={2}
                        style={styles.smallTextMargin}>
                        {t("home.recommendDescription")}
                    </ThemeText>
                </View>
                <ForwardIcon size={rpx(30)} color={colors.textSecondary ?? colors.text} />
            </Pressable>
        </Section>
    );
}

function Discovery(props: {
    topListPlugins: Plugin[];
    preview: IHomeDiscoveryPreview;
}) {
    const { topListPlugins, preview } = props;
    const colors = useColors();
    const { t } = useI18N();
    const navigate = useNavigate();

    const previewItems = useMemo(
        () =>
            preview.topLists.map((item, index) => ({
                key: `top-${preview.topListPluginHash}-${item.id ?? index}`,
                type: t("home.topList"),
                pluginHash: preview.topListPluginHash,
                pluginName: preview.topListPluginName,
                title: item.title ?? i18n.t("common.unknownName"),
                desc: item.description ?? preview.topListPluginName ?? "",
                cover: item.coverImg ?? item.artwork,
                action: () => {
                    if (preview.topListPluginHash) {
                        navigate(ROUTE_PATH.TOP_LIST_DETAIL, {
                            pluginHash: preview.topListPluginHash,
                            topList: item,
                        });
                    }
                },
            })),
        [navigate, preview, t],
    );
    const fallbackPluginName =
        preview.topListPluginName ?? topListPlugins[0]?.name ?? t("home.topList");
    const fallbackDescription = preview.hasError
        ? `${t("home.topList")} · ${t("common.failToLoad")}`
        : `${t("home.topList")} · ${t("common.emptyList")}`;

    if (!topListPlugins.length && !previewItems.length && !preview.loading) {
        return null;
    }

    return (
        <Section
            title={t("home.topList")}
            right={
                <Pressable
                    style={styles.sectionTextButton}
                    onPress={() =>
                        navigate(ROUTE_PATH.TOP_LIST, {
                            initialPluginHash: preview.topListPluginHash,
                        })
                    }>
                    <ThemeText
                        fontSize="description"
                        fontWeight="semibold"
                        color={colors.primary}>
                        {t("common.view")}
                    </ThemeText>
                    <ForwardIcon size={rpx(26)} color={colors.primary} />
                </Pressable>
            }>
            {previewItems.length || preview.loading ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.discoveryPreviewContainer}>
                    {previewItems.map(item => (
                        <Pressable
                            key={item.key}
                            style={[
                                styles.discoveryPreviewCard,
                                { backgroundColor: colors.card },
                            ]}
                            onPress={item.action}>
                            <FastImage
                                source={item.cover}
                                placeholderSource={ImgAsset.albumDefault}
                                style={styles.discoveryPreviewCover}
                            />
                            <View style={styles.discoveryPreviewMeta}>
                                <View
                                    style={[
                                        styles.platformBadge,
                                        {
                                            backgroundColor: Color(
                                                colors.primary,
                                            )
                                                .alpha(0.14)
                                                .toString(),
                                        },
                                    ]}>
                                    <ThemeText
                                        numberOfLines={1}
                                        fontSize="tag"
                                        color={colors.primary}>
                                        {item.type}
                                    </ThemeText>
                                </View>
                                <ThemeText
                                    numberOfLines={1}
                                    fontSize="tag"
                                    fontColor="textSecondary"
                                    style={styles.discoverySourceName}>
                                    {item.pluginName}
                                </ThemeText>
                            </View>
                            <ThemeText
                                numberOfLines={1}
                                fontSize="subTitle"
                                fontWeight="bold"
                                style={styles.discoveryPreviewTitle}>
                                {item.title}
                            </ThemeText>
                            <ThemeText
                                numberOfLines={1}
                                fontSize="tag"
                                fontColor="textSecondary">
                                {item.desc}
                            </ThemeText>
                        </Pressable>
                    ))}
                    {preview.loading && !previewItems.length ? (
                        <View
                            style={[
                                styles.discoveryPreviewCard,
                                styles.discoveryLoadingCard,
                                { backgroundColor: colors.card },
                            ]}>
                            <ThemeText fontSize="description">
                                {t("common.loading")}
                            </ThemeText>
                        </View>
                    ) : null}
                </ScrollView>
            ) : null}
            {!previewItems.length && !preview.loading && topListPlugins.length ? (
                <Pressable
                    style={[
                        styles.discoveryFallback,
                        {
                            backgroundColor: colors.card,
                            borderColor: Color(colors.text)
                                .alpha(0.06)
                                .toString(),
                        },
                    ]}
                    onPress={() =>
                        navigate(ROUTE_PATH.TOP_LIST, {
                            initialPluginHash: topListPlugins[0]?.hash,
                        })
                    }>
                    <View
                        style={[
                            styles.discoveryIcon,
                            {
                                backgroundColor: Color(colors.primary)
                                    .alpha(0.13)
                                    .toString(),
                            },
                        ]}>
                        <Icon
                            name="trophy"
                            size={rpx(34)}
                            color={colors.primary}
                        />
                    </View>
                    <View style={styles.discoveryText}>
                        <ThemeText
                            numberOfLines={1}
                            fontSize="subTitle"
                            fontWeight="bold">
                            {fallbackPluginName}
                        </ThemeText>
                        <ThemeText
                            numberOfLines={1}
                            fontSize="tag"
                            fontColor="textSecondary"
                            style={styles.smallTextMargin}>
                            {fallbackDescription}
                        </ThemeText>
                    </View>
                    <ForwardIcon
                        size={rpx(30)}
                        color={colors.textSecondary ?? colors.text}
                    />
                </Pressable>
            ) : null}
        </Section>
    );
}

function QuickPill(props: {
    icon: IIconName;
    title: string;
    onPress: () => void;
}) {
    const { icon, title, onPress } = props;
    const colors = useColors();

    return (
        <Pressable
            style={[
                styles.quickPill,
                { backgroundColor: Color(colors.text).alpha(0.07).toString() },
            ]}
            onPress={onPress}>
            <Icon name={icon} size={rpx(30)} color={colors.text} />
            <ThemeText
                numberOfLines={1}
                fontSize="description"
                fontWeight="semibold"
                style={styles.quickPillText}>
                {title}
            </ThemeText>
        </Pressable>
    );
}

function Section(props: {
    title: string;
    subtitle?: string;
    right?: ReactNode;
    compact?: boolean;
    children: ReactNode;
}) {
    const { title, subtitle, right, compact, children } = props;

    return (
        <View style={[styles.section, compact ? styles.compactSection : null]}>
            <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleBlock}>
                    <ThemeText fontSize="title" fontWeight="bold">
                        {title}
                    </ThemeText>
                    {subtitle ? (
                        <ThemeText
                            numberOfLines={1}
                            fontSize="description"
                            fontColor="textSecondary"
                            style={styles.sectionSubtitle}>
                            {subtitle}
                        </ThemeText>
                    ) : null}
                </View>
                {right}
            </View>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    forwardIcon: {
        transform: [{ rotate: "180deg" }],
    },
    wrapper: {
        width: "100%",
        flex: 1,
    },
    contentContainer: {
        paddingTop: rpx(2),
        paddingBottom: rpx(36),
    },
    section: {
        marginTop: rpx(20),
    },
    compactSection: {
        marginTop: rpx(14),
    },
    sectionHeader: {
        minHeight: rpx(52),
        paddingHorizontal: rpx(24),
        marginBottom: rpx(14),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    sectionTitleBlock: {
        flex: 1,
        paddingRight: rpx(12),
    },
    sectionSubtitle: {
        marginTop: rpx(8),
    },
    sectionTextButton: {
        minHeight: rpx(48),
        flexDirection: "row",
        alignItems: "center",
    },
    recommendCard: {
        minHeight: rpx(116),
        marginHorizontal: rpx(24),
        paddingHorizontal: rpx(18),
        borderRadius: rpx(22),
        flexDirection: "row",
        alignItems: "center",
    },
    recommendIcon: {
        width: rpx(64),
        height: rpx(64),
        borderRadius: rpx(20),
        alignItems: "center",
        justifyContent: "center",
    },
    recommendText: {
        flex: 1,
        minWidth: 0,
        marginHorizontal: rpx(16),
    },
    continueCard: {
        marginHorizontal: rpx(24),
        minHeight: rpx(176),
        borderRadius: rpx(24),
        borderWidth: 0,
        padding: rpx(20),
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#2D4A78",
        shadowOffset: { width: 0, height: rpx(8) },
        shadowOpacity: 0.1,
        shadowRadius: rpx(18),
        elevation: 4,
    },
    continueCover: {
        width: rpx(132),
        height: rpx(132),
        borderRadius: rpx(20),
    },
    continueContent: {
        flex: 1,
        minWidth: 0,
        marginLeft: rpx(18),
    },
    continueTopLine: {
        flexDirection: "row",
        alignItems: "center",
    },
    continueTitle: {
        flex: 1,
        minWidth: 0,
    },
    platformBadge: {
        minHeight: rpx(34),
        paddingHorizontal: rpx(12),
        borderRadius: rpx(17),
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: rpx(10),
    },
    continueDesc: {
        marginTop: rpx(10),
    },
    progressRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: rpx(20),
    },
    progressTrack: {
        flex: 1,
        height: rpx(6),
        borderRadius: rpx(3),
        marginHorizontal: rpx(12),
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        borderRadius: rpx(3),
    },
    playButton: {
        width: rpx(70),
        height: rpx(70),
        borderRadius: rpx(35),
        marginLeft: rpx(14),
        alignItems: "center",
        justifyContent: "center",
    },
    emptyStart: {
        marginHorizontal: rpx(24),
        minHeight: rpx(108),
        borderRadius: rpx(18),
        padding: rpx(14),
        flexDirection: "row",
        alignItems: "center",
    },
    emptyStartText: {
        flex: 1,
        minWidth: 0,
        marginHorizontal: rpx(10),
    },
    quickPill: {
        flex: 1,
        minWidth: 0,
        height: rpx(76),
        borderRadius: rpx(16),
        marginHorizontal: rpx(4),
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        paddingHorizontal: rpx(10),
    },
    quickPillText: {
        marginLeft: rpx(8),
        flexShrink: 1,
    },
    recentContainer: {
        paddingHorizontal: rpx(24),
    },
    recentItem: {
        width: rpx(260),
        height: rpx(88),
        borderRadius: rpx(16),
        flexDirection: "row",
        alignItems: "center",
        padding: rpx(12),
        marginRight: rpx(14),
    },
    recentCover: {
        width: rpx(64),
        height: rpx(64),
        borderRadius: rpx(12),
    },
    recentText: {
        flex: 1,
        minWidth: 0,
        marginLeft: rpx(12),
    },
    smallTextMargin: {
        marginTop: rpx(8),
    },
    discoveryPreviewContainer: {
        paddingHorizontal: rpx(24),
    },
    discoveryPreviewCard: {
        width: rpx(232),
        minHeight: rpx(318),
        borderRadius: rpx(22),
        padding: rpx(14),
        marginRight: rpx(14),
    },
    discoveryPreviewCover: {
        width: rpx(204),
        height: rpx(204),
        borderRadius: rpx(14),
    },
    discoveryPreviewMeta: {
        marginTop: rpx(14),
        flexDirection: "row",
        alignItems: "center",
    },
    discoverySourceName: {
        flex: 1,
        minWidth: 0,
        marginLeft: rpx(8),
    },
    discoveryPreviewTitle: {
        marginTop: rpx(12),
        marginBottom: rpx(8),
    },
    discoveryLoadingCard: {
        alignItems: "center",
        justifyContent: "center",
    },
    discoveryFallback: {
        marginHorizontal: rpx(24),
        minHeight: rpx(116),
        borderRadius: rpx(18),
        borderWidth: StyleSheet.hairlineWidth,
        padding: rpx(18),
        flexDirection: "row",
        alignItems: "center",
    },
    discoveryIcon: {
        width: rpx(58),
        height: rpx(58),
        borderRadius: rpx(16),
        alignItems: "center",
        justifyContent: "center",
    },
    discoveryText: {
        flex: 1,
        minWidth: 0,
        marginLeft: rpx(14),
    },
});
