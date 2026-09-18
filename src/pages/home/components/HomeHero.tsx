import RoundActionButton from "@/components/base/roundActionButton";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import TrackPlayer, { useCurrentMusic, useMusicState } from "@/core/trackPlayer";
import { musicIsPaused } from "@/utils/trackUtils";
import rpx, { fontRpx } from "@/utils/rpx";
import React from "react";
import { ImageBackground, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@react-navigation/native";

export default function HomeHero() {
    const currentMusic = useCurrentMusic();
    const musicState = useMusicState();
    const navigate = useNavigate();
    const { t } = useI18N();
    const { dark } = useTheme();
    const isPlaying = !!currentMusic && !musicIsPaused(musicState);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("home.welcomeTitle")}
            onPress={() =>
                navigate(currentMusic ? ROUTE_PATH.MUSIC_DETAIL : ROUTE_PATH.LOCAL)
            }
            style={styles.card}>
            <ImageBackground
                source={ImgAsset.homeHero}
                resizeMode="stretch"
                style={styles.image}
                imageStyle={styles.imageRadius}>
                <View style={[styles.shade, dark ? styles.shadeDark : null]} />
                <View style={styles.copy}>
                    <ThemeText
                        fontSize="section"
                        fontWeight="bolder"
                        color="#FFFFFF"
                        style={styles.title}>
                        {t("home.welcomeTitle")}
                    </ThemeText>
                    <ThemeText
                        fontSize="description"
                        fontWeight="semibold"
                        color="rgba(255,255,255,0.9)"
                        style={styles.subtitle}>
                        {t("home.welcomeSubtitle")}
                    </ThemeText>
                </View>
                <RoundActionButton
                    variant="inverse"
                    style={styles.playButton}
                    size={rpx(72)}
                    iconName={isPlaying ? "pause" : "play"}
                    onPress={event => {
                        event.stopPropagation();
                        if (!currentMusic) {
                            navigate(ROUTE_PATH.LOCAL);
                        } else if (isPlaying) {
                            TrackPlayer.pause();
                        } else {
                            TrackPlayer.play(currentMusic);
                        }
                    }}
                />
            </ImageBackground>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        alignSelf: "stretch",
        height: rpx(268),
        marginHorizontal: rpx(24),
        marginTop: rpx(12),
        borderRadius: rpx(28),
        overflow: "hidden",
    },
    image: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
    },
    imageRadius: {
        borderRadius: rpx(28),
    },
    shade: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(10,34,91,0.08)",
    },
    // 深色模式下 hero 图过亮会跟整页脱节，压一层深色蒙版
    shadeDark: {
        backgroundColor: "rgba(4,10,28,0.34)",
    },
    copy: {
        width: "62%",
        marginLeft: rpx(38),
    },
    title: {
        fontSize: fontRpx(44),
        lineHeight: fontRpx(54),
        textShadowColor: "rgba(10,28,72,0.28)",
        textShadowOffset: { width: 0, height: rpx(2) },
        textShadowRadius: rpx(8),
    },
    subtitle: {
        marginTop: rpx(16),
    },
    playButton: {
        position: "absolute",
        right: rpx(32),
        bottom: rpx(30),
    },
});
