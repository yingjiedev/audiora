import Icon, { IIconName } from "@/components/base/icon.tsx";
import { elevation, radius } from "@/constants/designSystem";
import repeatModeConst from "@/constants/repeatModeConst";
import { showPanel } from "@/components/panels/usePanel";
import TrackPlayer, { useMusicState, useRepeatMode } from "@/core/trackPlayer";
import useOrientation from "@/hooks/useOrientation";
import delay from "@/utils/delay";
import { musicIsPaused } from "@/utils/trackUtils";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import { useI18N } from "@/core/i18n";
import React, { ReactNode } from "react";
import { InteractionManager, Pressable, StyleSheet, View } from "react-native";

function ControlButton(props: {
    accessibilityLabel: string;
    children: ReactNode;
    primary?: boolean;
    onPress: () => void;
}) {
    const { accessibilityLabel, children, primary, onPress } = props;
    const colors = useColors();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            onPress={onPress}
            style={({ pressed }) => [
                primary ? styles.primaryButton : styles.controlButton,
                // 主操作按钮与 Mini Player 同源：主色底 + onPrimary 前景
                primary
                    ? {
                        backgroundColor: colors.primary,
                        shadowColor: colors.shadow ?? colors.text,
                    }
                    : null,
                primary ? elevation.mid : null,
                pressed && styles.pressed,
            ]}>
            {children}
        </Pressable>
    );
}

/**
 * 控制区图标统一走「沉浸层前景色」；主按钮内部改用 onPrimary，
 * 与 Mini Player 的 CircularPlayBtn 保持同一套配色规则。
 */
function ControlIcon(props: {
    name: IIconName;
    size: number;
    onPrimary?: boolean;
}) {
    const colors = useColors();

    return (
        <Icon
            name={props.name}
            size={props.size}
            color={
                props.onPrimary
                    ? colors.onPrimary ?? colors.primary
                    : colors.onMedia ?? colors.text
            }
        />
    );
}

export default function PlayControl() {
    const repeatMode = useRepeatMode();
    const musicState = useMusicState();
    const orientation = useOrientation();
    const { t } = useI18N();
    const isPaused = musicIsPaused(musicState);

    return (
        <View
            style={[
                styles.wrapper,
                orientation === "horizontal" && styles.horizontalWrapper,
            ]}>
            <ControlButton
                accessibilityLabel={t("musicDetail.a11y.toggleRepeatMode")}
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
                accessibilityLabel={t("musicDetail.a11y.skipToPrevious")}
                onPress={() => TrackPlayer.skipToPrevious()}>
                <ControlIcon name="skip-left" size={rpx(58)} />
            </ControlButton>
            <ControlButton
                primary
                accessibilityLabel={
                    isPaused
                        ? t("musicDetail.a11y.play")
                        : t("musicDetail.a11y.pause")
                }
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
                    onPrimary
                />
            </ControlButton>
            <ControlButton
                accessibilityLabel={t("musicDetail.a11y.skipToNext")}
                onPress={() => TrackPlayer.skipToNext()}>
                <ControlIcon name="skip-right" size={rpx(58)} />
            </ControlButton>
            <ControlButton
                accessibilityLabel={t("musicDetail.a11y.playlist")}
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
        marginTop: rpx(12),
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
        alignItems: "center",
        justifyContent: "center",
    },
    pressed: {
        opacity: 0.72,
        transform: [{ scale: 0.96 }],
    },
});
