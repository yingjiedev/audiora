import React from "react";
import { StyleSheet, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import { radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { ListeningDay } from "@/core/listeningStatsModel";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import { activityWeeks } from "./activityCalendar";

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
    const fills = [colors.activityEmpty, ...colors.activityLevels];
    const activeDays = days.filter(day => day.seconds > 0).length;
    const unrecorded = columns.flat().filter(day => day && !day.recorded).length;
    return (
        <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={t("listening.activitySummary", { days: days.length, active: activeDays, unrecorded })}
            style={compact ? styles.compact : styles.wrapper}>
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
                                <View key={day.date} testID={`listening-day-${day.date}`} style={[
                                    styles.cell,
                                    day.recorded ? { backgroundColor: fills[level] } : styles.unrecorded,
                                    (!day.recorded || level === 0) && { borderColor: colors.activityOutline, borderWidth: 1 },
                                ]} />
                            );
                        })}
                    </View>
                ))}
            </View>
            {!compact && (
                <>
                    {days.length > 0 && <View style={styles.range}><ThemeText fontSize="tag" fontColor="textSecondary">{days[0].date}</ThemeText><ThemeText fontSize="tag" fontColor="textSecondary">{days[days.length - 1].date}</ThemeText></View>}
                    <View style={styles.legend}>
                        <View style={[styles.legendCell, styles.unrecorded, { borderColor: colors.activityOutline, borderWidth: 1 }]} />
                        <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.unknownLabel}>{t("listening.unrecorded")}</ThemeText>
                        <ThemeText fontSize="caption" fontColor="textSecondary">{t("listening.less")}</ThemeText>
                        {fills.map((fill, index) => <View key={index} style={[styles.legendCell, { backgroundColor: fill }, index === 0 && { borderColor: colors.activityOutline, borderWidth: 1 }]} />)}
                        <ThemeText fontSize="caption" fontColor="textSecondary">{t("listening.more")}</ThemeText>
                    </View>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { width: "100%", marginTop: spacing.lg },
    compact: { width: rpx(188), maxWidth: "100%" },
    grid: { flexDirection: "row", gap: spacing.xxs },
    column: { flex: 1, gap: spacing.xxs },
    cell: { width: "100%", aspectRatio: 1, borderRadius: radius.xs / 2 },
    unrecorded: { borderStyle: "dashed" },
    weekdays: { width: rpx(34) },
    weekday: { flex: 1, justifyContent: "center" },
    range: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
    legend: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: spacing.xxs, marginTop: spacing.md },
    unknownLabel: { marginRight: spacing.xs },
    legendCell: { width: rpx(16), height: rpx(16), borderRadius: radius.xs / 2 },
});
