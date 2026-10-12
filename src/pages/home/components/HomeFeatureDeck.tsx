import Icon from "@/components/base/icon";
import FastImage from "@/components/base/fastImage";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import { controlSize, radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import type { Plugin } from "@/core/pluginManager";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import useMotion from "@/hooks/useMotion";
import rpx, { fontRpx } from "@/utils/rpx";
import React from "react";
import { Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import HomeHero from "./HomeHero";
import ShiYinCard from "./ShiYinCard";

interface HomeFeatureDeckProps {
    music?: IMusic.IMusicItem | null;
    favoriteSheet: IMusic.IMusicSheetItemBase;
    favoriteCount: number;
    favoriteArtwork?: IMusic.IMusicItem["artwork"];
    topListPlugins: Plugin[];
    topListCache: Record<string, IMusic.IMusicSheetGroupItem[]>;
    recentHistory: IMusic.IMusicItem[];
    tasteArtists: string[];
}

/** A real collection entry forms the hinged left leaf of the listening card. */
export default function HomeFeatureDeck(props: HomeFeatureDeckProps) {
    const { width } = useWindowDimensions();
    const colors = useColors();
    const { t } = useI18N();
    const navigate = useNavigate();
    const { reduceMotion } = useMotion();
    const cardWidth = Math.min(420, width - spacing.xxxl * 2, width * 0.76);
    const leafWidth = Math.min(rpx(132), cardWidth * 0.24);
    const offset = useSharedValue(0);
    const onScroll = useAnimatedScrollHandler(event => {
        offset.value = event.contentOffset.x;
    });
    const foldStyle = useAnimatedStyle((): ViewStyle => ({
        transform: reduceMotion ? [] : [
            { perspective: 600 },
            { rotateY: `${interpolate(offset.value, [0, cardWidth], [-18, -38], Extrapolation.CLAMP)}deg` },
        ],
    }), [reduceMotion, cardWidth]);

    return (
        <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.deck}
            snapToOffsets={[0, cardWidth + spacing.md]}
            decelerationRate="fast"
            onScroll={onScroll}
            scrollEventThrottle={16}>
            <View style={[styles.spread, { width: cardWidth }]}>
                <Animated.View style={[styles.leaf, { width: leafWidth, backgroundColor: colors.card, borderColor: colors.border }, foldStyle]}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${t("home.favoriteSheet")} · ${t("home.songCount", { count: props.favoriteCount })}`}
                        style={styles.collection}
                        onPress={() => navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, { id: props.favoriteSheet.id })}>
                        <ThemeText fontSize="tag" color={colors.onCardInsetSecondary}>{t("home.myCollection")}</ThemeText>
                        <View style={styles.collectionCount}>
                            {props.favoriteArtwork ? <FastImage source={props.favoriteArtwork} placeholderSource={ImgAsset.albumDefault} style={styles.collectionCover} />
                                : <Icon name="musical-note" size={rpx(40)} color={colors.onCardInset} />}
                            <ThemeText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} color={colors.onCardInset} fontWeight="semibold" style={styles.count}>{props.favoriteCount}</ThemeText>
                            <ThemeText fontSize="tag" color={colors.onCardInsetSecondary}>{t("home.savedSongs")}</ThemeText>
                        </View>
                        <Icon name="chevron-right" size={rpx(22)} color={colors.onCardInsetSecondary} />
                    </Pressable>
                </Animated.View>
                <HomeHero music={props.music} />
            </View>
            <View style={[styles.companion, { width: Math.min(360, width * 0.62) }]}>
                <ShiYinCard
                    topListPlugins={props.topListPlugins}
                    topListCache={props.topListCache}
                    excludeMusicItems={props.recentHistory}
                    preferredArtists={props.tasteArtists}
                />
            </View>
        </Animated.ScrollView>
    );
}

const styles = StyleSheet.create({
    deck: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.sm, gap: spacing.md, alignItems: "stretch" },
    spread: { flexDirection: "row", minHeight: rpx(300) },
    leaf: { borderRadius: radius.lg, borderRightWidth: StyleSheet.hairlineWidth, transformOrigin: "right center" },
    collection: { flex: 1, minHeight: Math.max(44, controlSize.minimumTouch), paddingHorizontal: spacing.sm, paddingVertical: spacing.lg, justifyContent: "space-between", alignItems: "flex-start" },
    collectionCount: { gap: spacing.xs, alignItems: "flex-start", width: "100%" },
    collectionCover: { width: rpx(68), height: rpx(68), borderRadius: radius.xs },
    count: { fontSize: fontRpx(40), width: "100%" },
    companion: { minHeight: rpx(300) },
});
