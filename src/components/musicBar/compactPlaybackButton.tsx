import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useActiveTrack } from "react-native-track-player";
import MaskedView from "@react-native-masked-view/masked-view";
import LinearGradient from "react-native-linear-gradient";
import Icon from "@/components/base/icon";
import { useProgress } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import { getMediaUniqueKey } from "@/utils/mediaUtils";
import rpx from "@/utils/rpx";

const ICON_SIZE = Math.min(24, Math.max(20, rpx(44)));
const ICON_VIEWBOX_SIZE = 24;

interface ICompactPlaybackButtonProps {
    musicItem: IMusic.IMusicItem;
    paused: boolean;
    label: string;
    color: string;
    onPress: () => void;
}

/** Keep progress polling inside the visible button instead of rerendering the dock. */
export default function CompactPlaybackButton(props: ICompactPlaybackButtonProps) {
    const { musicItem, paused, label, color, onPress } = props;
    const colors = useColors();
    const activeTrack = useActiveTrack();
    const progress = useProgress(250);
    // Selection can change before the native queue finishes loading the new song.
    const matchesTrack = !!activeTrack?.url &&
        !(typeof activeTrack.url === "string" && activeTrack.url.startsWith("audiora://")) &&
        getMediaUniqueKey(activeTrack as IMusic.IMusicItem) === getMediaUniqueKey(musicItem);
    const duration = Number.isFinite(progress.duration) && progress.duration > 0 ? progress.duration : 0;
    const position = Number.isFinite(progress.position) ? progress.position : 0;
    const fraction = matchesTrack && duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0;
    // The original SVGs have transparent padding above and below their glyphs.
    // Fill the visible glyph height so early progress is not lost in that padding.
    const glyphInset = paused ? 3.75 : 4.5;
    const fillHeight = fraction > 0
        ? (glyphInset + (ICON_VIEWBOX_SIZE - glyphInset * 2) * fraction) / ICON_VIEWBOX_SIZE * ICON_SIZE
        : 0;
    const iconName = paused ? "play" : "pause";

    return (
        <Pressable
            testID="compact-playback-button"
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityValue={matchesTrack && duration > 0 ? { min: 0, max: 100, now: Math.round(fraction * 100) } : undefined}
            onPress={onPress}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.content, paused && styles.playIcon]}>
                <Icon
                    testID="compact-playback-base"
                    name={iconName}
                    color={color}
                    size={ICON_SIZE}
                />
                <View testID="compact-playback-progress" style={[styles.progress, { height: fillHeight }]}>
                    <MaskedView
                        style={styles.progressIcon}
                        maskElement={<Icon testID="compact-playback-fill" name={iconName} color={colors.active} size={ICON_SIZE} />}>
                        <LinearGradient
                            colors={colors.compactPlaybackProgressGradient}
                            locations={[0, 0.35, 1]}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                            style={[styles.gradient, { height: fillHeight }]}
                        />
                    </MaskedView>
                </View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        minWidth: 48,
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
    },
    content: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        alignItems: "center",
        justifyContent: "center",
    },
    playIcon: {
        transform: [{ translateX: 1 }],
    },
    progress: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        overflow: "hidden",
    },
    progressIcon: {
        position: "absolute",
        bottom: 0,
        width: ICON_SIZE,
        height: ICON_SIZE,
    },
    gradient: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
    },
    pressed: {
        opacity: 0.7,
    },
});
