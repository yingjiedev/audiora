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
import { elevation, radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import Color from "color";

/** Single control: ring + icon share the same box and stay concentric. */
const PLAY_RADIUS = rpx(38);
const PLAY_STROKE = rpx(3);
const PLAY_SIZE = PLAY_RADIUS * 2;
const PLAY_ICON_SIZE = iconSizeConst.light;
const PLAYLIST_ICON_SIZE = rpx(40);
const BAR_HEIGHT = rpx(120);

function CircularPlayBtn() {
    const progress = useProgress();
    const musicState = useMusicState();
    // 进度环跟图标同色，走圆钮统一的取色，不在这里另算一份
    const ringColor = useRoundActionForeground();
    const { t } = useI18N();

    const isPaused = musicIsPaused(musicState);
    const progressValue = progress?.duration
        ? Math.min(100, Math.max(0, (100 * progress.position) / progress.duration))
        : 0;

    return (
        <RoundActionButton
            variant="solid"
            accessibilityLabel={t("musicBar.a11y.playOrPause")}
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
                // 0.25 在实心主色底上只剩隐约一段弧，进度信息不可读。
                inActiveStrokeOpacity={0.45}
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
    const { t } = useI18N();

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

    // 与「继续聆听」等列表卡拉开层级：主色染色底 + 悬浮级阴影 + 更大的圆角。
    const barBackground = Color(colors.musicBar ?? colors.card)
        .mix(Color(colors.primary), 0.12)
        .toString();
    const secondarySurface = Color(colors.musicBarText ?? colors.text)
        .alpha(0.1)
        .toString();

    return (
        <>
            {musicItem && !showKeyboard && (
                <View
                    style={[
                        style.wrapperOuter,
                        {
                            shadowColor: colors.shadow ?? colors.text,
                            marginLeft: rpx(18) + safeAreaInsets.left,
                            marginRight: rpx(18) + safeAreaInsets.right,
                        },
                        elevation.high,
                    ]}>
                    <View
                        style={[
                            style.wrapperInner,
                            {
                                backgroundColor: barBackground,
                                borderColor: colors.border,
                            },
                        ]}
                        accessible
                        accessibilityLabel={t("musicBar.a11y.nowPlaying", {
                            title: musicItem.title ?? "",
                            artist: musicItem.artist ?? "",
                        })}>
                        <MusicInfo musicItem={musicItem} />
                        <View style={style.actionGroup}>
                            <CircularPlayBtn />
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t("musicBar.a11y.playlist")}
                                style={[
                                    style.actionButton,
                                    { backgroundColor: secondarySurface },
                                ]}
                                onPress={() => {
                                    showPanel("PlayList");
                                }}>
                                <Icon
                                    name="playlist"
                                    size={PLAYLIST_ICON_SIZE}
                                    color={colors.musicBarText ?? colors.text}
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
        borderRadius: radius.xl,
        backgroundColor: "transparent",
    },
    wrapperInner: {
        height: BAR_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.xl,
        overflow: "hidden",
        paddingRight: spacing.md,
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
    /**
     * 与播放按钮同为圆形实心承载面，只是用中性染色表示低强调 ——
     * 同一卡片里不再混用「实心圆 + 裸线性图标」两种语言。
     */
    actionButton: {
        width: PLAY_SIZE,
        height: PLAY_SIZE,
        marginLeft: rpx(10),
        borderRadius: PLAY_RADIUS,
        alignItems: "center",
        justifyContent: "center",
    },
});
