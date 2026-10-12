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
import rpx from "@/utils/rpx";
import { musicIsPaused } from "@/utils/trackUtils";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

const minimumTouch = Math.max(44, controlSize.minimumTouch);
/** Resume actual listening content; detailed progress belongs to the existing player. */
export default function HomeHero({ music }: { music?: IMusic.IMusicItem | null }) {
    const currentMusic = useCurrentMusic();
    const featuredMusic = music ?? currentMusic;
    const musicState = useMusicState();
    const navigate = useNavigate();
    const { t } = useI18N();
    const colors = useColors();
    const getDisplayName = usePluginDisplayNameResolver();
    const isCurrent = !!featuredMusic && isSameMediaItem(featuredMusic, currentMusic);
    const isPlaying = isCurrent && !musicIsPaused(musicState);
    const open = () => {
        if (!featuredMusic) navigate(ROUTE_PATH.LOCAL);
        else if (isCurrent) openPlayer();
        else TrackPlayer.play(featuredMusic);
    };

    return (
        <View style={[styles.card, { backgroundColor: colors.cardInset }]}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={featuredMusic ? `${t("home.continueListening")} · ${featuredMusic.title}` : t("home.localMusic")}
                style={styles.main}
                onPress={open}>
                <View style={styles.copy}>
                    <ThemeText fontSize="description" color={colors.onCardInsetSecondary}>
                        {t("home.continueListening")}
                    </ThemeText>
                    <ThemeText numberOfLines={2} fontSize="title" fontWeight="semibold" color={colors.onCardInset} style={styles.title}>
                        {featuredMusic?.title || t("home.exploreMusic")}
                    </ThemeText>
                    <ThemeText numberOfLines={1} fontSize="description" color={colors.onCardInsetSecondary} style={styles.description}>
                        {featuredMusic ? featuredMusic.artist || featuredMusic.album || t("common.unknownName") : t("home.localMusic")}
                    </ThemeText>
                </View>
                {featuredMusic ? (
                    <FastImage source={featuredMusic.artwork} placeholderSource={ImgAsset.albumDefault} style={styles.cover} />
                ) : (
                    <View style={[styles.cover, styles.emptyCover, { backgroundColor: colors.cardInset }]}>
                        <Icon name="musical-note" size={rpx(56)} color={colors.onCardInsetSecondary} />
                    </View>
                )}
            </Pressable>
            <View style={styles.footer}>
                <View style={styles.footerCopy}>
                    <ThemeText numberOfLines={1} fontSize="tag" color={colors.onCardInsetSecondary}>
                        {featuredMusic ? getDisplayName(featuredMusic.platform) : t("home.scanLocal")}
                    </ThemeText>
                </View>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(isPlaying ? "musicDetail.a11y.pause" : "musicDetail.a11y.play")}
                    style={styles.playAction}
                    onPress={() => {
                        if (!featuredMusic) navigate(ROUTE_PATH.LOCAL);
                        else if (isPlaying) TrackPlayer.pause();
                        else TrackPlayer.play(featuredMusic);
                    }}>
                    <View style={[styles.playFill, { backgroundColor: colors.inverseSurface }]}>
                        <Icon name={isPlaying ? "pause" : "play"} size={rpx(28)} color={colors.onInverse} />
                    </View>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { flex: 1, borderRadius: radius.lg, padding: spacing.lg, justifyContent: "space-between" },
    main: { minHeight: minimumTouch, flexDirection: "row", alignItems: "center", gap: spacing.md },
    copy: { flex: 1, minWidth: 0 },
    title: { marginTop: spacing.sm },
    description: { marginTop: spacing.xs },
    cover: { width: rpx(164), height: rpx(164), borderRadius: radius.sm },
    emptyCover: { alignItems: "center", justifyContent: "center" },
    footer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
    footerCopy: { flex: 1, minWidth: 0 },
    playAction: { width: minimumTouch, height: minimumTouch, alignItems: "center", justifyContent: "center" },
    playFill: { width: rpx(60), height: rpx(60), borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
