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
import { calendarDays, summarizeListening } from "@/core/listeningStatsModel";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx, { fontRpx } from "@/utils/rpx";

const minimumTouch = Math.max(44, controlSize.minimumTouch);

export default function MyListeningCard({ sheetId, count, cover }: { sheetId?: string; count: number; cover?: string }) {
    const colors = useColors();
    const { t } = useI18N();
    const navigate = useNavigate();
    const data = useListeningStats();
    const days = calendarDays(data, 56);
    const today = days[days.length - 1];
    const summary = summarizeListening(days);
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
                        <View style={styles.eyebrow}>
                            <Icon name="heart" size={rpx(18)} color={colors.favorite} />
                            <ThemeText fontSize="caption" fontColor="textSecondary">{t("listening.collection")}</ThemeText>
                        </View>
                        <ThemeText fontSize="title" fontWeight="semibold" style={styles.favoriteTitle}>{t("home.favoriteSheet")}</ThemeText>
                        <View style={styles.countRow}>
                            <ThemeText fontSize="description" color={colors.primaryText}>{t("home.songCount", { count })}</ThemeText>
                            <Icon name="chevron-right" size={rpx(20)} color={colors.textSecondary} />
                        </View>
                    </View>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={t("listening.todayEntry")} onPress={openTrends}
                    style={({ pressed }) => [styles.today, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}>
                    <ThemeText fontSize="caption" fontColor="textSecondary">{t("listening.today")}</ThemeText>
                    <ThemeText fontSize="title" fontWeight="semibold" style={styles.todayValue}>{listeningTimeLabel(today.seconds, t.bind(null))}</ThemeText>
                    <ThemeText fontSize="caption" fontColor="textSecondary">{t("listening.playCount", { count: today.plays })}</ThemeText>
                </Pressable>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <Pressable accessibilityRole="button" accessibilityLabel={t("listening.openReport")} onPress={openTrends}
                style={({ pressed }) => [styles.activity, { opacity: pressed ? 0.7 : 1 }]}>
                <View style={styles.activityText}>
                    <ThemeText fontSize="subTitle" fontWeight="medium">{t("listening.activity")}</ThemeText>
                    <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.activityHint}>
                        {summary.activeDays ? t("listening.recentActive", { count: summary.activeDays }) : t("listening.startHint")}
                    </ThemeText>
                    <View style={styles.reportLink}>
                        <ThemeText fontSize="tag" color={colors.primaryText}>{t("listening.viewTrends")}</ThemeText>
                        <Icon name="chevron-right" size={rpx(18)} color={colors.primaryText} />
                    </View>
                </View>
                <ActivityGrid days={days} compact />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { width: "100%", borderRadius: radius.xl, padding: spacing.lg },
    top: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md },
    favorite: { flex: 1, minWidth: rpx(340), minHeight: minimumTouch, flexDirection: "row", alignItems: "center", gap: spacing.md },
    cover: { width: rpx(112), height: rpx(112), borderRadius: radius.md },
    placeholder: { alignItems: "center", justifyContent: "center" },
    favoriteText: { flex: 1, minWidth: 0 },
    eyebrow: { flexDirection: "row", alignItems: "center", gap: spacing.xxs, marginBottom: spacing.xxs },
    favoriteTitle: { fontSize: fontRpx(30) },
    countRow: { flexDirection: "row", alignItems: "center", gap: spacing.xxs, marginTop: spacing.xs },
    today: { minWidth: rpx(150), minHeight: minimumTouch, padding: spacing.md, borderRadius: radius.md, justifyContent: "center" },
    todayValue: { marginVertical: spacing.xxs, fontSize: fontRpx(32) },
    divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.lg },
    activity: { minHeight: minimumTouch, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    activityText: { flex: 1, minWidth: rpx(260) },
    activityHint: { marginTop: spacing.xs },
    reportLink: { minHeight: rpx(36), flexDirection: "row", alignItems: "center", gap: spacing.xxs, marginTop: spacing.xs },
});
