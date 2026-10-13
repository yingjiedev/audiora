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
import { Pressable, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
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
    const leafWidth = Math.min(rpx(184), cardWidth * 0.30);
    const companionWidth = Math.min(360, width * 0.62);
    const offset = useSharedValue(0);
    const [cardHeight, setCardHeight] = React.useState(rpx(300));
    const onSpreadLayout = React.useCallback((event: LayoutChangeEvent) => {
        const height = event.nativeEvent.layout.height;
        if (Number.isFinite(height) && height > 0) setCardHeight(height);
    }, []);
    const onScroll = useAnimatedScrollHandler(event => {
        offset.value = event.contentOffset.x;
    });
    const foldStyle = useAnimatedStyle((): ViewStyle => ({
        // Clear the final hidden sliver so it cannot show through the rounded front corners.
        opacity: reduceMotion ? 1 : interpolate(offset.value, [leafWidth * 0.94, leafWidth], [1, 0], Extrapolation.CLAMP),
        // The native center is the hinge. No translated perspective matrix is decomposed
        // into Android scale/translation, which used to detach the leaf from the card.
        transform: reduceMotion ? [] : [
            { perspective: leafWidth * 2.5 },
            { rotateY: `${interpolate(offset.value, [0, leafWidth], [0, -180], Extrapolation.CLAMP)}deg` },
        ],
    }), [reduceMotion, leafWidth]);
    const heroFoldStyle = useAnimatedStyle(() => ({
        borderTopLeftRadius: reduceMotion ? radius.lg : interpolate(offset.value, [leafWidth / 2, leafWidth], [0, radius.lg], Extrapolation.CLAMP),
        borderBottomLeftRadius: reduceMotion ? radius.lg : interpolate(offset.value, [leafWidth / 2, leafWidth], [0, radius.lg], Extrapolation.CLAMP),
    }), [reduceMotion, leafWidth]);
    // Android backfaceVisibility checks the child's local rotation, not its rotating parent.
    // Fade only its print at the edge, preserving the solid paper as it turns behind.
    const frontFaceStyle = useAnimatedStyle(() => ({
        opacity: reduceMotion ? 1 : interpolate(offset.value, [leafWidth * 0.45, leafWidth / 2], [1, 0], Extrapolation.CLAMP),
    }), [reduceMotion, leafWidth]);

    return (
        <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.deck, { paddingBottom: Math.max(spacing.sm, cardHeight * 0.12), paddingRight: Math.max(spacing.xxxl, width - spacing.xxxl - companionWidth) }]}
            snapToOffsets={reduceMotion ? [0, cardWidth + spacing.md] : [0, leafWidth, cardWidth + spacing.md]}
            decelerationRate="fast"
            removeClippedSubviews={false}
            directionalLockEnabled
            nestedScrollEnabled
            overScrollMode="never"
            onScroll={onScroll}
            scrollEventThrottle={16}>
            <View testID="home-feature-spread" onLayout={onSpreadLayout} style={[styles.spread, { width: cardWidth }]}>
                <View collapsable={false} style={[styles.leafSlot, { width: leafWidth }]}>
                    <Animated.View testID="home-feature-fold" pointerEvents="box-none" collapsable={false} renderToHardwareTextureAndroid={!reduceMotion} style={[styles.foldCarrier, { width: leafWidth * 2, height: cardHeight * 2.8 }, foldStyle]}>
                        <Animated.View testID="home-feature-fold-paper" collapsable={false} style={[styles.leaf, { width: leafWidth, height: cardHeight, backgroundColor: colors.featuredFoldSurface }]}>
                            <Animated.View testID="home-feature-fold-face" collapsable={false} style={[styles.leafFace, frontFaceStyle]}>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`${t("home.favoriteSheet")} · ${t("home.songCount", { count: props.favoriteCount })}`}
                                    style={[styles.collection, { backgroundColor: colors.featuredFoldSurface, borderColor: colors.divider }]}
                                    onPress={() => navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, { id: props.favoriteSheet.id })}>
                                    <ThemeText fontSize="tag" color={colors.onFeaturedSecondary}>{t("home.myCollection")}</ThemeText>
                                    <View style={styles.collectionCount}>
                                        {props.favoriteArtwork ? <FastImage source={props.favoriteArtwork} placeholderSource={ImgAsset.albumDefault} style={styles.collectionCover} />
                                            : <Icon name="musical-note" size={rpx(40)} color={colors.onFeatured} />}
                                        <ThemeText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} color={colors.onFeatured} fontWeight="semibold" style={styles.count}>{props.favoriteCount}</ThemeText>
                                        <ThemeText fontSize="tag" color={colors.onFeaturedSecondary}>{t("home.savedSongs")}</ThemeText>
                                    </View>
                                    <Icon name="chevron-right" size={rpx(22)} color={colors.onFeaturedSecondary} />
                                </Pressable>
                            </Animated.View>
                        </Animated.View>
                    </Animated.View>
                </View>
                <Animated.View testID="home-feature-front" collapsable={false} style={[styles.hero, heroFoldStyle]}>
                    <HomeHero music={props.music} joined />
                </Animated.View>
            </View>
            <View style={[styles.companion, { width: companionWidth }]}>
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
    // The free edge descends below the card while turning, then disappears at 180°.
    deck: { paddingHorizontal: spacing.xxxl, paddingTop: spacing.sm, gap: spacing.md, alignItems: "stretch" },
    spread: { flexDirection: "row", minHeight: rpx(300) },
    leafSlot: { zIndex: 0, overflow: "visible" },
    // Left half contains the paper; empty right half puts the native pivot on the seam.
    // The empty lower area puts the vanishing point at 1.4 × the actual card height.
    foldCarrier: { position: "absolute", left: 0, top: 0, overflow: "visible" },
    leaf: { borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg, overflow: "hidden" },
    leafFace: { flex: 1 },
    hero: { flex: 1, zIndex: 1, borderRadius: radius.lg, overflow: "hidden" },
    collection: { flex: 1, minHeight: Math.max(44, controlSize.minimumTouch), paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, justifyContent: "space-between", alignItems: "flex-start", borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg, borderRightWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
    collectionCount: { gap: spacing.xs, alignItems: "flex-start", width: "100%" },
    collectionCover: { width: rpx(68), height: rpx(68), borderRadius: radius.xs },
    count: { fontSize: fontRpx(40), width: "100%" },
    companion: { minHeight: rpx(300) },
});
