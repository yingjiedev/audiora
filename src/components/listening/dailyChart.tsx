import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import ThemeText from "@/components/base/themeText";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { ListeningDay } from "@/core/listeningStatsModel";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import { listeningTimeLabel } from "./timeLabel";

export default function DailyChart({ days }: { days: ListeningDay[] }) {
    const colors = useColors();
    const { t } = useI18N();
    const peak = Math.max(0, ...days.map(day => day.seconds));
    const max = Math.max(1, peak);
    const step = 600 / Math.max(1, days.length);
    const labels = [days[0], days[Math.floor(days.length / 2)], days[days.length - 1]].filter(Boolean);
    const best = days.reduce<ListeningDay | undefined>((previous, day) => !previous || day.seconds > previous.seconds ? day : previous, undefined);
    return (
        <View style={styles.wrapper}>
            <View accessible accessibilityRole="image" accessibilityLabel={t("listening.chartSummary", { days: days.length, time: listeningTimeLabel(peak, t.bind(null)) })}>
                <Svg width="100%" height={rpx(220)} viewBox="0 0 600 180" preserveAspectRatio="none">
                    {[30, 95, 160].map(y => <Line key={y} x1={0} x2={600} y1={y} y2={y} stroke={colors.divider} strokeWidth={1} />)}
                    {days.map((day, index) => {
                        const height = day.seconds > 0 ? Math.max(3, day.seconds / max * 130) : 0;
                        return <Rect key={day.date} x={index * step + step * 0.15} y={160 - height} width={step * 0.7} height={height} rx={Math.min(4, step * 0.2)} fill={colors.active} />;
                    })}
                </Svg>
            </View>
            <View style={styles.axis}>
                {labels.map((day, index) => <ThemeText key={index} fontSize="caption" fontColor="textSecondary">{day.date.slice(5).replace("-", "/")}</ThemeText>)}
            </View>
            {best && best.seconds > 0 && (
                <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.hint}>{t("listening.busiestDay", { date: best.date, time: listeningTimeLabel(best.seconds, t.bind(null)) })}</ThemeText>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { marginTop: spacing.md },
    axis: { flexDirection: "row", justifyContent: "space-between" },
    hint: { marginTop: spacing.sm },
});
