import Color from "color";
import React, { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import rpx from "@/utils/rpx";
import Slider from "@react-native-community/slider";
import timeformat from "@/utils/timeformat";
import { fontSizeConst } from "@/constants/uiConst";
import TrackPlayer, { useProgress } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import { useI18N } from "@/core/i18n";
import { spacing } from "@/constants/designSystem";

interface ITimeLabelProps {
    time: number;
    color: string;
}

function TimeLabel(props: ITimeLabelProps) {
    return (
        <Text style={[style.text, { color: props.color }]}>
            {timeformat(Math.max(props.time, 0))}
        </Text>
    );
}

export default function SeekBar(props: { variant?: "media" | "surface" }) {
    const progress = useProgress(1000);
    const [tmpProgress, setTmpProgress] = useState<number | null>(null);
    const slidingRef = useRef(false);
    const colors = useColors();
    const { t } = useI18N();

    const surface = props.variant === "surface";
    const foreground = surface ? colors.musicBarText ?? colors.text : colors.onMedia ?? colors.text;
    const secondary = surface ? colors.textSecondary ?? colors.text : colors.onMediaSecondary ?? foreground;
    const track = surface ? Color(foreground).alpha(0.22).toString() : colors.onMediaTrack ?? secondary;
    const duration = Number.isFinite(progress.duration) ? Math.max(0, progress.duration) : 0;
    const currentPosition = Number.isFinite(progress.position) ? progress.position : 0;
    const position = Math.min(duration, Math.max(0, tmpProgress ?? currentPosition));

    return (
        <View style={[style.wrapper, surface && style.surfaceWrapper]}>
            <Slider
                style={[style.slider, surface && style.surfaceSlider]}
                minimumTrackTintColor={foreground}
                maximumTrackTintColor={track}
                thumbTintColor={foreground}
                thumbSize={surface ? Math.max(8, rpx(16)) : undefined}
                minimumValue={0}
                maximumValue={duration}
                disabled={duration <= 0}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={t("musicDetail.a11y.seek")}
                accessibilityValue={{
                    min: 0,
                    max: Math.round(duration),
                    now: Math.max(0, Math.round(position)),
                }}
                onSlidingStart={() => {
                    slidingRef.current = true;
                }}
                onValueChange={val => {
                    if (slidingRef.current) {
                        setTmpProgress(val);
                    }
                }}
                onSlidingComplete={val => {
                    slidingRef.current = false;
                    setTmpProgress(null);
                    if (duration > 0 && Number.isFinite(val)) {
                        TrackPlayer.seekTo(Math.max(0, Math.min(val, duration - 2)));
                    }
                }}
                value={Math.min(duration, Math.max(0, currentPosition))}
            />
            <View style={[style.timeRow, surface && style.surfaceTimeRow]} pointerEvents="none">
                <TimeLabel time={position} color={secondary} />
                <TimeLabel time={duration} color={secondary} />
            </View>
        </View>
    );
}

const style = StyleSheet.create({
    surfaceWrapper: {
        paddingHorizontal: 0,
    },
    surfaceSlider: {
        height: 48,
    },
    surfaceTimeRow: {
        marginTop: -spacing.xl,
    },
    wrapper: {
        width: "100%",
        paddingHorizontal: rpx(30),
    },
    slider: {
        width: "100%",
        // 触控目标：原来 rpx(40) 只有 20dp，滑块很难按到。
        height: rpx(56),
    },
    /** 不再额外内缩，左右时间文字与滑块两端对齐 */
    timeRow: {
        width: "100%",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    text: {
        fontSize: fontSizeConst.description,
        includeFontPadding: false,
    },
});
