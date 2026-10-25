import useColors from "@/hooks/useColors";
import StatusBar from "@/components/base/statusBar";
import globalStyle from "@/constants/globalStyle";
import useOrientation from "@/hooks/useOrientation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
    cancelAnimation,
    runOnJS,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Background from "./components/background";
import Bottom from "./components/bottom";
import Content, { MusicDetailContentTab } from "./components/content";
import Lyric from "./components/content/lyric";
import NavBar from "./components/navBar";
import usePlayerVisibility, { PLAYER_INPUT_THRESHOLD } from "./usePlayerVisibility";
import Config, { useAppConfig } from "@/core/appConfig";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import useMotion from "@/hooks/useMotion";
import {
    cancelPlayerTransitionCollapse,
    collapsePlayerTransition,
    expandPlayerTransition,
    playerTransition,
    resetPlayerTransition,
} from "@/core/playerTransition";
import {
    dismissDecision,
    clamp,
    playerDismissProgress,
    playerDismissTransform,
} from "@/utils/motionMath";
import { adaptiveLayout } from "@/utils/adaptiveLayout";
import { PlayerOrientationContext } from "@/hooks/usePlayerOrientation";
import { ContentDimensionsContext } from "@/hooks/useContentDimensions";
import PlaybackPane from "@/components/appShell/playbackPane";

/** Never let a stuck animation trap the user on this screen. */
const CLOSE_WATCHDOG_MS = 900;

interface IMusicDetailProps {
    /**
     * Overlay 关闭回调。播放器是根层 Overlay（见 components/playerOverlay），
     * 不在导航栈里，退场由这里的动画时序驱动而不是导航转场。
     */
    onClose: () => void;
}

export default function MusicDetail(props: IMusicDetailProps) {
    const colors = useColors();
    const { onClose } = props;
    const orientation = useOrientation();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const splitPlayer = adaptiveLayout(windowWidth, windowHeight).splitPlayer;
    const [isExiting, setIsExiting] = useState(false);
    const [tab, selectTab] = useState<MusicDetailContentTab>(
        Config.getConfig("basic.musicDetailDefault") || "album",
    );
    const isHorizontal = orientation === "horizontal" || splitPlayer;
    const showAlbumCover = tab === "album" || isHorizontal;
    const coverStyle = useAppConfig("theme.coverStyle") ?? "square";
    const musicDetailCoverStyle =
        useAppConfig("theme.musicDetailCoverStyle") ?? "immersive";
    const immersiveCoverEnabled =
        !isHorizontal &&
        windowWidth < 600 &&
        coverStyle === "square" &&
        musicDetailCoverStyle === "immersive";
    const useImmersiveCover = showAlbumCover && immersiveCoverEnabled;

    const { progress, dismissProgress } = playerTransition();
    const motion = useMotion();
    const isClosing = useSharedValue(false);
    const isDragging = useSharedValue(false);
    const closingRef = useRef(false);
    const removalRef = useRef<(() => void) | null>(null);
    const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const visibilityProgress = useDerivedValue(() =>
        clamp(progress.value, 0, 1) * (1 - clamp(dismissProgress.value, 0, 1)),
    );
    const acceptsInput = usePlayerVisibility(
        visibilityProgress, isDragging, isClosing, isExiting, onClose,
    );

    useEffect(() => {
        const needAwake = Config.getConfig("basic.musicDetailAwake");
        if (needAwake) {
            activateKeepAwakeAsync();
        }
        return () => {
            if (needAwake) {
                deactivateKeepAwake();
            }
        };
    }, []);

    // Every opening source arms the whole page below the screen before mount.
    useEffect(() => {
        // JS can still read 1 while the queued UI preparation will set 0.
        // Always queue entry after preparation; read/write on UI only.
        expandPlayerTransition({ reduceMotion: motion.reduceMotion });
        return () => {
            cancelAnimation(progress);
            resetPlayerTransition();
        };
        // Runs once: the arm happens before this screen mounts.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        return () => {
            closingRef.current = true;
            isClosing.value = true;
            isDragging.value = false;
            removalRef.current = null;
            if (watchdogRef.current) {
                clearTimeout(watchdogRef.current);
                watchdogRef.current = null;
            }
        };
    }, [isClosing, isDragging]);

    /**
     * Single exit path for every way of leaving this screen (back button,
     * hardware back, drag). The overlay is only removed after the collapse
     * animation reports it finished, otherwise the removal cuts the
     * transition in half.
     */
    const requestClose = useCallback(
        (remove: () => void) => {
            if (closingRef.current) {
                return;
            }
            closingRef.current = true;
            isClosing.value = true;
            isDragging.value = false;
            setIsExiting(true);
            const runRemoval = () => {
                if (removalRef.current === null) {
                    return;
                }
                removalRef.current = null;
                if (watchdogRef.current) {
                    clearTimeout(watchdogRef.current);
                    watchdogRef.current = null;
                }
                remove();
            };
            removalRef.current = runRemoval;
            watchdogRef.current = setTimeout(runRemoval, CLOSE_WATCHDOG_MS);
            collapsePlayerTransition(runRemoval, {
                reduceMotion: motion.reduceMotion,
            });
        },
        [isClosing, isDragging, motion.reduceMotion],
    );

    // Hardware back: the overlay is not in the navigation stack, so
    // react-navigation cannot manage the back button for us. Panels and
    // dialogs register their own handler after the overlay mounts, so their
    // back handling still wins while one of them is open.
    useEffect(() => {
        const subscription = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                requestClose(onClose);
                return true;
            },
        );
        return () => {
            subscription.remove();
        };
    }, [requestClose, onClose]);

    const onGestureEnd = useCallback(
        (dismiss: boolean, velocityY: number) => {
            // A queued UI-thread release must not restart an exiting player.
            if (closingRef.current) {
                return;
            }
            if (dismiss) {
                requestClose(onClose);
                return;
            }
            // Cancelled: spring back to full screen, keeping the finger's speed.
            cancelPlayerTransitionCollapse({
                reduceMotion: motion.reduceMotion,
                velocity: velocityY / Math.max(1, windowHeight),
            });
        },
        [motion.reduceMotion, onClose, requestClose, windowHeight],
    );

    // Drag-down dismiss. Only on the cover tab: the lyric tab owns vertical
    // scrolling and would otherwise fight the gesture for the same axis.
    const dragEnabled = !isHorizontal && tab === "album" && !closingRef.current;
    const dismissGesture = Gesture.Pan()
        .enabled(dragEnabled)
        .minPointers(1)
        .maxPointers(1)
        .activeOffsetY(12)
        .failOffsetX([-16, 16])
        .onStart(() => {
            if (isClosing.value) {
                return;
            }
            isDragging.value = true;
            cancelAnimation(dismissProgress);
        })
        .onUpdate(e => {
            if (isDragging.value && !isClosing.value) {
                dismissProgress.value = playerDismissProgress(e.translationY, windowHeight);
            }
        })
        .onEnd((e, success) => {
            if (!isDragging.value || isClosing.value) {
                return;
            }
            isDragging.value = false;
            runOnJS(onGestureEnd)(
                success &&
                    dismissDecision(
                        e.translationY,
                        e.velocityY,
                        windowHeight,
                    ) === "dismiss",
                success ? e.velocityY : 0,
            );
        })
        .onFinalize(() => {
            // Failed taps never became active; cancelled active drags must settle.
            if (isDragging.value && !isClosing.value) {
                isDragging.value = false;
                runOnJS(onGestureEnd)(false, 0);
            }
        });

    const transitionStyle = useAnimatedStyle(() => {
        const { opacity, translateY } = playerDismissTransform(
            1 - visibilityProgress.value, windowHeight, motion.reduceMotion,
        );
        return { opacity, transform: [{ translateY }] };
    });

    const contentStyle = useAnimatedStyle(() => ({
        // Alpha alone does not remove native views from hit testing. Keep the
        // input gate on the UI thread so it changes with the same opacity frame.
        pointerEvents: !isClosing.value &&
            (isDragging.value || visibilityProgress.value > PLAYER_INPUT_THRESHOLD)
            ? "auto" as const : "none" as const,
    }));

    return (
        <PlayerOrientationContext.Provider value={isHorizontal ? "horizontal" : "vertical"}>
            <Animated.View
                style={[globalStyle.fwflex1, transitionStyle]}
                pointerEvents="box-none"
                needsOffscreenAlphaCompositing
                renderToHardwareTextureAndroid={isExiting}
                collapsable={false}>
                <View
                    pointerEvents="none"
                    style={style.backgroundLayer}>
                    <Background
                        immersiveCoverEnabled={immersiveCoverEnabled}
                        renderImmersiveCover={useImmersiveCover}
                        showImmersiveCover={useImmersiveCover}
                    />
                </View>
                <GestureDetector gesture={dismissGesture}>
                    <Animated.View
                        style={[globalStyle.fwflex1, contentStyle]}
                        importantForAccessibility={
                            acceptsInput ? "auto" : "no-hide-descendants"
                        }
                        accessibilityElementsHidden={!acceptsInput}
                        collapsable={false}>
                        <SafeAreaView style={globalStyle.fwflex1}>
                            <StatusBar
                                backgroundColor={"transparent"}
                                translucent
                            />
                            <View style={style.bodyWrapper}>
                                <View
                                    style={[
                                        globalStyle.flex1,
                                        isHorizontal ? style.leftPane : null,
                                    ]}>
                                    <ContentDimensionsContext.Provider value={{ width: windowWidth * (isHorizontal ? 0.44 : 1), height: windowHeight }}>
                                        <NavBar onBack={() => requestClose(onClose)} />
                                        <Content
                                            // Always keep cover tree mounted across album/lyric tabs
                                            // so mini lyrics are not torn down (only unmount on page exit).
                                            keepAlbumCoverMounted
                                            tab={tab}
                                            selectTab={selectTab}
                                        />
                                        <Bottom />
                                    </ContentDimensionsContext.Provider>
                                </View>
                                {isHorizontal ? (
                                    <View style={[style.divider, { backgroundColor: colors.onMediaTrack }]} />
                                ) : null}
                                {isHorizontal ? (
                                    <View
                                        style={[
                                            globalStyle.flex1,
                                            style.rightPane,
                                        ]}>
                                        {splitPlayer ? <PlaybackPane active={!isExiting} /> : <Lyric />}
                                    </View>
                                ) : null}
                            </View>
                        </SafeAreaView>
                    </Animated.View>
                </GestureDetector>
            </Animated.View>
        </PlayerOrientationContext.Provider>
    );
}

const style = StyleSheet.create({
    backgroundLayer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    bodyWrapper: {
        width: "100%",
        flex: 1,
        flexDirection: "row",
    },
    leftPane: {
        flex: 0.44,
    },
    rightPane: {
        flex: 0.56,
    },
    divider: {
        width: StyleSheet.hairlineWidth,
    },
});
