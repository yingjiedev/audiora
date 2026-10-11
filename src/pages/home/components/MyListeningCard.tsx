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
const cardPadding = Math.max(14, spacing.xl);

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
    const todayPlays = t("listening.todayPlays", { count: today.plays });
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
                        <View style={styles.count}>
                            <ThemeText fontSize="description" color={colors.primaryText}>{t("home.songCount", { count })}</ThemeText>
                            <Icon name="chevron-right" size={rpx(18)} color={colors.textSecondary} />
                        </View>
                    </View>
                </Pressable>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("listening.todayEntry")}
                    accessibilityHint={`${todayTime} · ${t("listening.playCount", { count: today.plays })}`}
                    onPress={openTrends}
                    style={({ pressed }) => [styles.today, { opacity: pressed ? 0.7 : 1 }]}>
                    <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, styles.todaySurface, { backgroundColor: colors.cardInset }]} />
                    <View style={styles.todayValueRow}>
                        <ThemeText accessible accessibilityLabel={todayTime} style={styles.todayValue}>
                            {todayTime.split(/(\d+)/).map((part, index) => (
                                <ThemeText key={index} color={/^\d+$/.test(part) ? colors.onCardInset : colors.onCardInsetSecondary} fontWeight={/^\d+$/.test(part) ? "medium" : "regular"} style={/^\d+$/.test(part) ? styles.todayNumber : styles.todayUnit}>{part}</ThemeText>
                            ))}
                        </ThemeText>
                        <View style={[styles.todayBadge, { backgroundColor: colors.tonalSurface }]}>
                            <Icon name="musical-note" size={Math.max(12, rpx(18))} color={colors.onTonal} />
                        </View>
                    </View>
                    <View style={styles.todayLink}>
                        <ThemeText fontSize="caption" color={colors.onCardInsetSecondary} style={styles.todayCaption}>{t("listening.today")}</ThemeText>
                        <Icon name="chevron-right" size={rpx(16)} color={colors.onCardInsetSecondary} />
                    </View>
                </Pressable>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <Pressable accessibilityRole="button" accessibilityLabel={t("listening.openReport")} accessibilityHint={`${activityHint} · ${todayPlays}`} onPress={openTrends}
                style={({ pressed }) => [styles.activity, { opacity: pressed ? 0.7 : 1 }]}>
                <View style={styles.activityText}>
                    <View style={styles.activityHeading}>
                        <ThemeText fontSize="description" fontWeight="medium" style={styles.activityTitle}>{t("listening.activity")}</ThemeText>
                        <Icon name="chevron-right" size={rpx(18)} color={colors.textSecondary} />
                    </View>
                    <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.activityHint}>
                        {activityHint}
                    </ThemeText>
                    <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.activityHint}>{todayPlays}</ThemeText>
                </View>
                <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><ActivityGrid days={days} startedAt={data.startedAt} compact /></View>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { width: "100%", borderRadius: radius.xl, overflow: "hidden" },
    top: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch" },
    favorite: { flex: 1, minWidth: rpx(300), minHeight: minimumTouch, paddingLeft: cardPadding, paddingRight: spacing.xs, paddingVertical: Math.max(12, spacing.lg), flexDirection: "row", alignItems: "center", gap: spacing.md },
    cover: { width: Math.max(52, rpx(96)), height: Math.max(52, rpx(96)), borderRadius: radius.md },
    placeholder: { alignItems: "center", justifyContent: "center" },
    favoriteText: { flex: 1, minWidth: 0 },
    favoriteHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xxs },
    favoriteTitle: { fontSize: Math.max(18, fontRpx(32)), flexShrink: 1 },
    count: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xxs, marginTop: spacing.xs },
    today: { width: rpx(240), maxWidth: "100%", flexShrink: 0, minHeight: minimumTouch, marginLeft: "auto", paddingHorizontal: cardPadding, paddingVertical: Math.max(12, spacing.lg), alignItems: "stretch", justifyContent: "center" },
    todaySurface: { borderBottomLeftRadius: radius.xl },
    todayValueRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.xs },
    todayValue: { flexShrink: 1 },
    todayBadge: { padding: spacing.xxs, borderRadius: radius.pill },
    todayLink: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xxs, marginTop: spacing.xs },
    todayCaption: { flexShrink: 1, fontSize: Math.max(11, fontRpx(20)) },
    todayNumber: { fontSize: Math.max(20, fontRpx(36)) },
    todayUnit: { fontSize: Math.max(12, fontRpx(22)) },
    divider: { height: StyleSheet.hairlineWidth, marginHorizontal: cardPadding },
    activity: { minHeight: minimumTouch, paddingHorizontal: cardPadding, paddingVertical: Math.max(12, spacing.lg), flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    activityText: { flex: 1, minWidth: rpx(220) },
    activityHeading: { flexDirection: "row", alignItems: "center", gap: spacing.xxs },
    activityTitle: { flexShrink: 1, fontSize: Math.max(14, fontRpx(26)) },
    activityHint: { marginTop: spacing.xxs, fontSize: Math.max(11, fontRpx(20)) },
});
