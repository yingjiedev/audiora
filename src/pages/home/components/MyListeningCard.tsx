import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import FastImage from "@/components/base/fastImage";
import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import ActivityGrid from "@/components/listening/activityGrid";
import { listeningTimeLabel } from "@/components/listening/timeLabel";
import { ImgAsset } from "@/constants/assetsConst";
import { controlSize, radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { useListeningStats } from "@/core/listeningStats";
import { calendarDays, localDateKey, summarizeListening } from "@/core/listeningStatsModel";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx, { fontRpx } from "@/utils/rpx";

const minimumTouch = Math.max(44, controlSize.minimumTouch);

export default function MyListeningCard({ sheetId, count, cover }: { sheetId?: string; count: number; cover?: string }) {
    const colors = useColors();
    const { t } = useI18N();
    const navigate = useNavigate();
    const data = useListeningStats();
    const days = calendarDays(data, 91);
    const today = days[days.length - 1];
    const summary = summarizeListening(days);
    const startDate = localDateKey(data.startedAt);
    const startLabel = startDate.slice(0, 4) === today.date.slice(0, 4) ? startDate.slice(5).replace("-", "/") : startDate;
    const activityHint = startDate > days[0].date
        ? t("listening.recordedActivity", { date: startLabel, count: summary.activeDays })
        : t("listening.recentActive", { days: days.length, count: summary.activeDays });
    const todayTime = listeningTimeLabel(today.seconds, t.bind(null));
    const openTrends = () => navigate(ROUTE_PATH.LISTENING_REPORT);
    return (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.top}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("home.favoriteSheet")}
                    accessibilityHint={t("home.songCount", { count })}
                    accessibilityState={{ disabled: !sheetId }}
                    disabled={!sheetId}
                    onPress={() => {
                        if (sheetId) navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, { id: sheetId });
                    }}
                    style={({ pressed }) => [styles.favorite, { opacity: pressed ? 0.7 : 1 }]}>
                    {cover ? <FastImage source={cover} placeholderSource={ImgAsset.albumDefault} style={styles.cover} /> : (
                        <View style={[styles.cover, styles.placeholder, { backgroundColor: colors.tonalSurface }]}>
                            <Icon name="heart" size={rpx(40)} color={colors.favorite} />
                        </View>
                    )}
                    <View style={styles.favoriteText}>
                        <View style={styles.favoriteHeading}>
                            <Icon name="heart" size={rpx(18)} color={colors.favorite} />
                            <ThemeText fontSize="title" fontWeight="semibold" style={styles.favoriteTitle}>{t("home.favoriteSheet")}</ThemeText>
                        </View>
                        <ThemeText fontSize="description" color={colors.primaryText} style={styles.count}>{t("home.songCount", { count })}</ThemeText>
                    </View>
                    <Icon name="chevron-right" size={rpx(20)} color={colors.textSecondary} />
                </Pressable>
                <View style={[styles.today, { backgroundColor: colors.surface }]}>
                    <ThemeText fontSize="caption" fontColor="textSecondary">{t("listening.today")}</ThemeText>
                    <ThemeText accessible accessibilityLabel={todayTime} style={styles.todayValue}>
                        {todayTime.split(/(\d+)/).map((part, index) => (
                            <ThemeText key={index} fontColor={/^\d+$/.test(part) ? "text" : "textSecondary"} fontWeight={/^\d+$/.test(part) ? "semibold" : "regular"} style={/^\d+$/.test(part) ? styles.todayNumber : styles.todayUnit}>{part}</ThemeText>
                        ))}
                    </ThemeText>
                    <ThemeText fontSize="caption" fontColor="textSecondary">{t("listening.playCount", { count: today.plays })}</ThemeText>
                </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <Pressable accessibilityRole="button" accessibilityLabel={t("listening.openReport")} accessibilityHint={activityHint} onPress={openTrends}
                style={({ pressed }) => [styles.activity, { opacity: pressed ? 0.7 : 1 }]}>
                <View style={styles.activityText}>
                    <ThemeText fontSize="description" fontWeight="semibold">{t("listening.activity")}</ThemeText>
                    <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.activityHint}>
                        {activityHint}
                    </ThemeText>
                    <View style={styles.reportLink}>
                        <ThemeText fontSize="caption" color={colors.primaryText}>{t("listening.viewTrends")}</ThemeText>
                        <Icon name="chevron-right" size={rpx(18)} color={colors.primaryText} />
                    </View>
                </View>
                <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><ActivityGrid days={days} startedAt={data.startedAt} compact /></View>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { width: "100%", borderRadius: radius.xl, padding: Math.max(14, spacing.xl) },
    top: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md },
    favorite: { flex: 1, minWidth: rpx(300), minHeight: minimumTouch, flexDirection: "row", alignItems: "center", gap: spacing.md },
    cover: { width: Math.max(60, rpx(112)), height: Math.max(60, rpx(112)), borderRadius: radius.md },
    placeholder: { alignItems: "center", justifyContent: "center" },
    favoriteText: { flex: 1, minWidth: 0 },
    favoriteHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xxs },
    favoriteTitle: { fontSize: Math.max(20, fontRpx(38)) },
    count: { marginTop: spacing.xs },
    today: { minWidth: rpx(144), paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, borderTopLeftRadius: radius.xs, borderBottomRightRadius: radius.xs, justifyContent: "center" },
    todayValue: { marginVertical: spacing.xxs },
    todayNumber: { fontSize: Math.max(22, fontRpx(42)) },
    todayUnit: { fontSize: Math.max(12, fontRpx(22)) },
    divider: { height: StyleSheet.hairlineWidth, marginVertical: Math.max(12, spacing.xl) },
    activity: { minHeight: minimumTouch, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
    activityText: { flex: 1, minWidth: rpx(240) },
    activityHint: { marginTop: spacing.xs },
    reportLink: { flexDirection: "row", alignItems: "center", gap: spacing.xxs, marginTop: spacing.xs },
});
