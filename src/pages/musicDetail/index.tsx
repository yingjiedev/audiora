import StatusBar from "@/components/base/statusBar";
import globalStyle from "@/constants/globalStyle";
import useOrientation from "@/hooks/useOrientation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
    cancelAnimation,
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Background from "./components/background";
import Bottom from "./components/bottom";
import Content, { MusicDetailContentTab } from "./components/content";
import Lyric from "./components/content/lyric";
import NavBar from "./components/navBar";
import Config, { useAppConfig } from "@/core/appConfig";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useNavigation } from "@react-navigation/native";
import useMotion from "@/hooks/useMotion";
import {
    cancelPlayerTransitionCollapse,
    collapsePlayerTransition,
    expandPlayerTransition,
    playerTransition,
    resetPlayerTransition,
    setPlayerTransitionProgress,
} from "@/core/playerTransition";
import {
    dismissDecision,
    dragProgress,
    DRAG_FULL_RATIO,
} from "@/utils/motionMath";

/** Never let a stuck animation trap the user on this screen. */
const CLOSE_WATCHDOG_MS = 900;

export default function MusicDetail() {
    const orientation = useOrientation();
    const navigation = useNavigation<any>();
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
    const closingRef = useRef(false);
    const removalRef = useRef<(() => void) | null>(null);
    const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            if (watchdogRef.current) {
                clearTimeout(watchdogRef.current);
                watchdogRef.current = null;
            }
        };
    }, []);

    /**
     * Single exit path for every way of leaving this screen (back button,
     * hardware back, drag). The screen is only removed after the collapse
     * animation reports it finished, otherwise the native removal cuts the
     * transition in half.
     */
    const requestClose = useCallback(
        (remove: () => void) => {
            if (closingRef.current) {
                remove();
                return;
            }
            closingRef.current = true;
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
        [motion.reduceMotion],
    );

    useEffect(() => {
        const unsubscribeBeforeRemove = navigation.addListener(
            "beforeRemove",
            (event: any) => {
                if (closingRef.current) {
                    // Our own removal pass — let it through.
                    return;
                }
                event?.preventDefault?.();
                const action = event?.data?.action;
                requestClose(() => {
                    if (action) {
                        navigation.dispatch(action);
                    } else {
                        navigation.goBack();
                    }
                });
            },
        );
        const unsubscribeFocus = navigation.addListener("focus", () => {
            setIsExiting(false);
        });
        const unsubscribeGestureCancel = navigation.addListener(
            "gestureCancel",
            () => {
                setIsExiting(false);
            },
        );

        return () => {
            unsubscribeBeforeRemove();
            unsubscribeFocus();
            unsubscribeGestureCancel();
        };
    }, [navigation, requestClose]);

    const onGestureEnd = useCallback(
        (dismiss: boolean, velocityY: number) => {
            if (dismiss) {
                requestClose(() => navigation.goBack());
                return;
            }
            // Cancelled: spring back to full screen, keeping the finger's speed.
            cancelPlayerTransitionCollapse({
                reduceMotion: motion.reduceMotion,
                velocity: -velocityY / (windowHeight * DRAG_FULL_RATIO),
            });
        },
        [motion.reduceMotion, navigation, requestClose, windowHeight],
    );

    // Drag-down dismiss. Only on the cover tab: the lyric tab owns vertical
    // scrolling and would otherwise fight the gesture for the same axis.
    const dragEnabled = !isHorizontal && tab === "album" && !closingRef.current;
    const dismissGesture = Gesture.Pan()
        .enabled(dragEnabled)
        .minPointers(1)
        .maxPointers(1)
        .onBegin(() => {
            cancelAnimation(progress);
        })
        .onUpdate(e => {
            setPlayerTransitionProgress(dragProgress(e.translationY, windowHeight));
        })
        .onEnd(e => {
            runOnJS(onGestureEnd)(
                dismissDecision(e.translationY, e.velocityY, windowHeight) ===
                    "dismiss",
                e.velocityY,
            );
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
            <Animated.View style={[style.backgroundLayer, backgroundStyle]}>
                <Background
                    immersiveCoverEnabled={immersiveCoverEnabled}
                    renderImmersiveCover={renderImmersiveCover}
                    showImmersiveCover={useImmersiveCover}
                />
            </Animated.View>
            <GestureDetector gesture={dismissGesture}>
                <Animated.View
                    style={[globalStyle.fwflex1, contentStyle]}
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
                                <NavBar onBack={() => setIsExiting(true)} />
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
