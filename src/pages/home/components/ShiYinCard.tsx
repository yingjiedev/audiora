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
import type { HomeFeatureAppearance } from "./homeFeatureAppearance";
import { homeFeatureLayout, homeRecordShadow } from "./homeFeatureLayout";

/** A companion to the listening card. The whole card starts the existing real chart queue. */
export default function ShiYinCard(props: {
    topListPlugins: Plugin[];
    topListCache?: Record<string, IMusic.IMusicSheetGroupItem[]>;
    excludeMusicItems?: IMusic.IMusicItem[];
    preferredArtists?: string[];
    appearance?: HomeFeatureAppearance;
}) {
    const { loading, start } = useShiYin(props);
    const colors = useColors();
    const { t } = useI18N();
    const artwork = props.appearance === "record" ? ImgAsset.homeDiscoveryNight : ImgAsset.homeDiscoveryWindow;
    const layout = homeFeatureLayout[props.appearance ?? "window"];
    const shadow = props.appearance === "record" ? homeRecordShadow(colors.featuredRecordHalo, colors.featuredRecordShadow) : undefined;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("home.shiyin")}
            accessibilityState={{ disabled: loading, busy: loading }}
            disabled={loading}
            onPress={() => start()}
            style={[styles.card, { minHeight: layout.minimumHeight, backgroundColor: colors.featuredWindowSurface, boxShadow: shadow }]}>
            <View testID="home-discovery-clip" style={styles.cardClip}>
                <View style={[styles.artworkStage, { height: layout.artworkHeight }]}>
                    <Image accessible={false} source={artwork} resizeMode="cover" resizeMethod="resize" style={styles.artwork} />
                </View>
                <View style={[styles.footer, { minHeight: Math.max(44, controlSize.minimumTouch, layout.footerHeight) }]}>
                    <View style={styles.copy}>
                        <ThemeText numberOfLines={1} fontSize="title" fontWeight="semibold" color={colors.onFeaturedWindow}>{t("home.shiyin")}</ThemeText>
                        <ThemeText numberOfLines={2} fontSize="tag" color={colors.onFeaturedWindowSecondary} style={styles.description}>{t("home.shiyinSubtitle")}</ThemeText>
                    </View>
                    <View style={[styles.playFill, { backgroundColor: colors.featuredActionSurface }]}>
                        {loading ? <ActivityIndicator size="small" color={colors.onFeaturedAction} /> : <Icon name="play" size={rpx(26)} color={colors.onFeaturedAction} />}
                    </View>
                </View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: { flex: 1, borderRadius: radius.xl, overflow: "visible" },
    cardClip: { flex: 1, borderRadius: radius.xl, overflow: "hidden" },
    artworkStage: { width: "100%", overflow: "hidden" },
    artwork: { width: "100%", height: "100%" },
    copy: { flex: 1, minWidth: 0 },
    description: { marginTop: spacing.xs },
    footer: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg },
    playFill: { width: rpx(72), height: rpx(72), borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
