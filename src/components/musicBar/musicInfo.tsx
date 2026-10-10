import React, { memo, useCallback, useLayoutEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import FastImage from "../base/fastImage";
import { ImgAsset } from "@/constants/assetsConst";
import Color from "color";
import ThemeText from "../base/themeText";
import useColors from "@/hooks/useColors";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import TrackPlayer from "@/core/trackPlayer";
import Animated, {
    AnimatedRef,
    SharedValue,
    measure,
    runOnJS,
    runOnUI,
    useAnimatedRef,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useMediaExtraProperty } from "@/utils/mediaExtra";
import useMotion from "@/hooks/useMotion";
import { resolveArtwork } from "@/utils/artwork";
import { armPlayerTransition, playerTransition } from "@/core/playerTransition";
import { openPlayer } from "@/core/playerOverlay";
import { elevation, radius, spacing } from "@/constants/designSystem";
import { compactCoverOverhang, compactCoverSize } from "./compactLayout";

interface IBarMusicItemProps {
    musicItem: IMusic.IMusicItem | null;
    activeIndex: number; // 当前展示的是0/1/2
    transformSharedValue: SharedValue<number>;
    /** Only the visible (current) item carries the shared-element frame. */
    artworkRef?: AnimatedRef<Animated.View>;
    onArtworkLayout?: () => void;
    foregroundColor?: string;
    compact?: boolean;
}
function BarMusicItemView(props: IBarMusicItemProps) {
    const {
        musicItem, activeIndex, transformSharedValue,
        artworkRef, onArtworkLayout, foregroundColor, compact,
    } = props;
    const colors = useColors();
    // Subscribe so minibar updates when cover is associated/restored
    useMediaExtraProperty(musicItem, "associatedArtwork");
    const displayArtwork = resolveArtwork(musicItem);

    const animatedStyles = useAnimatedStyle(() => {
        return {
            left: `${(transformSharedValue.value + activeIndex) * 100}%`,
        };
    }, [activeIndex]);

    if (!musicItem) {
        return null;
    }

    return (
        <Animated.View
            style={[
                styles.container,
                // The parent player already applies horizontal safe-area spacing.
                // Do not add safeAreaInsets.left again or text/controls drift apart.
                styles.containerPadding,
                compact && styles.compactContainer,
                animatedStyles,
            ]}>
            <Animated.View
                collapsable={false}
                ref={artworkRef}
                onLayout={onArtworkLayout}
                style={compact ? [styles.compactArtwork, { shadowColor: colors.shadow ?? colors.text }] : undefined}>
                <FastImage
                    key={displayArtwork ?? "default"}
                    style={compact ? styles.compactArtworkImg : styles.artworkImg}
                    source={displayArtwork}
                    placeholderSource={ImgAsset.albumDefault}
                />
            </Animated.View>
            <View accessible={false} style={[styles.textWrapper, compact && styles.compactText]}>
                <ThemeText
                    fontSize={compact ? "content" : "subTitle"}
                    fontWeight={compact ? "regular" : "semibold"}
                    fontColor="musicBarText"
                    color={foregroundColor}
                    numberOfLines={1}>
                    {musicItem?.title}
                </ThemeText>
                {!compact && musicItem?.artist && (
                    <ThemeText
                        fontSize="description"
                        numberOfLines={1}
                        style={styles.artist}
                        color={Color(foregroundColor ?? colors.musicBarText ?? colors.text)
                            .alpha(0.62)
                            .toString()}>
                        {musicItem.artist}
                    </ThemeText>
                )}
            </View>
        </Animated.View>
    );
}

const BarMusicItem = memo(
    BarMusicItemView,
    (prev, curr) =>
        prev.musicItem === curr.musicItem &&
        prev.activeIndex === curr.activeIndex &&
        prev.foregroundColor === curr.foregroundColor &&
        prev.compact === curr.compact,
);

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        width: "100%",
        alignItems: "center",
        position: "absolute",
    },
    containerPadding: {
        paddingLeft: rpx(18),
        paddingRight: rpx(8),
    },
    textWrapper: {
        flex: 1,
        flexShrink: 1,
        justifyContent: "center",
        // Leave room so long titles don't paint under the play controls.
        minWidth: 0,
    },
    artworkImg: {
        width: rpx(80),
        height: rpx(80),
        borderRadius: rpx(20),
        marginRight: rpx(14),
        flexShrink: 0,
    },
    artist: {
        marginTop: rpx(10),
    },
    compactContainer: {
        height: "100%",
        paddingLeft: spacing.xxxl,
        paddingRight: spacing.sm,
    },
    compactArtwork: {
        width: compactCoverSize,
        height: compactCoverSize,
        alignSelf: "flex-start",
        marginRight: rpx(60),
        borderRadius: radius.xs,
        ...elevation.low,
    },
    compactArtworkImg: {
        width: compactCoverSize,
        height: compactCoverSize,
        borderRadius: radius.xs,
    },
    compactText: {
        height: "100%",
        paddingTop: compactCoverOverhang,
    },
});

interface IMusicInfoProps {
    musicItem: IMusic.IMusicItem | null;
    paddingLeft?: number;
    foregroundColor?: string;
    onPress?: () => void;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    compact?: boolean;
    onExpand?: () => void;
    expandAccessibilityLabel?: string;
}

function skipMusicItem(direction: number) {
    if (direction === -1) {
        TrackPlayer.skipToNext();
    } else if (direction === 1) {
        TrackPlayer.skipToPrevious();
    }
}

export default function MusicInfo(props: IMusicInfoProps) {
    const {
        musicItem, foregroundColor, onPress, accessibilityLabel, accessibilityHint,
        compact, onExpand, expandAccessibilityLabel,
    } = props;
    const siblingMusicItems = useMemo(() => {
        if (!musicItem) {
            return {
                prev: null,
                next: null,
            };
        }
        return {
            prev: TrackPlayer.previousMusic,
            next: TrackPlayer.nextMusic,
        };
    }, [musicItem]);

    // +- 1
    const transformSharedValue = useSharedValue(0);

    const musicItemWidthValue = useSharedValue(0);

    // Resolved on the JS side: the pan gesture runs as a worklet, so the
    // timing config has to be captured as a plain object.
    const motion = useMotion();
    const skipTiming = useMemo(
        () => ({
            duration: motion.duration("fast"),
            easing: motion.easing("standard"),
        }),
        [motion],
    );

    // Shared-element source: the mini artwork's frame in window coordinates.
    // Kept fresh on every layout so tapping the bar never has to wait for an
    // async measurement before opening the overlay.
    const artworkRef = useAnimatedRef<Animated.View>();
    // Capture the shared value on JS; the UI runtime cannot call the accessor.
    const { origin } = playerTransition();
    const measureArtwork = useCallback(() => {
        runOnUI(() => {
            const frame = measure(artworkRef);
            if (!frame || frame.width <= 0 || frame.height <= 0) {
                return;
            }
            origin.value = {
                x: frame.pageX,
                y: frame.pageY,
                width: frame.width,
                height: frame.height,
            };
        })();
    }, [artworkRef, origin]);

    const handlePress = () => {
        if (!musicItem) {
            return;
        }
        if (onPress) {
            onPress();
        } else {
            measureArtwork();
            openPlayer(armPlayerTransition);
        }
    };
    const tapGesture = Gesture.Tap()
        .onStart(handlePress)
        .runOnJS(true);
    const handleExpand = () => {
        if (musicItem) {
            onExpand?.();
        }
    };
    const longPressGesture = Gesture.LongPress()
        .minDuration(motion.duration("slow"))
        .onStart(handleExpand)
        .runOnJS(true);
    const canExpand = !!onExpand;

    useLayoutEffect(() => {
        transformSharedValue.value = 0;
    }, [musicItem, transformSharedValue]);

    const panGesture = Gesture.Pan()
        .minPointers(1)
        .maxPointers(1)
        .onUpdate(e => {
            if (musicItemWidthValue.value) {
                transformSharedValue.value =
                    canExpand && Math.abs(e.translationY) > Math.abs(e.translationX)
                        ? 0
                        : e.translationX / musicItemWidthValue.value;
            }
        })
        .onEnd((e, success) => {
            if (!success) {
                // 还原到原始位置
                transformSharedValue.value = withTiming(0, skipTiming);
            } else if (
                canExpand &&
                Math.abs(e.translationY) > Math.abs(e.translationX) * 1.2
            ) {
                transformSharedValue.value = withTiming(0, skipTiming);
                if (e.translationY < -24) {
                    runOnJS(handleExpand)();
                }
            } else {
                // fling
                const deltaX = e.translationX;
                const vX = e.velocityX;

                let skip = 0;
                if (musicItemWidthValue.value) {
                    const rate = deltaX / musicItemWidthValue.value;

                    if (Math.abs(rate) > 0.3) {
                        // 先判断距离
                        skip = vX > 0 ? 1 : -1;
                        transformSharedValue.value = withTiming(
                            skip,
                            skipTiming,
                            () => {
                                "worklet";
                                runOnJS(skipMusicItem)(skip);
                            },
                        );
                    } else if (Math.abs(vX) > 1500) {
                        // 再判断速度
                        skip = vX > 0 ? 1 : -1;
                        transformSharedValue.value = skip;
                        runOnJS(skipMusicItem)(skip);
                    } else {
                        transformSharedValue.value = withTiming(0, skipTiming);
                    }
                } else {
                    transformSharedValue.value = 0;
                }
            }
        });

    const gesture = onExpand
        ? Gesture.Race(panGesture, longPressGesture, tapGesture)
        : Gesture.Race(panGesture, tapGesture);

    return (
        <GestureDetector gesture={gesture}>
            <View
                style={musicInfoStyles.infoContainer}
                accessible={!!musicItem}
                accessibilityRole={musicItem ? "button" : undefined}
                accessibilityLabel={accessibilityLabel}
                accessibilityHint={accessibilityHint}
                accessibilityActions={musicItem ? [
                    { name: "activate" },
                    ...(onExpand ? [{ name: "expand", label: expandAccessibilityLabel }] : []),
                ] : undefined}
                onAccessibilityAction={event => {
                    if (event.nativeEvent.actionName === "activate") {
                        handlePress();
                    } else if (event.nativeEvent.actionName === "expand") {
                        handleExpand();
                    }
                }}
                onLayout={e => {
                    musicItemWidthValue.value = e.nativeEvent.layout.width;
                }}>
                <BarMusicItem
                    transformSharedValue={transformSharedValue}
                    musicItem={siblingMusicItems.prev}
                    activeIndex={-1}
                    foregroundColor={foregroundColor}
                    compact={compact}
                />
                <BarMusicItem
                    transformSharedValue={transformSharedValue}
                    musicItem={musicItem}
                    activeIndex={0}
                    artworkRef={artworkRef}
                    onArtworkLayout={measureArtwork}
                    foregroundColor={foregroundColor}
                    compact={compact}
                />
                <BarMusicItem
                    transformSharedValue={transformSharedValue}
                    musicItem={siblingMusicItems.next}
                    activeIndex={1}
                    foregroundColor={foregroundColor}
                    compact={compact}
                />
            </View>
        </GestureDetector>
    );
}

const musicInfoStyles = StyleSheet.create({
    infoContainer: {
        flex: 1,
        height: "100%",
        alignItems: "center",
        flexDirection: "row",
        overflow: "hidden",
    },
});
