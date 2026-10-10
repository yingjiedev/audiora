import StatusBar from "@/components/base/statusBar";
import globalStyle from "@/constants/globalStyle";
import useOrientation from "@/hooks/useOrientation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
    cancelAnimation,
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
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
    dragProgress,
    DRAG_FULL_RATIO,
} from "@/utils/motionMath";

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
    const { onClose } = props;
    const orientation = useOrientation();
    const [isExiting, setIsExiting] = useState(false);
    const [tab, selectTab] = useState<MusicDetailContentTab>(
        Config.getConfig("basic.musicDetailDefault") || "album",
    );
    const isHorizontal = orientation === "horizontal";
    const showAlbumCover = tab === "album" || isHorizontal;
    const coverStyle = useAppConfig("theme.coverStyle") ?? "square";
    const musicDetailCoverStyle =
        useAppConfig("theme.musicDetailCoverStyle") ?? "immersive";
    const immersiveCoverEnabled =
        !isHorizontal &&
        coverStyle === "square" &&
        musicDetailCoverStyle === "immersive";
    const useImmersiveCover = showAlbumCover && immersiveCoverEnabled;
    const renderImmersiveCover = useImmersiveCover && !isExiting;

    const { progress } = playerTransition();
    const motion = useMotion();
    const { height: windowHeight } = useWindowDimensions();
    const isClosing = useSharedValue(false);
    const isDragging = useSharedValue(false);
    const closingRef = useRef(false);
    const removalRef = useRef<(() => void) | null>(null);
    const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const acceptsInput = usePlayerVisibility(
        progress, isDragging, isClosing, isExiting, onClose,
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

    // Enter: the mini player armed progress to 0 before navigating, so the
    // first frame already sits on the mini artwork and springs to full screen.
    useEffect(() => {
        if (progress.value < 1) {
            expandPlayerTransition({ reduceMotion: motion.reduceMotion });
        }
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
                velocity: -velocityY / (windowHeight * DRAG_FULL_RATIO),
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
            cancelAnimation(progress);
        })
        .onUpdate(e => {
            if (isDragging.value && !isClosing.value) {
                progress.value = dragProgress(e.translationY, windowHeight);
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

    const backgroundStyle = useAnimatedStyle(() => ({
        // The blurred artwork is the "room" the player expands into, so it
        // arrives after the artwork has already started travelling.
        opacity: interpolate(
            progress.value,
            [0.05, 0.8],
            [0, 1],
            Extrapolation.CLAMP,
        ),
    }));

    const contentStyle = useAnimatedStyle(() => ({
        // Alpha alone does not remove native views from hit testing. Keep the
        // input gate on the UI thread so it changes with the same opacity frame.
        pointerEvents: progress.value > PLAYER_INPUT_THRESHOLD && !isClosing.value
            ? "auto" as const : "none" as const,
        // Chrome (title, controls, lyrics) settles in behind the artwork.
        opacity: interpolate(
            progress.value,
            [0, 0.25],
            [0, 1],
            Extrapolation.CLAMP,
        ),
    }));

    return (
        <>
            <Animated.View
                pointerEvents="none"
                style={[style.backgroundLayer, backgroundStyle]}>
                <Background
                    immersiveCoverEnabled={immersiveCoverEnabled}
                    renderImmersiveCover={renderImmersiveCover}
                    showImmersiveCover={useImmersiveCover}
                />
            </Animated.View>
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
                                <NavBar onBack={() => requestClose(onClose)} />
                                <Content
                                    // Always keep cover tree mounted across album/lyric tabs
                                    // so mini lyrics are not torn down (only unmount on page exit).
                                    keepAlbumCoverMounted
                                    tab={tab}
                                    selectTab={selectTab}
                                    isExiting={isExiting}
                                />
                                <Bottom />
                            </View>
                            {isHorizontal ? (
                                <View style={style.divider} />
                            ) : null}
                            {isHorizontal ? (
                                <View
                                    style={[
                                        globalStyle.flex1,
                                        style.rightPane,
                                    ]}>
                                    <Lyric />
                                </View>
                            ) : null}
                        </View>
                    </SafeAreaView>
                </Animated.View>
            </GestureDetector>
        </>
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
        backgroundColor: "rgba(255, 255, 255, 0.12)",
    },
});
