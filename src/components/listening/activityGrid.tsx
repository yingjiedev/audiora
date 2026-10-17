import React from "react";
import { StyleSheet, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { ListeningDay } from "@/core/listeningStatsModel";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import { activityWeeks } from "./activityCalendar";

const minimumCellSize = 8;
const cellGap = Math.max(3, spacing.xxs);

export function activityLevel(seconds: number) {
    if (seconds <= 0) return 0;
    if (seconds < 300) return 1;
    if (seconds < 1800) return 2;
    if (seconds < 3600) return 3;
    return 4;
}

export default function ActivityGrid({ days, startedAt, compact = false }: { days: ListeningDay[]; startedAt: number; compact?: boolean }) {
    const colors = useColors();
    const { t } = useI18N();
    const columns = activityWeeks(days, startedAt);
    // Keep all 13–14 weeks readable; gaps and markers must not collapse on narrow screens.
    const compactWidth = Math.max(rpx(230), columns.length * minimumCellSize + Math.max(0, columns.length - 1) * cellGap);
    const fills = [colors.activityEmpty, ...colors.activityLevels];
    const activeDays = days.filter(day => day.seconds > 0).length;
    const unrecorded = columns.flat().filter(day => day && !day.recorded).length;
    return (
        <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={t("listening.activitySummary", { days: days.length, active: activeDays, unrecorded })}
            style={compact ? [styles.compact, { width: compactWidth }] : styles.wrapper}>
            <View style={styles.grid} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {!compact && (
                    <View style={styles.weekdays}>
                        {[t("listening.monday"), "", t("listening.wednesday"), "", t("listening.friday"), "", ""].map((label, index) => (
                            <View key={index} style={styles.weekday}><ThemeText fontSize="tag" fontColor="textSecondary">{label}</ThemeText></View>
                        ))}
                    </View>
                )}
                {columns.map((column, index) => (
                    <View key={index} style={styles.column}>
                        {column.map((day, weekday) => {
                            if (!day) return <View key={`padding-${weekday}`} style={styles.cell} />;
                            const level = activityLevel(day.seconds);
                            return (
                                <View key={day.date} testID={`listening-day-${day.date}`} style={styles.cell}>
                                    <View testID={`listening-mark-${day.date}`} style={[
                                        styles.mark,
                                        !day.recorded && styles.unrecorded,
                                        { backgroundColor: day.recorded ? fills[level] : colors.activityUnrecorded },
                                    ]} />
                                </View>
                            );
                        })}
                    </View>
                ))}
            </View>
            {!compact && (
                <>
                    {days.length > 0 && <View style={styles.range}><ThemeText fontSize="tag" fontColor="textSecondary">{days[0].date}</ThemeText><ThemeText fontSize="tag" fontColor="textSecondary">{days[days.length - 1].date}</ThemeText></View>}
                    <View style={styles.legend}>
                        <View style={styles.legendCell}><View testID="listening-legend-unrecorded" style={[styles.mark, styles.unrecorded, { backgroundColor: colors.activityUnrecorded }]} /></View>
                        <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.unknownLabel}>{t("listening.unrecorded")}</ThemeText>
                        <ThemeText fontSize="caption" fontColor="textSecondary">{t("listening.less")}</ThemeText>
                        {fills.map((fill, index) => <View key={index} testID={`listening-legend-level-${index}`} style={[styles.legendCell, { backgroundColor: fill }]} />)}
                        <ThemeText fontSize="caption" fontColor="textSecondary">{t("listening.more")}</ThemeText>
                    </View>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { width: "100%", marginTop: spacing.lg },
    compact: { flexShrink: 0 },
    grid: { flexDirection: "row", gap: cellGap },
    column: { flex: 1, minWidth: minimumCellSize, gap: cellGap },
    cell: { width: "100%", aspectRatio: 1 },
    mark: { flex: 1, borderRadius: 2 },
    unrecorded: { margin: 1 },
    weekdays: { width: rpx(34) },
    weekday: { flex: 1, justifyContent: "center" },
    range: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
    legend: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: spacing.xxs, marginTop: spacing.md },
    unknownLabel: { marginRight: spacing.xs },
    legendCell: { width: Math.max(minimumCellSize, rpx(16)), height: Math.max(minimumCellSize, rpx(16)), borderRadius: 2 },
});
