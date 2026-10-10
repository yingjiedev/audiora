import React, { useEffect, useRef, useState } from "react";
import { AppState, ScrollView, StyleSheet } from "react-native";
import Animated, {
    cancelAnimation,
    Easing,
    runOnUI,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { spacing } from "@/constants/designSystem";
import useMotion from "@/hooks/useMotion";
import ThemeText from "./themeText";

/** Reading speed stays constant as the title length changes. */
const SCROLL_SPEED = 28;
const GAP = spacing.xxl * 2;

interface IMarqueeTextProps {
    text: string;
    color?: string;
    active?: boolean;
}

export default function MarqueeText({ text, color, active = true }: IMarqueeTextProps) {
    const [viewportWidth, setViewportWidth] = useState(0);
    const [measurement, setMeasurement] = useState({ text: "", width: 0 });
    const currentText = useRef(text);
    currentText.current = text;
    const [foreground, setForeground] = useState(AppState.currentState === "active");
    const motion = useMotion();
    const offset = useSharedValue(0);
    const textWidth = measurement.text === text ? measurement.width : 0;
    const overflow = viewportWidth > 0 && textWidth > viewportWidth;
    const distance = textWidth + GAP;
    const duration = distance / SCROLL_SPEED * 1000;
    const delay = motion.duration("slow") * 3;
    const scrolling = active && foreground && overflow && !motion.reduceMotion;
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: offset.value }],
    }));

    useEffect(() => {
        if (!active) {
            return;
        }
        setForeground(AppState.currentState === "active");
        const subscription = AppState.addEventListener("change", state => {
            setForeground(state === "active");
        });
        return () => subscription.remove();
    }, [active]);

    useEffect(() => {
        runOnUI(() => {
            "worklet";
            cancelAnimation(offset);
            offset.value = 0;
            if (scrolling) {
                offset.value = withRepeat(
                    withDelay(delay, withTiming(-distance, { duration, easing: Easing.linear })),
                    -1,
                    false,
                );
            }
        })();
        return () => {
            runOnUI(() => {
                "worklet";
                cancelAnimation(offset);
                offset.value = 0;
            })();
        };
    }, [text, viewportWidth, textWidth, scrolling, delay, distance, duration, offset]);

    return (
        <ScrollView
            testID="marquee-text-viewport"
            horizontal
            scrollEnabled={false}
            removeClippedSubviews={false}
            showsHorizontalScrollIndicator={false}
            pointerEvents="none"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={styles.viewport}
            onLayout={event => {
                const width = event.nativeEvent.layout.width;
                if (Number.isFinite(width) && width >= 0) {
                    setViewportWidth(width);
                }
            }}>
            {/* Horizontal content measures the full string, without constraining it to the viewport. */}
            <Animated.View style={[styles.track, animatedStyle]}>
                <ThemeText
                    key={text}
                    testID="marquee-text-content"
                    fontSize="content"
                    color={color}
                    fontColor="musicBarText"
                    numberOfLines={1}
                    ellipsizeMode="clip"
                    onLayout={event => {
                        const width = event.nativeEvent.layout.width;
                        if (currentText.current === text && Number.isFinite(width) && width >= 0) {
                            setMeasurement({ text, width });
                        }
                    }}>
                    {text}
                </ThemeText>
                {overflow ? (
                    <ThemeText
                        fontSize="content"
                        color={color}
                        fontColor="musicBarText"
                        numberOfLines={1}
                        ellipsizeMode="clip"
                        style={styles.copy}>
                        {text}
                    </ThemeText>
                ) : null}
            </Animated.View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    viewport: {
        flexGrow: 0,
        flexShrink: 1,
        overflow: "hidden",
    },
    track: {
        flexDirection: "row",
        alignItems: "center",
    },
    copy: {
        marginLeft: GAP,
    },
});
