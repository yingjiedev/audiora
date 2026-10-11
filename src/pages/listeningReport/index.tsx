import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import AppBar from "@/components/base/appBar";
import FastImage from "@/components/base/fastImage";
import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import ActivityGrid from "@/components/listening/activityGrid";
import DailyChart from "@/components/listening/dailyChart";
import { listeningTimeLabel } from "@/components/listening/timeLabel";
import { ImgAsset } from "@/constants/assetsConst";
import { controlSize, radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { useListeningStats } from "@/core/listeningStats";
import { calendarDays, localDateKey, summarizeListening } from "@/core/listeningStatsModel";
import useColors from "@/hooks/useColors";
import rpx, { fontRpx } from "@/utils/rpx";

const minimumTouch = Math.max(44, controlSize.minimumTouch);
const periods = [7, 30, 90] as const;

export default function ListeningReport() {
    const colors = useColors();
    const { t } = useI18N();
    const data = useListeningStats();
    const [period, setPeriod] = useState<number>(30);
    const days = calendarDays(data, period);
    const summary = summarizeListening(days);
    const time = (seconds: number) => listeningTimeLabel(seconds, t.bind(null));
    return (
        <VerticalSafeAreaView style={[styles.wrapper, { backgroundColor: colors.pageBackground }]}>
            <AppBar>{t("listening.reportTitle")}</AppBar>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <ThemeText fontSize="caption" fontColor="textSecondary">{t("listening.personalRecord")}</ThemeText>
                <ThemeText fontSize="title" fontWeight="semibold" style={styles.title}>{t("listening.reportHeading")}</ThemeText>
                <View style={[styles.periods, { backgroundColor: colors.surface }]}>
                    {periods.map(value => (
                        <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: period === value }}
                            accessibilityLabel={t("listening.period", { days: value })} onPress={() => setPeriod(value)}
                            style={({ pressed }) => [styles.period, { backgroundColor: period === value ? colors.card : undefined, opacity: pressed ? 0.7 : 1 }]}>
                            <ThemeText fontSize="description" fontWeight={period === value ? "semibold" : "regular"} color={period === value ? colors.active : colors.textSecondary}>{t("listening.period", { days: value })}</ThemeText>
                        </Pressable>
                    ))}
                </View>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <ThemeText fontSize="description" fontColor="textSecondary">{t("listening.totalTime")}</ThemeText>
                    <ThemeText fontSize="hero" fontWeight="semibold" style={styles.total}>{time(summary.seconds)}</ThemeText>
                    <ThemeText fontSize="tag" fontColor="textSecondary">{t("listening.range", { from: days[0].date, to: days[days.length - 1].date })}</ThemeText>
                    <DailyChart days={days} />
                    {!summary.seconds && <ThemeText fontSize="description" fontColor="textSecondary" style={styles.emptyHint}>{t("listening.empty")}</ThemeText>}
                </View>
                <View style={styles.metrics}>
                    {[
                        [t("listening.activeDays"), t("listening.days", { count: summary.activeDays })],
                        [t("listening.longestStreak"), t("listening.days", { count: summary.longestStreak })],
                        [t("listening.dailyAverage"), time(summary.seconds / period)],
                        [t("listening.favoriteHour"), summary.favoriteHour === undefined ? t("listening.noTimeYet") : `${String(summary.favoriteHour).padStart(2, "0")}:00`],
                    ].map(([label, value]) => (
                        <View key={label} style={[styles.metric, { backgroundColor: colors.card }]}>
                            <ThemeText fontSize="caption" fontColor="textSecondary">{label}</ThemeText>
                            <ThemeText fontSize="title" fontWeight="medium" style={styles.metricValue}>{value}</ThemeText>
                        </View>
                    ))}
                </View>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <View style={styles.sectionHeading}>
                        <ThemeText fontSize="subTitle" fontWeight="semibold">{t("listening.activity")}</ThemeText>
                        <ThemeText fontSize="caption" fontColor="textSecondary">{t("listening.activityRange")}</ThemeText>
                    </View>
                    <ActivityGrid days={calendarDays(data, 91)} />
                </View>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <ThemeText fontSize="subTitle" fontWeight="semibold">{t("listening.topSongs")}</ThemeText>
                    <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.emptyHint}>{t("listening.topSongsHint")}</ThemeText>
                    {summary.topSongs.length ? summary.topSongs.map((entry, index) => (
                        <View key={`${entry.song.platform}:${entry.song.id}`} style={styles.song}>
                            <ThemeText fontSize="tag" fontColor="textSecondary" style={styles.rank}>{index + 1}</ThemeText>
                            <FastImage source={entry.song.artwork} placeholderSource={ImgAsset.albumDefault} style={styles.cover} />
                            <View style={styles.songText}>
                                <ThemeText fontSize="description" fontWeight="medium" numberOfLines={1}>{entry.song.title || t("common.unknownName")}</ThemeText>
                                <ThemeText fontSize="caption" fontColor="textSecondary" numberOfLines={1} style={styles.emptyHint}>{entry.song.artist || t("musicLibrary.unknownArtist")} · {time(entry.seconds)}</ThemeText>
                            </View>
                        </View>
                    )) : <ThemeText fontSize="description" fontColor="textSecondary" style={styles.emptyHint}>{t("listening.noSongsYet")}</ThemeText>}
                </View>
                <View style={styles.note}>
                    <Icon name="shield-keyhole-outline" size={rpx(24)} color={colors.textSecondary} />
                    <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.noteText}>{t("listening.dataNote", { date: localDateKey(data.startedAt) })}</ThemeText>
                </View>
            </ScrollView>
        </VerticalSafeAreaView>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 1 },
    content: { padding: spacing.xxxl, paddingTop: spacing.lg, gap: spacing.lg },
    title: { fontSize: fontRpx(36) },
    periods: { flexDirection: "row", borderRadius: radius.pill, padding: spacing.xxs },
    period: { flex: 1, minHeight: minimumTouch, borderRadius: radius.pill, paddingHorizontal: spacing.xs, alignItems: "center", justifyContent: "center" },
    card: { padding: spacing.lg, borderRadius: radius.xl },
    total: { marginVertical: spacing.xs, fontSize: fontRpx(48) },
    emptyHint: { marginTop: spacing.xs },
    metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    metric: { flexGrow: 1, flexBasis: "45%", minWidth: rpx(210), borderRadius: radius.lg, padding: spacing.lg },
    metricValue: { marginTop: spacing.md, fontSize: fontRpx(30) },
    sectionHeading: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between", gap: spacing.xs },
    song: { minHeight: minimumTouch, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
    rank: { width: rpx(20), textAlign: "center" },
    cover: { width: rpx(72), height: rpx(72), borderRadius: radius.sm },
    songText: { flex: 1, minWidth: 0 },
    note: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs, marginVertical: spacing.sm },
    noteText: { flex: 1 },
});
