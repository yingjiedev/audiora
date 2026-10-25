import useContentDimensions from "@/hooks/useContentDimensions";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import FastImage from "./fastImage";
import ThemeText from "./themeText";
import { ImgAsset } from "@/constants/assetsConst";
import { radius, spacing } from "@/constants/designSystem";
import useColors from "@/hooks/useColors";
import { useI18N } from "@/core/i18n";
import rpx from "@/utils/rpx";

export default function MediaDetailHeader({ title, artwork, typeLabel, source, subtitle, description, prominent = false }: {
    title: string;
    artwork?: string;
    typeLabel: string;
    source?: string | null;
    subtitle?: string;
    description?: string;
    prominent?: boolean;
}) {
    const colors = useColors();
    const { t } = useI18N();
    const { width, fontScale } = useContentDimensions();
    const [availableWidth, setAvailableWidth] = useState(width);
    const stacked = prominent || availableWidth < 300 || fontScale > 1.3;
    const [expanded, setExpanded] = useState(false);
    return (
        <View style={styles.wrapper}>
            <View onLayout={event => setAvailableWidth(event.nativeEvent.layout.width)} style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={[styles.top, stacked && styles.stacked]}>
                    <FastImage source={artwork} placeholderSource={ImgAsset.albumDefault} style={[styles.cover, stacked && styles.stackedCover, prominent && styles.prominentCover]} />
                    <View style={[styles.details, stacked && styles.stackedDetails]}>
                        <View style={styles.tags}>
                            {[typeLabel, source].filter(Boolean).map((label, index) => (
                                <View key={`${index}-${label}`} style={[styles.tag, { backgroundColor: colors.tonalSurface }]}>
                                    <ThemeText fontSize="caption" color={colors.onTonal} numberOfLines={2}>{label}</ThemeText>
                                </View>
                            ))}
                        </View>
                        <ThemeText fontSize="title" fontWeight="semibold" numberOfLines={3}>{title}</ThemeText>
                        {subtitle ? <ThemeText fontSize="description" fontColor="textSecondary">{subtitle}</ThemeText> : null}
                    </View>
                </View>
                {description ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={t(expanded ? "subpage.collapseDescription" : "subpage.expandDescription")} accessibilityState={{ expanded }}
                        onPress={() => setExpanded(value => !value)} style={[styles.description, { borderTopColor: colors.divider }]}>
                        <ThemeText fontSize="description" fontColor="textSecondary" numberOfLines={expanded ? undefined : 3}>{description}</ThemeText>
                        <ThemeText fontSize="caption" color={colors.primaryText} style={styles.descriptionAction}>{t(expanded ? "subpage.collapseDescription" : "subpage.expandDescription")}</ThemeText>
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { paddingHorizontal: spacing.xxxl, paddingTop: spacing.lg, paddingBottom: spacing.md },
    card: { padding: spacing.lg, borderRadius: radius.xl },
    top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.lg },
    stacked: { flexDirection: "column" },
    cover: { width: rpx(176), maxWidth: "36%", aspectRatio: 1, borderRadius: radius.lg },
    stackedCover: { maxWidth: "100%" },
    prominentCover: { width: "100%", maxWidth: 240, alignSelf: "center" },
    details: { flex: 1, minWidth: 0, gap: spacing.sm },
    stackedDetails: { flexGrow: 0, flexShrink: 0, flexBasis: "auto", width: "100%" },
    tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    tag: { maxWidth: "100%", borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
    description: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
    descriptionAction: { marginTop: spacing.sm },
});
