import FastImage from "@/components/base/fastImage";
import Icon from "@/components/base/icon";
import MarqueeText from "@/components/base/marqueeText";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import { controlSize, radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { usePluginDisplayNameResolver } from "@/core/pluginManager";
import { openPlayer } from "@/core/playerOverlay";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import TrackPlayer, { useCurrentMusic, useMusicState } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import { isSameMediaItem } from "@/utils/mediaUtils";
import { resolveArtwork } from "@/utils/artwork";
import rpx from "@/utils/rpx";
import { musicIsPaused } from "@/utils/trackUtils";
import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import type { HomeFeatureAppearance } from "./homeFeatureAppearance";
import { homeFeatureLayout } from "./homeFeatureLayout";

const minimumTouch = Math.max(44, controlSize.minimumTouch);
/** Resume actual listening content; detailed progress belongs to the existing player. */
export default function HomeHero({ music, joined = false, appearance = "window" }: { music?: IMusic.IMusicItem | null; joined?: boolean; appearance?: HomeFeatureAppearance }) {
    const currentMusic = useCurrentMusic();
    const featuredMusic = music ?? currentMusic;
    const musicState = useMusicState();
    const navigate = useNavigate();
    const { t } = useI18N();
    const colors = useColors();
    const getDisplayName = usePluginDisplayNameResolver();
    const isCurrent = !!featuredMusic && isSameMediaItem(featuredMusic, currentMusic);
    const isPlaying = isCurrent && !musicIsPaused(musicState);
    const record = appearance === "record";
    const layout = homeFeatureLayout[appearance];
    const foreground = record ? colors.onFeaturedRecord : colors.onFeaturedWindow;
    const secondary = record ? colors.onFeaturedRecordSecondary : colors.onFeaturedWindowSecondary;
    const artist = featuredMusic?.artist || featuredMusic?.album || t("common.unknownName");
    const sourceName = featuredMusic ? getDisplayName(featuredMusic.platform) : "";
    const title = featuredMusic?.title || t("home.exploreMusic");
    const cover = (style: object) => featuredMusic ? <FastImage source={resolveArtwork(featuredMusic)} placeholderSource={ImgAsset.albumDefault} style={style} />
        : <View style={[style, styles.emptyCover, { backgroundColor: colors.cardInset }]}><Icon name="musical-note" size={rpx(48)} color={colors.onCardInsetSecondary} /></View>;
    const open = () => {
        if (!featuredMusic) navigate(ROUTE_PATH.LOCAL);
        else if (isCurrent) openPlayer();
        else TrackPlayer.play(featuredMusic);
    };

    return (
        <View testID={`home-hero-${appearance}`} style={[styles.card, joined && styles.joined, { minHeight: layout.minimumHeight, backgroundColor: record ? colors.featuredRecordSurface : colors.featuredWindowSurface }]}>
            {record && <LinearGradient testID="home-record-lighting" pointerEvents="none" colors={colors.featuredRecordGradient} locations={[0, 0.52, 1]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />}
            {record && <View testID="home-record-art-column" pointerEvents="none" style={styles.recordArtColumn}>
                <Image source={ImgAsset.homeRecordHalo} accessible={false} resizeMode="contain" resizeMethod="resize" style={[styles.recordTexture, { opacity: colors.featuredRecordTextureOpacity }]} />
            </View>}
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={featuredMusic ? `${t("home.continueListening")} · ${featuredMusic.title}` : t("home.localMusic")}
                style={styles.main}
                onPress={open}>
                {record ? <>
                    <View style={[styles.recordHeading, { minHeight: layout.artworkHeight }]}>
                        <ThemeText numberOfLines={1} fontSize="tag" color={secondary} style={styles.recordLabel}>{sourceName || t("home.localMusic")}</ThemeText>
                        <ThemeText numberOfLines={1} fontSize="section" fontWeight="semibold" color={foreground} style={styles.recordTitle}>{t("home.continueListening")}</ThemeText>
                    </View>
                    <View style={[styles.footer, styles.recordFooter, { minHeight: layout.footerHeight }]}>
                        {cover(styles.recordCover)}
                        <View style={styles.recordMetadata}>
                            <MarqueeText text={title} fontSize="tag" fontWeight="semibold" color={foreground} />
                            <ThemeText numberOfLines={1} fontSize="tag" color={secondary} style={styles.description}>{featuredMusic ? artist : t("home.scanLocal")}</ThemeText>
                        </View>
                    </View>
                </> : <>
                    <View style={[styles.artworkStage, { height: layout.artworkHeight }]}>
                        {cover(styles.windowCover)}
                        <View style={[styles.photoLabel, { backgroundColor: colors.featuredRecordSurface }]}>
                            <ThemeText numberOfLines={1} fontSize="tag" color={colors.onFeaturedRecord}>{t("home.continueListening")}</ThemeText>
                        </View>
                    </View>
                    <View style={[styles.footer, styles.copy, { minHeight: layout.footerHeight }]}>
                        <MarqueeText text={title} fontSize="title" fontWeight="semibold" color={foreground} />
                        <ThemeText numberOfLines={1} fontSize="tag" color={secondary} style={styles.description}>{featuredMusic ? [artist, sourceName].filter(Boolean).join(" · ") : t("home.scanLocal")}</ThemeText>
                    </View>
                </>}
            </Pressable>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(isPlaying ? "musicDetail.a11y.pause" : "musicDetail.a11y.play")}
                style={[styles.playAction, { bottom: Math.max(0, (layout.footerHeight - minimumTouch) / 2) }]}
                onPress={() => {
                    if (!featuredMusic) navigate(ROUTE_PATH.LOCAL);
                    else if (isPlaying) TrackPlayer.pause();
                    else TrackPlayer.play(featuredMusic);
                }}>
                <View style={[styles.playFill, { backgroundColor: record ? colors.inverseSurface : colors.featuredActionSurface }]}>
                    <Icon name={isPlaying ? "pause" : "play"} size={rpx(28)} color={record ? colors.onInverse : colors.onFeaturedAction} />
                </View>
            </Pressable>
            {record && <View testID="home-record-rim" pointerEvents="none" style={[styles.recordRim, joined && styles.joined, { borderColor: colors.featuredRecordRim, borderLeftWidth: joined ? 0 : StyleSheet.hairlineWidth }]} />}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { flex: 1, borderRadius: radius.xl, overflow: "hidden" },
    joined: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
    main: { flex: 1, minHeight: minimumTouch },
    artworkStage: { width: "100%", overflow: "hidden" },
    windowCover: { width: "100%", height: "100%" },
    photoLabel: { position: "absolute", top: spacing.sm, left: spacing.lg, borderRadius: radius.xs, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs, maxWidth: "90%" },
    footer: { padding: spacing.lg, paddingRight: minimumTouch + spacing.lg * 2, flex: 1 },
    copy: { minWidth: 0, justifyContent: "center" },
    description: { marginTop: spacing.xs },
    recordHeading: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, overflow: "hidden" },
    recordLabel: { maxWidth: "56%" },
    recordTitle: { marginTop: spacing.xs, maxWidth: "56%" },
    // The bitmap includes the matte backing and its soft halo. Allow the complete
    // visible arc through; the card's outer rounded clip still owns its perimeter.
    recordArtColumn: { position: "absolute", width: "54%", right: 0, top: 0, height: rpx(186), overflow: "hidden" },
    recordTexture: { position: "absolute", width: rpx(488), height: rpx(488), right: -rpx(244), top: -rpx(314) },
    recordRim: { ...StyleSheet.absoluteFill, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth },
    recordFooter: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
    recordCover: { width: rpx(88), height: rpx(88), borderRadius: radius.sm },
    recordMetadata: { flex: 1, minWidth: 0 },
    emptyCover: { alignItems: "center", justifyContent: "center" },
    playAction: { position: "absolute", right: spacing.lg, width: minimumTouch, height: minimumTouch, alignItems: "center", justifyContent: "center" },
    playFill: { width: rpx(72), height: rpx(72), borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
