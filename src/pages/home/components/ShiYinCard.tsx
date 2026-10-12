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
            <View style={styles.artworkStage}>
                <HomeCardMotif />
                <ThemeText fontSize="tag" color={colors.onFeaturedCompanionSecondary}>{t("home.topList")}</ThemeText>
                <View style={[styles.symbol, { backgroundColor: colors.featuredSurface }]}>
                    <Icon name="shuffle" size={rpx(36)} color={colors.onFeatured} />
                </View>
            </View>
            <View style={styles.footer}>
                <View style={styles.copy}>
                    <ThemeText numberOfLines={1} fontSize="subTitle" fontWeight="semibold" color={colors.onFeaturedCompanion}>{t("home.shiyin")}</ThemeText>
                    <ThemeText numberOfLines={2} fontSize="tag" color={colors.onFeaturedCompanionSecondary} style={styles.description}>{t("home.shiyinSubtitle")}</ThemeText>
                </View>
                <View style={[styles.playFill, { backgroundColor: colors.inverseSurface }]}>
                    {loading ? <ActivityIndicator size="small" color={colors.onInverse} /> : <Icon name="play" size={rpx(26)} color={colors.onInverse} />}
                </View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: { flex: 1, minHeight: Math.max(44, controlSize.minimumTouch), padding: spacing.lg, borderRadius: radius.lg, justifyContent: "space-between", gap: spacing.md },
    artworkStage: { height: rpx(164), width: "100%" },
    symbol: { position: "absolute", right: 0, bottom: spacing.sm, width: rpx(88), height: rpx(88), borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
    copy: { flex: 1, minWidth: 0 },
    description: { marginTop: spacing.xs },
    footer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: Math.max(44, controlSize.minimumTouch) },
    playFill: { width: rpx(56), height: rpx(56), borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
