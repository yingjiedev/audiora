import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import { controlSize, radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import type { Plugin } from "@/core/pluginManager";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import React from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import useShiYin from "./homeBody/useShiYin";

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
            style={[styles.card, { backgroundColor: colors.featuredWindowSurface }]}>
            <View style={styles.artworkStage}>
                <Image accessible={false} source={ImgAsset.homeDiscoveryWindow} resizeMode="cover" resizeMethod="resize" style={styles.artwork} />
            </View>
            <View style={styles.footer}>
                <View style={styles.copy}>
                    <ThemeText numberOfLines={1} fontSize="title" fontWeight="semibold" color={colors.onFeaturedWindow}>{t("home.shiyin")}</ThemeText>
                    <ThemeText numberOfLines={2} fontSize="tag" color={colors.onFeaturedWindowSecondary} style={styles.description}>{t("home.shiyinSubtitle")}</ThemeText>
                </View>
                <View style={[styles.playFill, { backgroundColor: colors.featuredActionSurface }]}>
                    {loading ? <ActivityIndicator size="small" color={colors.onFeaturedAction} /> : <Icon name="play" size={rpx(26)} color={colors.onFeaturedAction} />}
                </View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: { flex: 1, minHeight: rpx(344), borderRadius: radius.xl, overflow: "hidden" },
    artworkStage: { height: rpx(192), width: "100%", overflow: "hidden" },
    artwork: { width: "100%", height: "100%" },
    copy: { flex: 1, minWidth: 0 },
    description: { marginTop: spacing.xs },
    footer: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: Math.max(44, controlSize.minimumTouch, rpx(152)), padding: spacing.lg },
    playFill: { width: rpx(72), height: rpx(72), borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
