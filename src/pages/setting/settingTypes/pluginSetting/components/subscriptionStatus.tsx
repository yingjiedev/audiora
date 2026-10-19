import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import { radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import useMotion from "@/hooks/useMotion";
import rpx from "@/utils/rpx";
import { SubscriptionUpdate } from "../utils/subscriptionUpdateStore";

export default function SubscriptionStatus({ update }: { update?: SubscriptionUpdate }) {
    const colors = useColors();
    const { t } = useI18N();
    const { reduceMotion } = useMotion();
    if (!update) {
        return <ThemeText allowFontScaling fontSize="description" fontColor="textSecondary">{t("subscription.neverUpdated")}</ThemeText>;
    }
    const failures = update.results.filter(result => !result.success).length;
    const active = ["queued", "fetching", "updating"].includes(update.phase);
    const counts = {
        installed: update.results.filter(result => result.success && result.status === "installed").length,
        updated: update.results.filter(result => result.success && result.status !== "installed" && result.status !== "unchanged").length,
        unchanged: update.results.filter(result => result.success && result.status === "unchanged").length,
        failed: failures,
    };
    const labels = {
        queued: t("subscription.queued"),
        fetching: t("subscription.fetching"),
        updating: t("subscription.progress", { completed: update.results.length, total: update.total ?? 0 }),
        finished: t(failures ? "subscription.hasFailures" : "subscription.finished"),
        cancelled: t("subscription.cancelled"),
        timedOut: t("subscription.timedOut"),
    };
    const summary = (Object.keys(counts) as Array<keyof typeof counts>).filter(key => counts[key]).map(key => t(`subscription.${key}`, { count: counts[key] })).join(" · ");
    return (
        <View style={styles.wrapper}>
            <View style={styles.statusRow} accessibilityLiveRegion="polite">
                {active && update.phase !== "queued" && !reduceMotion ? <ActivityIndicator size="small" color={colors.primaryText} /> : null}
                <ThemeText allowFontScaling fontSize="description" style={styles.statusText}>{labels[update.phase]}</ThemeText>
            </View>
            {active && update.total !== undefined && update.total > 0 ? (
                <View accessibilityRole="progressbar" accessibilityLabel={labels.updating}
                    accessibilityValue={{ min: 0, max: update.total, now: update.results.length }}
                    style={[styles.track, { backgroundColor: colors.surface }]}>
                    <View style={[styles.fill, { backgroundColor: colors.active, width: `${Math.min(100, update.results.length / update.total * 100)}%` }]} />
                </View>
            ) : null}
            {summary ? <ThemeText allowFontScaling fontSize="description" fontColor="textSecondary">{summary}</ThemeText> : null}
            {!active && update.finishedAt ? <ThemeText allowFontScaling fontSize="description" fontColor="textSecondary">
                {t("subscription.lastChecked", { time: new Date(update.finishedAt).toLocaleString() })}
            </ThemeText> : null}
            {!active && (update.phase === "cancelled" || update.phase === "timedOut") ? <ThemeText allowFontScaling fontSize="description" fontColor="textSecondary">{t("subscription.keptChanges")}</ThemeText> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { gap: spacing.xs },
    statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    statusText: { flex: 1 },
    track: { height: rpx(6), borderRadius: radius.pill, overflow: "hidden" },
    fill: { height: "100%", borderRadius: radius.pill },
});
