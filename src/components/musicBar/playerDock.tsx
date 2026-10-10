import Color from "color";
import React, { ReactNode, useCallback, useEffect, useState } from "react";
import { BackHandler, Image, Keyboard, Pressable, StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { measure, runOnUI, useAnimatedRef } from "react-native-reanimated";
import { useTheme } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon, { IIconName } from "@/components/base/icon";
import FastImage from "@/components/base/fastImage";
import ThemeText from "@/components/base/themeText";
import { showPanel } from "@/components/panels/usePanel";
import { ImgAsset } from "@/constants/assetsConst";
import { audioraGradient, elevation, radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import MusicSheet, { useFavorite } from "@/core/musicSheet";
import { openPlayer } from "@/core/playerOverlay";
import { armPlayerTransition, playerTransition } from "@/core/playerTransition";
import TrackPlayer, { useCurrentMusic, useMusicState } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import SeekBar from "@/pages/musicDetail/components/bottom/seekBar";
import { resolveArtwork } from "@/utils/artwork";
import { useMediaExtraProperty } from "@/utils/mediaExtra";
import rpx from "@/utils/rpx";
import { musicIsPaused } from "@/utils/trackUtils";
import MusicInfo from "./musicInfo";
import { compactCoverOverhang, compactPlayerHeight } from "./compactLayout";

const TOUCH_SIZE = 48;
const COVER_SIZE = Math.min(96, Math.max(80, rpx(180)));
const VINYL_SIZE = COVER_SIZE * 0.8;
const VINYL_RIM = COVER_SIZE * 0.15;
const COVER_OVERHANG = Math.min(12, rpx(20));
const PLAYBACK_SIZE = Math.min(44, rpx(76));

interface IPlayerDockProps {
    bottomNavigation: ReactNode;
    collapseKey: string;
    onDockHeightChange?: (height: number) => void;
}

function DockAction(props: {
    icon: IIconName;
    label: string;
    color: string;
    onPress: () => void;
    selected?: boolean;
    collapse?: boolean;
    outlined?: boolean;
}) {
    const icon = (
        <Icon
            name={props.icon}
            color={props.color}
            size={rpx(46)}
            style={props.collapse ? styles.collapseIcon : undefined}
        />
    );
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.label}
            accessibilityState={
                props.selected === undefined ? undefined : { selected: props.selected }
            }
            onPress={props.onPress}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            {props.outlined ? (
                <View style={[styles.playbackOutline, { borderColor: props.color }]}>
                    {icon}
                </View>
            ) : icon}
        </Pressable>
    );
}

/** The compact player and tabs share one surface; the expanded card grows above it. */
export default function PlayerDock(props: IPlayerDockProps) {
    const { bottomNavigation, collapseKey, onDockHeightChange } = props;
    const musicItem = useCurrentMusic();
    const musicState = useMusicState();
    const isFavorite = useFavorite(musicItem);
    const { dark } = useTheme();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { t } = useI18N();
    const [expanded, setExpanded] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [navigationHeight, setNavigationHeight] = useState(() =>
        Math.max(rpx(112), rpx(100) + Math.max(insets.bottom, spacing.xs)),
    );
    useMediaExtraProperty(musicItem, "associatedArtwork");
    const artwork = resolveArtwork(musicItem);
    const musicVisible = !!musicItem && !keyboardVisible;
    const showExpanded = expanded && musicVisible;
    const isPaused = musicIsPaused(musicState);
    const dockBackground = dark
        ? colors.tabBar ?? colors.surface ?? colors.card
        : colors.musicBar ?? colors.card;
    const foreground = dark ? colors.text : colors.musicBarText ?? colors.text;
    const cardBackground = dark ? colors.surfaceElevated ?? colors.card : dockBackground;
    const gradientAccent = dark ? colors.accentCool ?? colors.primary : audioraGradient[0];
    const album = typeof musicItem?.album === "string" ? musicItem.album.trim() : "";
    const artworkRef = useAnimatedRef<Animated.View>();
    const { origin } = playerTransition();
    const measureArtwork = useCallback(() => {
        runOnUI(() => {
            const frame = measure(artworkRef);
            if (frame && frame.width > 0 && frame.height > 0) {
                origin.value = {
                    x: frame.pageX,
                    y: frame.pageY,
                    width: frame.width,
                    height: frame.height,
                };
            }
        })();
    }, [artworkRef, origin]);
    const openExpandedPlayer = () => {
        measureArtwork();
        // Keep the source card mounted for the return morph as well.
        openPlayer(armPlayerTransition);
    };

    useEffect(() => {
        const show = Keyboard.addListener("keyboardDidShow", () => {
            setKeyboardVisible(true);
            setExpanded(false);
        });
        const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    useEffect(() => {
        setExpanded(false);
    }, [collapseKey]);

    useEffect(() => {
        if (!musicItem) {
            setExpanded(false);
        }
    }, [musicItem]);

    useEffect(() => {
        // Expansion floats over the content instead of shrinking its viewport.
        onDockHeightChange?.(navigationHeight + (musicVisible ? compactPlayerHeight : 0));
    }, [navigationHeight, musicVisible, onDockHeightChange]);

    useEffect(() => {
        if (!showExpanded) {
            return;
        }
        const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
            setExpanded(false);
            return true;
        });
        return () => subscription.remove();
    }, [showExpanded]);

    const togglePlayback = () => {
        if (isPaused) {
            TrackPlayer.play();
        } else {
            TrackPlayer.pause();
        }
    };
    const openPlaylist = () => showPanel("PlayList");
    const playbackLabel = isPaused ? t("musicDetail.a11y.play") : t("musicDetail.a11y.pause");
    const toggleFavorite = () => {
        if (!musicItem) {
            return;
        }
        if (isFavorite) {
            MusicSheet.removeMusic(MusicSheet.defaultSheet.id, musicItem);
        } else {
            MusicSheet.addMusic(MusicSheet.defaultSheet.id, musicItem);
        }
    };
    const favoriteLabel = isFavorite ? t("musicDetail.a11y.unfavorite") : t("musicDetail.a11y.favorite");
    const favoriteColor = isFavorite ? colors.danger ?? colors.primary : foreground;

    return (
        <View testID="player-dock" pointerEvents="box-none" style={styles.root}>
            {showExpanded && musicItem ? (
                <View
                    testID="player-dock-expanded-space"
                    pointerEvents="box-none"
                    style={[styles.expandedSpace, { bottom: navigationHeight }]}>
                    <View
                        testID="player-dock-expanded"
                        style={[
                            styles.expandedCard,
                            elevation.low,
                            {
                                marginLeft: spacing.xxxl + insets.left,
                                marginRight: spacing.xxxl + insets.right,
                                backgroundColor: cardBackground,
                                shadowColor: colors.shadow ?? colors.text,
                            },
                        ]}>
                        <LinearGradient
                            pointerEvents="none"
                            colors={[
                                Color(cardBackground).mix(Color(gradientAccent), dark ? 0.08 : 0.12).toString(),
                                Color(cardBackground).mix(Color(gradientAccent), 0.03).toString(),
                                cardBackground,
                            ]}
                            locations={[0, 0.5, 1]}
                            style={styles.cardGradient}
                        />
                        <View style={styles.header}>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t("musicBar.a11y.openDetail")}
                                style={styles.songInfo}
                                onPress={openExpandedPlayer}>
                                <ThemeText numberOfLines={2} fontSize="content" color={foreground}>
                                    {musicItem.title ?? t("common.unknownName")}
                                </ThemeText>
                                {musicItem.artist ? (
                                    <ThemeText
                                        numberOfLines={1}
                                        fontSize="description"
                                        color={Color(foreground).alpha(0.72).toString()}
                                        style={styles.artist}>
                                        {musicItem.artist}
                                    </ThemeText>
                                ) : null}
                                {album ? (
                                    <ThemeText
                                        numberOfLines={1}
                                        fontSize="description"
                                        color={Color(foreground).alpha(0.64).toString()}
                                        style={styles.artist}>
                                        {t("panel.musicItemOptions.album", { album })}
                                    </ThemeText>
                                ) : null}
                            </Pressable>
                            <DockAction
                                icon="chevron-right"
                                label={t("musicBar.a11y.collapse")}
                                color={foreground}
                                collapse
                                onPress={() => setExpanded(false)}
                            />
                        </View>
                        <SeekBar variant="surface" />
                        <View style={styles.transport}>
                            <DockAction
                                icon={isFavorite ? "heart" : "heart-outline"}
                                label={favoriteLabel}
                                color={favoriteColor}
                                selected={isFavorite}
                                onPress={toggleFavorite}
                            />
                            <DockAction
                                icon="skip-left"
                                label={t("musicDetail.a11y.skipToPrevious")}
                                color={foreground}
                                onPress={() => TrackPlayer.skipToPrevious()}
                            />
                            <DockAction
                                icon={isPaused ? "play" : "pause"}
                                label={playbackLabel}
                                color={foreground}
                                outlined
                                onPress={togglePlayback}
                            />
                            <DockAction
                                icon="skip-right"
                                label={t("musicDetail.a11y.skipToNext")}
                                color={foreground}
                                onPress={() => TrackPlayer.skipToNext()}
                            />
                            <DockAction
                                icon="playlist"
                                label={t("musicBar.a11y.playlist")}
                                color={foreground}
                                onPress={openPlaylist}
                            />
                        </View>
                    </View>
                    {/* The parent includes the overhang so Android can hit the entire cover. */}
                    <Pressable
                        testID="player-dock-artwork"
                        accessibilityRole="button"
                        accessibilityLabel={t("musicBar.a11y.openDetail")}
                        onPress={openExpandedPlayer}
                        style={[
                            styles.artworkAssembly,
                            { left: spacing.xxxl + insets.left + spacing.xxl },
                        ]}>
                        <Image
                            testID="player-dock-vinyl"
                            source={ImgAsset.playerVinyl}
                            resizeMode="contain"
                            style={styles.vinyl}
                        />
                        <Animated.View
                            ref={artworkRef}
                            onLayout={measureArtwork}
                            collapsable={false}
                            style={[styles.coverShadow, { shadowColor: colors.shadow ?? colors.text }]}>
                            <FastImage
                                key={artwork ?? "default"}
                                source={artwork}
                                placeholderSource={ImgAsset.albumDefault}
                                style={styles.cover}
                            />
                        </Animated.View>
                    </Pressable>
                </View>
            ) : null}
            <View
                testID="player-dock-surface"
                pointerEvents="box-none"
                style={[
                    styles.surface,
                    !showExpanded && styles.roundedSurface,
                    { backgroundColor: dockBackground },
                ]}>
                {musicVisible && !showExpanded ? (
                    <View pointerEvents="none" style={styles.compactBase} />
                ) : null}
                <View
                    testID="player-dock-navigation"
                    onLayout={event => {
                        const height = event.nativeEvent.layout.height;
                        if (Number.isFinite(height) && height >= 0) {
                            setNavigationHeight(height);
                        }
                    }}>
                    {bottomNavigation}
                </View>
            </View>
            {musicVisible && !showExpanded ? (
                <View
                    testID="player-dock-compact"
                    style={[
                        styles.compactRow,
                        {
                            bottom: navigationHeight,
                            paddingLeft: insets.left,
                            paddingRight: spacing.md + insets.right,
                        },
                    ]}>
                    <MusicInfo
                        musicItem={musicItem}
                        compact
                        onExpand={() => setExpanded(true)}
                        expandAccessibilityLabel={t("musicBar.a11y.expand")}
                        foregroundColor={foreground}
                        accessibilityLabel={t("musicBar.a11y.nowPlaying", {
                            title: musicItem?.title ?? "",
                            artist: musicItem?.artist ?? "",
                        })}
                        accessibilityHint={t("musicBar.a11y.compactHint")}
                    />
                    <View style={styles.compactActions}>
                        <DockAction
                            icon={isFavorite ? "heart" : "heart-outline"}
                            label={favoriteLabel}
                            color={favoriteColor}
                            selected={isFavorite}
                            onPress={toggleFavorite}
                        />
                        <DockAction
                            icon={isPaused ? "play" : "pause"}
                            label={playbackLabel}
                            color={foreground}
                            onPress={togglePlayback}
                        />
                        <DockAction
                            icon="playlist"
                            label={t("musicBar.a11y.playlist")}
                            color={foreground}
                            onPress={openPlaylist}
                        />
                    </View>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        // The overhanging cover must remain inside every Android touch parent.
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    surface: {
        position: "absolute",
        bottom: 0,
        width: "100%",
    },
    roundedSurface: {
        borderTopLeftRadius: radius.sheet,
        borderTopRightRadius: radius.sheet,
    },
    compactRow: {
        position: "absolute",
        left: 0,
        right: 0,
        height: compactPlayerHeight + compactCoverOverhang,
        flexDirection: "row",
        alignItems: "center",
    },
    compactActions: {
        height: compactPlayerHeight,
        marginTop: compactCoverOverhang,
        flexDirection: "row",
        alignItems: "center",
    },
    compactBase: {
        height: compactPlayerHeight,
    },
    action: {
        minWidth: TOUCH_SIZE,
        minHeight: TOUCH_SIZE,
        alignItems: "center",
        justifyContent: "center",
    },
    expandedSpace: {
        position: "absolute",
        left: 0,
        right: 0,
        paddingTop: COVER_OVERHANG,
        paddingBottom: spacing.sm,
    },
    expandedCard: {
        borderRadius: radius.md,
        paddingHorizontal: spacing.xxl,
        paddingBottom: spacing.md,
        overflow: "visible",
    },
    cardGradient: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: radius.md,
    },
    artworkAssembly: {
        position: "absolute",
        top: 0,
        width: COVER_SIZE + VINYL_RIM,
        height: COVER_SIZE,
    },
    vinyl: {
        position: "absolute",
        width: VINYL_SIZE,
        height: VINYL_SIZE,
        top: (COVER_SIZE - VINYL_SIZE) / 2,
        left: COVER_SIZE - VINYL_SIZE + VINYL_RIM,
    },
    coverShadow: {
        width: COVER_SIZE,
        height: COVER_SIZE,
        borderRadius: radius.sm,
        ...elevation.low,
    },
    cover: {
        width: COVER_SIZE,
        height: COVER_SIZE,
        borderRadius: radius.sm,
    },
    header: {
        minHeight: COVER_SIZE - COVER_OVERHANG + spacing.sm,
        paddingLeft: COVER_SIZE + VINYL_RIM + spacing.xxxl,
        flexDirection: "row",
        alignItems: "center",
    },
    songInfo: {
        flex: 1,
        minWidth: 0,
        minHeight: TOUCH_SIZE,
        paddingVertical: spacing.xs,
        justifyContent: "center",
    },
    artist: {
        marginTop: spacing.xs,
    },
    collapseIcon: {
        transform: [{ rotate: "90deg" }],
    },
    transport: {
        minHeight: TOUCH_SIZE,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    playbackOutline: {
        width: PLAYBACK_SIZE,
        height: PLAYBACK_SIZE,
        borderRadius: PLAYBACK_SIZE / 2,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    pressed: {
        opacity: 0.7,
    },
});
