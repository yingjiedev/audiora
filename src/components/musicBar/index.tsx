import React, { memo, useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { CircularProgressBase } from "react-native-circular-progress-indicator";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showPanel } from "../panels/usePanel";
import useColors from "@/hooks/useColors";
import TrackPlayer, {
    useCurrentMusic,
    useMusicState,
    useProgress,
} from "@/core/trackPlayer";
import { musicIsPaused } from "@/utils/trackUtils";
import MusicInfo from "./musicInfo";
import Icon from "@/components/base/icon.tsx";
import RoundActionButton, {
    useRoundActionForeground,
} from "@/components/base/roundActionButton";
import { iconSizeConst } from "@/constants/uiConst";
import { radius, spacing } from "@/constants/designSystem";

/** Single control: ring + icon share the same box and stay concentric. */
const PLAY_RADIUS = rpx(38);
const PLAY_STROKE = rpx(3);
const PLAY_SIZE = PLAY_RADIUS * 2;
const PLAY_ICON_SIZE = iconSizeConst.light;
const PLAYLIST_ICON_SIZE = rpx(42);
const BAR_HEIGHT = rpx(108);

function CircularPlayBtn() {
    const progress = useProgress();
    const musicState = useMusicState();
    // 进度环跟图标同色，走圆钮统一的取色，不在这里另算一份
    const ringColor = useRoundActionForeground();

    const isPaused = musicIsPaused(musicState);
    const progressValue = progress?.duration
        ? Math.min(100, Math.max(0, (100 * progress.position) / progress.duration))
        : 0;

    return (
        <RoundActionButton
            variant="solid"
            accessibilityLabel={"播放或暂停歌曲"}
            hitSlop={10}
            size={PLAY_SIZE}
            iconName={isPaused ? "play" : "pause"}
            iconSize={PLAY_ICON_SIZE}
            iconStyle={isPaused ? style.playIconNudge : undefined}
            onPress={async () => {
                if (isPaused) {
                    await TrackPlayer.play();
                } else {
                    await TrackPlayer.pause();
                }
            }}>
            {/* 进度环与图标共用同一个方框、同一个圆心 */}
            <CircularProgressBase
                activeStrokeWidth={PLAY_STROKE}
                inActiveStrokeWidth={rpx(2)}
                inActiveStrokeOpacity={0.25}
                value={progressValue}
                duration={100}
                radius={PLAY_RADIUS}
                activeStrokeColor={ringColor}
                inActiveStrokeColor={ringColor}
            />
        </RoundActionButton>
    );
}

function MusicBar() {
    const musicItem = useCurrentMusic();

    const [showKeyboard, setKeyboardStatus] = useState(false);

    const colors = useColors();
    const safeAreaInsets = useSafeAreaInsets();

    useEffect(() => {
        const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
            setKeyboardStatus(true);
        });
        const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
            setKeyboardStatus(false);
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    return (
        <>
            {musicItem && !showKeyboard && (
                <View
                    style={[
                        style.wrapperOuter,
                        {
                            shadowColor: colors.shadow,
                            marginLeft: rpx(18) + safeAreaInsets.left,
                            marginRight: rpx(18) + safeAreaInsets.right,
                        },
                    ]}>
                    <View
                        style={[
                            style.wrapperInner,
                            {
                                backgroundColor: colors.musicBar,
                                borderColor: colors.border,
                            },
                        ]}
                        accessible
                        accessibilityLabel={`歌曲: ${musicItem.title} 歌手: ${musicItem.artist}`}>
                        <MusicInfo musicItem={musicItem} />
                        <View style={style.actionGroup}>
                            <CircularPlayBtn />
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="播放列表"
                                style={style.actionButton}
                                onPress={() => {
                                    showPanel("PlayList");
                                }}>
                                <Icon
                                    name="playlist"
                                    size={PLAYLIST_ICON_SIZE}
                                    color={colors.musicBarText}
                                />
                            </Pressable>
                        </View>
                    </View>
                </View>
            )}
        </>
    );
}

export default memo(MusicBar, () => true);

const style = StyleSheet.create({
    wrapperOuter: {
        marginBottom: spacing.sm,
        borderRadius: radius.lg,
        shadowOffset: { width: 0, height: rpx(6) },
        shadowOpacity: 0.12,
        shadowRadius: rpx(14),
        elevation: 5,
        backgroundColor: "transparent",
    },
    wrapperInner: {
        height: BAR_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.lg,
        overflow: "hidden",
        paddingRight: spacing.xs,
    },
    actionGroup: {
        height: "100%",
        flexShrink: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingLeft: rpx(2),
    },
    /**
     * One fixed square. Both ring and icon are absolute-filled layers so they
     * share the exact same geometry (no flow siblings that can drift apart).
     */
    playIconNudge: {
        // Play triangle reads slightly left-of-center optically.
        marginLeft: rpx(2),
    },
    actionButton: {
        width: rpx(76),
        height: rpx(88),
        marginLeft: rpx(8),
        alignItems: "center",
        justifyContent: "center",
    },
});
