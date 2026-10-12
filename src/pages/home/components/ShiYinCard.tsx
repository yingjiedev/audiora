import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { controlSize, radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import type { Plugin } from "@/core/pluginManager";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import useShiYin from "./homeBody/useShiYin";
import HomeCardMotif from "./HomeCardMotif";

/** A companion to the listening card. The whole card starts the existing real chart queue. */
export default function ShiYinCard(props: {
    topListPlugins: Plugin[];
    topListCache?: Record<string, IMusic.IMusicSheetGroupItem[]>;
    excludeMusicItems?: IMusic.IMusicItem[];
    preferredArtists?: string[];
}) {
    const { loading, start } = useShiYin(props);
    const colors = useColors();
    const { t } = useI18N();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("home.shiyin")}
            accessibilityState={{ disabled: loading, busy: loading }}
            disabled={loading}
            onPress={() => start()}
            style={[styles.card, { backgroundColor: colors.featuredCompanionSurface }]}>
            <View style={styles.heading}>
                <ThemeText fontSize="title" fontWeight="semibold" color={colors.onFeaturedCompanion} style={styles.title}>{t("home.shiyin")}</ThemeText>
                <View style={[styles.symbol, { backgroundColor: colors.featuredSurface }]}>
                    <Icon name="shuffle" size={rpx(36)} color={colors.onFeatured} />
                </View>
            </View>
            <HomeCardMotif />
            <ThemeText fontSize="description" color={colors.onFeaturedCompanionSecondary} style={styles.description}>{t("home.shiyinSubtitle")}</ThemeText>
            <View style={styles.footer}>
                <ThemeText fontSize="tag" color={colors.onFeaturedCompanionSecondary} style={styles.title}>{t("home.topList")}</ThemeText>
                <View style={[styles.playFill, { backgroundColor: colors.inverseSurface }]}>
                    {loading ? <ActivityIndicator size="small" color={colors.onInverse} /> : <Icon name="play" size={rpx(26)} color={colors.onInverse} />}
                </View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: { flex: 1, minHeight: Math.max(44, controlSize.minimumTouch), padding: spacing.lg, borderRadius: radius.lg },
    heading: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
    symbol: { width: rpx(64), height: rpx(64), borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
    title: { flex: 1, minWidth: 0 },
    description: { flex: 1, marginTop: spacing.sm },
    footer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: Math.max(44, controlSize.minimumTouch), marginTop: spacing.sm },
    playFill: { width: rpx(56), height: rpx(56), borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
