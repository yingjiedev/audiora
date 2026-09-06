import Icon, { IIconName } from "@/components/base/icon.tsx";
import { radius } from "@/constants/designSystem";
import repeatModeConst from "@/constants/repeatModeConst";
import { showPanel } from "@/components/panels/usePanel";
import TrackPlayer, { useMusicState, useRepeatMode } from "@/core/trackPlayer";
import useOrientation from "@/hooks/useOrientation";
import delay from "@/utils/delay";
import { musicIsPaused } from "@/utils/trackUtils";
import rpx from "@/utils/rpx";
import React, { ReactNode } from "react";
import { InteractionManager, Pressable, StyleSheet, View } from "react-native";

function ControlButton(props: {
    accessibilityLabel: string;
    children: ReactNode;
    primary?: boolean;
    onPress: () => void;
}) {
    const { accessibilityLabel, children, primary, onPress } = props;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            onPress={onPress}
            style={({ pressed }) => [
                primary ? styles.primaryButton : styles.controlButton,
                pressed && styles.pressed,
            ]}>
            {children}
        </Pressable>
    );
}

function ControlIcon(props: { name: IIconName; size: number; dark?: boolean }) {
    return (
        <Icon
            name={props.name}
            size={props.size}
            color={props.dark ? "#315FEA" : "#FFFFFF"}
        />
    );
}

export default function PlayControl() {
    const repeatMode = useRepeatMode();
    const musicState = useMusicState();
    const orientation = useOrientation();
    const isPaused = musicIsPaused(musicState);

    return (
        <View
            style={[
                styles.wrapper,
                orientation === "horizontal" && styles.horizontalWrapper,
            ]}>
            <ControlButton
                accessibilityLabel="切换循环模式"
                onPress={() => {
                    InteractionManager.runAfterInteractions(async () => {
                        await delay(20, false);
                        TrackPlayer.toggleRepeatMode();
                    });
                }}>
                <ControlIcon
                    name={repeatModeConst[repeatMode].icon}
                    size={rpx(42)}
                />
            </ControlButton>
            <ControlButton
                accessibilityLabel="上一首"
                onPress={() => TrackPlayer.skipToPrevious()}>
                <ControlIcon name="skip-left" size={rpx(58)} />
            </ControlButton>
            <ControlButton
                primary
                accessibilityLabel={isPaused ? "播放" : "暂停"}
                onPress={() => {
                    if (isPaused) {
                        TrackPlayer.play();
                    } else {
                        TrackPlayer.pause();
                    }
                }}>
                <ControlIcon
                    name={isPaused ? "play" : "pause"}
                    size={rpx(58)}
                    dark
                />
            </ControlButton>
            <ControlButton
                accessibilityLabel="下一首"
                onPress={() => TrackPlayer.skipToNext()}>
                <ControlIcon name="skip-right" size={rpx(58)} />
            </ControlButton>
            <ControlButton
                accessibilityLabel="播放列表"
                onPress={() => showPanel("PlayList")}>
                <ControlIcon name="playlist" size={rpx(42)} />
            </ControlButton>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        height: rpx(116),
        marginTop: rpx(22),
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    horizontalWrapper: {
        marginTop: 0,
    },
    controlButton: {
        width: rpx(88),
        height: rpx(88),
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
    },
    primaryButton: {
        width: rpx(108),
        height: rpx(108),
        borderRadius: radius.pill,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#08132D",
        shadowOffset: { width: 0, height: rpx(10) },
        shadowOpacity: 0.22,
        shadowRadius: rpx(18),
        elevation: 8,
    },
    pressed: {
        opacity: 0.72,
        transform: [{ scale: 0.96 }],
    },
});
