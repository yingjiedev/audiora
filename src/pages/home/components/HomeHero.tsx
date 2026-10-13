import FastImage from "@/components/base/fastImage";
import Icon from "@/components/base/icon";
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
import type { HomeFeatureAppearance } from "./homeFeatureAppearance";

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
        <View testID={`home-hero-${appearance}`} style={[styles.card, joined && styles.joined, { backgroundColor: record ? colors.featuredRecordSurface : colors.featuredWindowSurface }]}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={featuredMusic ? `${t("home.continueListening")} · ${featuredMusic.title}` : t("home.localMusic")}
                style={styles.main}
                onPress={open}>
                {record ? <>
                    <View style={styles.recordHeading}>
                        <Image source={ImgAsset.playerVinyl} accessible={false} resizeMode="contain" resizeMethod="resize" style={[styles.recordTexture, { opacity: colors.featuredRecordTextureOpacity }]} />
                        <ThemeText numberOfLines={1} fontSize="tag" color={secondary}>{t("home.continueListening")}</ThemeText>
                        <ThemeText numberOfLines={2} fontSize="hero" fontWeight="semibold" color={foreground} style={styles.recordTitle}>{title}</ThemeText>
                    </View>
                    <View style={[styles.footer, styles.recordFooter]}>
                        {cover(styles.recordCover)}
                        <View style={styles.recordMetadata}>
                            <ThemeText numberOfLines={2} fontSize="tag" color={foreground}>{featuredMusic ? artist : t("home.scanLocal")}</ThemeText>
                            {!!sourceName && <ThemeText numberOfLines={1} fontSize="tag" color={secondary} style={styles.description}>{sourceName}</ThemeText>}
                        </View>
                    </View>
                </> : <>
                    <View style={styles.artworkStage}>
                        {cover(styles.windowCover)}
                        <View style={[styles.photoLabel, { backgroundColor: colors.featuredRecordSurface }]}>
                            <ThemeText numberOfLines={1} fontSize="tag" color={colors.onFeaturedRecord}>{t("home.continueListening")}</ThemeText>
                        </View>
                    </View>
                    <View style={[styles.footer, styles.copy]}>
                        <ThemeText numberOfLines={2} fontSize="title" fontWeight="semibold" color={foreground}>{title}</ThemeText>
                        <ThemeText numberOfLines={1} fontSize="tag" color={secondary} style={styles.description}>{featuredMusic ? [artist, sourceName].filter(Boolean).join(" · ") : t("home.scanLocal")}</ThemeText>
                    </View>
                </>}
            </Pressable>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(isPlaying ? "musicDetail.a11y.pause" : "musicDetail.a11y.play")}
                style={styles.playAction}
                onPress={() => {
                    if (!featuredMusic) navigate(ROUTE_PATH.LOCAL);
                    else if (isPlaying) TrackPlayer.pause();
                    else TrackPlayer.play(featuredMusic);
                }}>
                <View style={[styles.playFill, { backgroundColor: record ? colors.inverseSurface : colors.featuredActionSurface }]}>
                    <Icon name={isPlaying ? "pause" : "play"} size={rpx(28)} color={record ? colors.onInverse : colors.onFeaturedAction} />
                </View>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { flex: 1, borderRadius: radius.xl, minHeight: rpx(344), overflow: "hidden" },
    joined: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
    main: { flex: 1, minHeight: minimumTouch },
    artworkStage: { height: rpx(192), width: "100%", overflow: "hidden" },
    windowCover: { width: "100%", height: "100%" },
    photoLabel: { position: "absolute", top: spacing.sm, left: spacing.lg, borderRadius: radius.xs, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs, maxWidth: "90%" },
    footer: { minHeight: rpx(152), padding: spacing.lg, paddingRight: minimumTouch + spacing.lg * 2, flex: 1 },
    copy: { minWidth: 0, justifyContent: "center" },
    description: { marginTop: spacing.xs },
    recordHeading: { minHeight: rpx(192), padding: spacing.lg, overflow: "hidden" },
    recordTitle: { marginTop: spacing.lg },
    recordTexture: { position: "absolute", width: rpx(400), height: rpx(400), right: -rpx(200), top: -rpx(200) },
    recordFooter: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    recordCover: { width: rpx(112), height: rpx(112), borderRadius: radius.sm },
    recordMetadata: { flex: 1, minWidth: 0 },
    emptyCover: { alignItems: "center", justifyContent: "center" },
    playAction: { position: "absolute", right: spacing.lg, bottom: Math.max(0, (rpx(152) - minimumTouch) / 2), width: minimumTouch, height: minimumTouch, alignItems: "center", justifyContent: "center" },
    playFill: { width: rpx(72), height: rpx(72), borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
