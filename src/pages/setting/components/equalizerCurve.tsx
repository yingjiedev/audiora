import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { EqualizerBand, formatGain } from "@/core/audioEffects/model";
import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";

interface EqualizerCurveProps {
    bands: EqualizerBand[];
    compact?: boolean;
    minimumGain?: number;
    maximumGain?: number;
}

/** Configured control points, rather than an audio spectrum or measured response. */
export default function EqualizerCurve({ bands, compact = false, minimumGain = -6, maximumGain = 6 }: EqualizerCurveProps) {
    const colors = useColors();
    const width = 300;
    const height = compact ? 52 : 112;
    const padding = 8;
    const x = (frequency: number) => padding + Math.log(frequency / 20) / Math.log(24000 / 20) * (width - padding * 2);
    const y = (gain: number) => padding + (maximumGain - Math.max(minimumGain, Math.min(maximumGain, gain))) /
        (maximumGain - minimumGain) * (height - padding * 2);
    const points = bands.map(band => `${x(band.frequencyHz)},${y(band.gainDb)}`).join(" ");

    return (
        <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.plot}>
                {!compact ? (
                    <View style={styles.axis}>
                        <ThemeText fontSize="caption" fontColor="textSecondary">{formatGain(maximumGain)}</ThemeText>
                        <ThemeText fontSize="caption" fontColor="textSecondary">0</ThemeText>
                        <ThemeText fontSize="caption" fontColor="textSecondary">{formatGain(minimumGain)}</ThemeText>
                    </View>
                ) : null}
                <View style={styles.graph}>
                    <Svg width="100%" height={rpx(compact ? 88 : 216)} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                        {!compact ? [63, 250, 1000, 4000, 16000].map(frequency => (
                            <Line key={frequency} x1={x(frequency)} x2={x(frequency)} y1={padding} y2={height - padding}
                                stroke={colors.divider} strokeWidth={0.6} />
                        )) : null}
                        <Line x1={padding} x2={width - padding} y1={y(0)} y2={y(0)} stroke={colors.textSecondary} strokeWidth={0.7} />
                        <Polyline points={points} fill="none" stroke={colors.active} strokeWidth={compact ? 2 : 2.5} strokeLinejoin="round" />
                        {!compact ? bands.map(band => (
                            <Circle key={band.frequencyHz} cx={x(band.frequencyHz)} cy={y(band.gainDb)} r={3}
                                fill={colors.card} stroke={colors.active} strokeWidth={2} />
                        )) : null}
                    </Svg>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    plot: { flexDirection: "row", gap: rpx(12) },
    axis: { justifyContent: "space-between", paddingVertical: rpx(8), minWidth: rpx(64) },
    graph: { flex: 1, minWidth: 0 },
});
