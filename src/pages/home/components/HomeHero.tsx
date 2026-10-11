import RoundActionButton from "@/components/base/roundActionButton";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { openPlayer } from "@/core/playerOverlay";
import TrackPlayer, { useCurrentMusic, useMusicState } from "@/core/trackPlayer";
import { musicIsPaused } from "@/utils/trackUtils";
import rpx, { fontRpx } from "@/utils/rpx";
import React from "react";
import { ImageBackground, Pressable, StyleSheet, View } from "react-native";
import useColors from "@/hooks/useColors";
import Color from "color";
import { useTheme } from "@react-navigation/native";

export default function HomeHero() {
    const currentMusic = useCurrentMusic();
    const musicState = useMusicState();
    const navigate = useNavigate();
    const { t } = useI18N();
    const { dark } = useTheme();
    const colors = useColors();
    const isPlaying = !!currentMusic && !musicIsPaused(musicState);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("home.welcomeTitle")}
            onPress={() =>
                currentMusic ? openPlayer() : navigate(ROUTE_PATH.LOCAL)
            }
            style={styles.card}>
            <ImageBackground
                source={ImgAsset.homeHero}
                resizeMode="stretch"
                style={styles.image}
                imageStyle={styles.imageRadius}>
                <View style={[styles.shade, { backgroundColor: Color(colors.onMediaScrim).alpha(dark ? 0.34 : 0.08).toString() }]} />
                <View style={styles.copy}>
                    <ThemeText
                        fontSize="section"
                        fontWeight="bolder"
                        color={colors.onMedia}
                        style={[styles.title, { textShadowColor: Color(colors.onMediaScrim).alpha(0.28).toString() }]}>
                        {t("home.welcomeTitle")}
                    </ThemeText>
                    <ThemeText
                        fontSize="description"
                        fontWeight="semibold"
                        color={colors.onMediaSecondary}
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
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    copy: {
        width: "62%",
        marginLeft: rpx(38),
    },
    title: {
        fontSize: fontRpx(44),
        lineHeight: fontRpx(54),
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
