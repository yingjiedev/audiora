import React, { ReactNode, useEffect, useState } from "react";
import { BackHandler, Image, Keyboard, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon, { IIconName } from "@/components/base/icon";
import FastImage from "@/components/base/fastImage";
import RoundActionButton from "@/components/base/roundActionButton";
import ThemeText from "@/components/base/themeText";
import { showPanel } from "@/components/panels/usePanel";
import { ImgAsset } from "@/constants/assetsConst";
import { elevation, radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import MusicSheet, { useFavorite } from "@/core/musicSheet";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import TrackPlayer, { useCurrentMusic, useMusicState } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import SeekBar from "@/pages/musicDetail/components/bottom/seekBar";
import { resolveArtwork } from "@/utils/artwork";
import { useMediaExtraProperty } from "@/utils/mediaExtra";
import rpx from "@/utils/rpx";
import { musicIsPaused } from "@/utils/trackUtils";
import MusicInfo from "./musicInfo";

const TOUCH_SIZE = 48;
const COVER_SIZE = Math.min(72, Math.max(68, rpx(140)));
const VINYL_SIZE = COVER_SIZE * 0.8;
const VINYL_RIM = COVER_SIZE * 0.15;
const COVER_OVERHANG = Math.min(20, rpx(40));

interface IPlayerDockProps {
    bottomNavigation: ReactNode;
    collapseKey: string;
}

function DockAction(props: {
    icon: IIconName;
    label: string;
    color: string;
    onPress: () => void;
    selected?: boolean;
    collapse?: boolean;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.label}
            accessibilityState={
                props.selected === undefined ? undefined : { selected: props.selected }
            }
            onPress={props.onPress}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <Icon
                name={props.icon}
                color={props.color}
                size={rpx(46)}
                style={props.collapse ? styles.collapseIcon : undefined}
            />
        </Pressable>
    );
}

/** The compact player and tabs share one surface; the expanded card grows above it. */
export default function PlayerDock(props: IPlayerDockProps) {
    const { bottomNavigation, collapseKey } = props;
    const musicItem = useCurrentMusic();
    const musicState = useMusicState();
    const isFavorite = useFavorite(musicItem);
    const { dark } = useTheme();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const navigate = useNavigate();
    const { t } = useI18N();
    const [expanded, setExpanded] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    useMediaExtraProperty(musicItem, "associatedArtwork");
    const artwork = resolveArtwork(musicItem);
    const musicVisible = !!musicItem && !keyboardVisible;
    const showExpanded = expanded && musicVisible;
    const isPaused = musicIsPaused(musicState);
    const dockBackground = dark
        ? colors.tabBar ?? colors.surface ?? colors.card
        : colors.musicBar ?? colors.card;
    const foreground = dark ? colors.text : colors.musicBarText ?? colors.text;

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

    return (
        <View testID="player-dock" style={styles.root}>
            {showExpanded && musicItem ? (
                <View style={styles.expandedSpace}>
                    <View
                        testID="player-dock-expanded"
                        style={[
                            styles.expandedCard,
                            elevation.mid,
                            {
                                marginLeft: spacing.lg + insets.left,
                                marginRight: spacing.lg + insets.right,
                                backgroundColor: colors.surfaceElevated ?? colors.card,
                                shadowColor: colors.shadow ?? colors.text,
                            },
                        ]}>
                        {/* Only the sleeve has rounded corners; the record stays behind and can overflow. */}
                        <View pointerEvents="none" style={styles.artworkAssembly}>
                            <Image
                                testID="player-dock-vinyl"
                                source={ImgAsset.playerVinyl}
                                resizeMode="contain"
                                style={styles.vinyl}
                            />
                            <View style={[styles.coverShadow, { shadowColor: colors.shadow ?? colors.text }]}>
                                <FastImage
                                    key={artwork ?? "default"}
                                    source={artwork}
                                    placeholderSource={ImgAsset.albumDefault}
                                    style={styles.cover}
                                />
                            </View>
                        </View>
                        <View style={styles.header}>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t("musicBar.a11y.openDetail")}
                                style={styles.songInfo}
                                onPress={() => {
                                    setExpanded(false);
                                    navigate(ROUTE_PATH.MUSIC_DETAIL);
                                }}>
                                <ThemeText numberOfLines={2} fontSize="content" fontWeight="semibold">
                                    {musicItem.title ?? t("common.unknownName")}
                                </ThemeText>
                                {musicItem.artist ? (
                                    <ThemeText
                                        numberOfLines={1}
                                        fontSize="description"
                                        fontColor="textSecondary"
                                        style={styles.artist}>
                                        {musicItem.artist}
                                    </ThemeText>
                                ) : null}
                            </Pressable>
                            <DockAction
                                icon="chevron-right"
                                label={t("musicBar.a11y.collapse")}
                                color={colors.text}
                                collapse
                                onPress={() => setExpanded(false)}
                            />
                        </View>
                        <View style={styles.transport}>
                            <DockAction
                                icon={isFavorite ? "heart" : "heart-outline"}
                                label={isFavorite ? t("musicDetail.a11y.unfavorite") : t("musicDetail.a11y.favorite")}
                                color={isFavorite ? colors.danger ?? colors.primary : colors.text}
                                selected={isFavorite}
                                onPress={() => {
                                    if (isFavorite) {
                                        MusicSheet.removeMusic(MusicSheet.defaultSheet.id, musicItem);
                                    } else {
                                        MusicSheet.addMusic(MusicSheet.defaultSheet.id, musicItem);
                                    }
                                }}
                            />
                            <DockAction
                                icon="skip-left"
                                label={t("musicDetail.a11y.skipToPrevious")}
                                color={colors.text}
                                onPress={() => TrackPlayer.skipToPrevious()}
                            />
                            <RoundActionButton
                                variant="solid"
                                iconName={isPaused ? "play" : "pause"}
                                size={Math.max(52, rpx(100))}
                                iconSize={rpx(48)}
                                accessibilityLabel={playbackLabel}
                                onPress={togglePlayback}
                            />
                            <DockAction
                                icon="skip-right"
                                label={t("musicDetail.a11y.skipToNext")}
                                color={colors.text}
                                onPress={() => TrackPlayer.skipToNext()}
                            />
                            <DockAction
                                icon="playlist"
                                label={t("musicBar.a11y.playlist")}
                                color={colors.text}
                                onPress={openPlaylist}
                            />
                        </View>
                        <SeekBar variant="surface" />
                    </View>
                </View>
            ) : null}
            <View
                testID="player-dock-surface"
                style={[
                    styles.surface,
                    !showExpanded && styles.roundedSurface,
                    { backgroundColor: dockBackground },
                ]}>
                {musicVisible && !showExpanded ? (
                    <View
                        testID="player-dock-compact"
                        style={[
                            styles.compactRow,
                            { paddingLeft: insets.left, paddingRight: spacing.md + insets.right },
                        ]}>
                        <MusicInfo
                            musicItem={musicItem}
                            foregroundColor={foreground}
                            onPress={() => setExpanded(true)}
                            accessibilityLabel={t("musicBar.a11y.nowPlaying", {
                                title: musicItem?.title ?? "",
                                artist: musicItem?.artist ?? "",
                            })}
                            accessibilityHint={t("musicBar.a11y.expand")}
                        />
                        <View style={styles.action}>
                            <RoundActionButton
                                variant="solid"
                                iconName={isPaused ? "play" : "pause"}
                                size={rpx(72)}
                                iconSize={rpx(40)}
                                hitSlop={Math.max(0, (TOUCH_SIZE - rpx(72)) / 2)}
                                accessibilityLabel={playbackLabel}
                                onPress={togglePlayback}
                            />
                        </View>
                        <DockAction
                            icon="playlist"
                            label={t("musicBar.a11y.playlist")}
                            color={foreground}
                            onPress={openPlaylist}
                        />
                    </View>
                ) : null}
                {bottomNavigation}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        width: "100%",
    },
    surface: {
        width: "100%",
    },
    roundedSurface: {
        borderTopLeftRadius: radius.sheet,
        borderTopRightRadius: radius.sheet,
    },
    compactRow: {
        height: Math.max(64, rpx(128)),
        flexDirection: "row",
        alignItems: "center",
    },
    action: {
        minWidth: TOUCH_SIZE,
        minHeight: TOUCH_SIZE,
        alignItems: "center",
        justifyContent: "center",
    },
    expandedSpace: {
        paddingTop: COVER_OVERHANG,
        paddingBottom: spacing.lg,
    },
    expandedCard: {
        borderRadius: radius.sheet,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        overflow: "visible",
    },
    artworkAssembly: {
        position: "absolute",
        top: -COVER_OVERHANG,
        left: spacing.md,
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
        minHeight: COVER_SIZE - COVER_OVERHANG + spacing.md,
        paddingLeft: COVER_SIZE + VINYL_RIM + spacing.md,
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
        minHeight: 56,
        marginVertical: spacing.xs,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    pressed: {
        opacity: 0.7,
    },
});
