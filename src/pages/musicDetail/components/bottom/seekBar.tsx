import React, { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import rpx from "@/utils/rpx";
import Slider from "@react-native-community/slider";
import timeformat from "@/utils/timeformat";
import { fontSizeConst } from "@/constants/uiConst";
import TrackPlayer, { useProgress } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import { useI18N } from "@/core/i18n";

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

export default function SeekBar() {
    const progress = useProgress(1000);
    const [tmpProgress, setTmpProgress] = useState<number | null>(null);
    const slidingRef = useRef(false);
    const colors = useColors();
    const { t } = useI18N();

    const foreground = colors.onMedia ?? colors.text;
    const secondary = colors.onMediaSecondary ?? foreground;
    const track = colors.onMediaTrack ?? secondary;
    const position = tmpProgress ?? progress.position;

    return (
        <View style={style.wrapper}>
            <Slider
                style={style.slider}
                minimumTrackTintColor={foreground}
                maximumTrackTintColor={track}
                thumbTintColor={foreground}
                minimumValue={0}
                maximumValue={progress.duration}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={t("musicDetail.a11y.seek")}
                accessibilityValue={{
                    min: 0,
                    max: Math.max(0, Math.round(progress.duration)),
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
                    if (val >= progress.duration - 2) {
                        val = progress.duration - 2;
                    }
                    TrackPlayer.seekTo(val);
                }}
                value={progress.position}
            />
            <View style={style.timeRow}>
                <TimeLabel time={position} color={secondary} />
                <TimeLabel time={progress.duration} color={secondary} />
            </View>
        </View>
    );
}

const style = StyleSheet.create({
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
