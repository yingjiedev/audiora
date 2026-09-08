import React, { useEffect } from "react";
import {
    StyleSheet,
    SwitchProps,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import Color from "color";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { timingConfig } from "@/constants/commonConst";

interface ISwitchProps extends SwitchProps {
    activeTrackColor?: string;
    disabled?: boolean;
    inactiveTrackColor?: string;
    thumbColor?: string;
    thumbSize?: number;
    trackHeight?: number;
    trackWidth?: number;
}

export default function ThemeSwitch(props: ISwitchProps) {
    const {
        activeTrackColor,
        disabled,
        inactiveTrackColor,
        onValueChange,
        thumbColor: customThumbColor,
        thumbSize = rpx(34),
        trackHeight = rpx(40),
        trackWidth = rpx(80),
        value,
    } = props;
    const colors = useColors();
    const thumbInset = (trackHeight - thumbSize) / 2;
    const thumbTravelDistance = trackWidth - thumbSize - thumbInset * 2;

    const sharedValue = useSharedValue(value ? 1 : 0);

    useEffect(() => {
        sharedValue.value = value ? 1 : 0;
    }, [value, sharedValue]);

    // 圆点颜色按轨道底色取对比色：主色偏浅（如白色）时
    // 白色圆点会跟轨道糊成一团，改用深色圆点
    const trackColor = value
        ? activeTrackColor ?? colors.primary
        : inactiveTrackColor ?? colors.textSecondary;
    let thumbColor = customThumbColor ?? "#FFFFFF";
    try {
        if (!customThumbColor) {
            thumbColor = Color(trackColor).isDark() ? "#FFFFFF" : "#1B1B1B";
        }
    } catch {
        // 非法色值保持白点
    }

    const thumbStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateX: withTiming(
                        sharedValue.value * thumbTravelDistance,
                        timingConfig.animationNormal,
                    ),
                },
            ],
        };
    });

    return (
        <TouchableWithoutFeedback
            onPress={() => {
                if (!disabled) {
                    onValueChange?.(!value);
                }
            }}>
            <View
                style={[
                    styles.container,
                    {
                        backgroundColor: trackColor,
                        borderRadius: trackHeight / 2,
                        height: trackHeight,
                        width: trackWidth,
                    },
                    props?.style,
                ]}>
                <Animated.View
                    style={[
                        styles.thumb,
                        thumbStyle,
                        {
                            backgroundColor: thumbColor,
                            borderRadius: thumbSize / 2,
                            height: thumbSize,
                            left: thumbInset,
                            width: thumbSize,
                        },
                    ]}
                />
            </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: "center",
    },
    thumb: {
    },
});
