import React from "react";
import { StyleSheet, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import { radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { ListeningDay } from "@/core/listeningStatsModel";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";

export function activityLevel(seconds: number) {
    if (seconds <= 0) return 0;
    if (seconds < 300) return 1;
    if (seconds < 1800) return 2;
    if (seconds < 3600) return 3;
    return 4;
}

export default function ActivityGrid({ days, compact = false }: { days: ListeningDay[]; compact?: boolean }) {
    const colors = useColors();
    const { t } = useI18N();
    const columns = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7));
    const fills = [colors.surface, colors.tonalSurface, colors.primary, colors.primary, colors.active];
    const opacities = [1, 1, 0.45, 0.75, 1];
    const activeDays = days.filter(day => day.seconds > 0).length;
    return (
        <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={t("listening.activitySummary", { days: days.length, active: activeDays })}
            style={compact ? styles.compact : styles.wrapper}>
            <View style={styles.grid} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {columns.map((column, index) => (
                    <View key={index} style={styles.column}>
                        {column.map(day => {
                            const level = activityLevel(day.seconds);
                            return <View key={day.date} style={[styles.cell, { backgroundColor: fills[level], opacity: opacities[level] }]} />;
                        })}
                    </View>
                ))}
            </View>
            {!compact && (
                <View style={styles.legend}>
                    <ThemeText fontSize="caption" fontColor="textSecondary">{t("listening.less")}</ThemeText>
                    {fills.map((fill, index) => <View key={index} style={[styles.legendCell, { backgroundColor: fill, opacity: opacities[index] }]} />)}
                    <ThemeText fontSize="caption" fontColor="textSecondary">{t("listening.more")}</ThemeText>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { width: "100%", marginTop: spacing.lg },
    compact: { width: rpx(240), maxWidth: "100%" },
    grid: { flexDirection: "row", gap: spacing.xxs },
    column: { flex: 1, gap: spacing.xxs },
    cell: { width: "100%", aspectRatio: 1, borderRadius: radius.xs / 2 },
    legend: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.xxs, marginTop: spacing.md },
    legendCell: { width: rpx(16), height: rpx(16), borderRadius: radius.xs / 2 },
});
