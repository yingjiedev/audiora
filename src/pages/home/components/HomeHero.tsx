import FastImage from "@/components/base/fastImage";
import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import { controlSize, radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { usePluginDisplayNameResolver } from "@/core/pluginManager";
import { openPlayer } from "@/core/playerOverlay";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import TrackPlayer, { useCurrentMusic, useMusicState, useProgress } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import { isSameMediaItem } from "@/utils/mediaUtils";
import rpx from "@/utils/rpx";
import { musicIsPaused } from "@/utils/trackUtils";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

const minimumTouch = Math.max(44, controlSize.minimumTouch);
const timeLabel = (value = 0) => {
    const seconds = Math.max(0, Math.floor(value));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/** The leading Home card shows actual listening content; progress only updates this card. */
export default function HomeHero({ music }: { music?: IMusic.IMusicItem | null }) {
    const currentMusic = useCurrentMusic();
    const featuredMusic = music ?? currentMusic;
    const musicState = useMusicState();
    const { position, duration } = useProgress();
    const navigate = useNavigate();
    const { t } = useI18N();
    const colors = useColors();
    const getDisplayName = usePluginDisplayNameResolver();
    const isCurrent = !!featuredMusic && isSameMediaItem(featuredMusic, currentMusic);
    const isPlaying = isCurrent && !musicIsPaused(musicState);
    const total = isCurrent ? duration || featuredMusic?.duration || 0 : featuredMusic?.duration || 0;
    const elapsed = isCurrent ? Math.min(total, Math.max(0, position)) : 0;
    const progress = total > 0 ? Math.min(1, elapsed / total) : 0;
    const open = () => {
        if (!featuredMusic) navigate(ROUTE_PATH.LOCAL);
        else if (isCurrent) openPlayer();
        else TrackPlayer.play(featuredMusic);
    };

    return (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={featuredMusic ? `${t("home.continueListening")} · ${featuredMusic.title}` : t("home.localMusic")}
                style={styles.main}
                onPress={open}>
                <View style={styles.copy}>
                    <ThemeText fontSize="description" fontColor="textSecondary">
                        {t("home.continueListening")}
                    </ThemeText>
                    <ThemeText numberOfLines={2} fontSize="title" fontWeight="semibold" style={styles.title}>
                        {featuredMusic?.title || t("home.exploreMusic")}
                    </ThemeText>
                    <ThemeText numberOfLines={1} fontSize="description" fontColor="textSecondary" style={styles.description}>
                        {featuredMusic ? featuredMusic.artist || featuredMusic.album || t("common.unknownName") : t("home.localMusic")}
                    </ThemeText>
                </View>
                {featuredMusic ? (
                    <FastImage source={featuredMusic.artwork} placeholderSource={ImgAsset.albumDefault} style={styles.cover} />
                ) : (
                    <View style={[styles.cover, styles.emptyCover, { backgroundColor: colors.surface }]}>
                        <Icon name="musical-note" size={rpx(56)} color={colors.textSecondary} />
                    </View>
                )}
            </Pressable>
            <View style={styles.footer}>
                <View style={styles.footerCopy}>
                    <ThemeText numberOfLines={1} fontSize="tag" fontColor="textSecondary">
                        {featuredMusic ? getDisplayName(featuredMusic.platform) : t("home.scanLocal")}
                    </ThemeText>
                    {featuredMusic ? (
                        <View style={styles.progressRow}>
                            <View style={[styles.progressTrack, { backgroundColor: colors.surface }]}>
                                <View style={[styles.progressFill, { backgroundColor: colors.active, width: `${progress * 100}%` }]} />
                            </View>
                            <ThemeText fontSize="caption" fontColor="textSecondary">{timeLabel(elapsed)} / {timeLabel(total)}</ThemeText>
                        </View>
                    ) : null}
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
                    <View style={[styles.playFill, { backgroundColor: colors.surface }]}>
                        <Icon name={isPlaying ? "pause" : "play"} size={rpx(26)} color={colors.text} />
                    </View>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { flex: 1, borderRadius: radius.xl, padding: spacing.lg },
    main: { flex: 1, minHeight: minimumTouch, flexDirection: "row", alignItems: "center", gap: spacing.md },
    copy: { flex: 1, minWidth: 0 },
    title: { marginTop: spacing.sm },
    description: { marginTop: spacing.xs },
    cover: { width: rpx(132), height: rpx(132), borderRadius: radius.md },
    emptyCover: { alignItems: "center", justifyContent: "center" },
    footer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
    footerCopy: { flex: 1, minWidth: 0 },
    playAction: { width: minimumTouch, height: minimumTouch, alignItems: "center", justifyContent: "center" },
    playFill: { width: rpx(56), height: rpx(56), borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
    progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
    progressTrack: { flex: 1, height: rpx(4), borderRadius: radius.pill, overflow: "hidden" },
    progressFill: { height: "100%" },
});
