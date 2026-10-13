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
import LinearGradient from "react-native-linear-gradient";
import HomeHero from "./HomeHero";
import ShiYinCard from "./ShiYinCard";
import { homeFoldProgress, pickHomeFeatureAppearance } from "./homeFeatureAppearance";
import { homeFeatureLayout } from "./homeFeatureLayout";

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
    const leafWidth = Math.min(rpx(112), cardWidth * 0.23);
    const companionWidth = Math.min(360, width * 0.62);
    const offset = useSharedValue(0);
    const [appearance] = React.useState(pickHomeFeatureAppearance);
    const record = appearance === "record";
    const layout = homeFeatureLayout[appearance];
    const foldSurface = record ? colors.featuredRecordFoldSurface : colors.featuredWindowFoldSurface;
    const foldForeground = record ? colors.onFeaturedRecord : colors.onFeaturedWindow;
    const foldSecondary = record ? colors.onFeaturedRecordSecondary : colors.onFeaturedWindowSecondary;
    const lastSnap = Math.max(0, spacing.xxxl * 2 + cardWidth + spacing.md + companionWidth - width);
    const [cardHeight, setCardHeight] = React.useState(layout.minimumHeight);
    const onSpreadLayout = React.useCallback((event: LayoutChangeEvent) => {
        const height = event.nativeEvent.layout.height;
        if (Number.isFinite(height) && height > 0) setCardHeight(height);
    }, []);
    const onScroll = useAnimatedScrollHandler(event => {
        offset.value = event.contentOffset.x;
    });
    const foldStyle = useAnimatedStyle((): ViewStyle => ({
        // Clear the final hidden sliver so it cannot show through the rounded front corners.
        opacity: reduceMotion ? 1 : interpolate(homeFoldProgress(offset.value, leafWidth), [155 / 180, 1], [1, 0], Extrapolation.CLAMP),
        // The native center is the hinge. No translated perspective matrix is decomposed
        // into Android scale/translation, which used to detach the leaf from the card.
        transform: reduceMotion ? [] : [
            { perspective: leafWidth * 2.5 },
            { rotateY: `${-180 * homeFoldProgress(offset.value, leafWidth)}deg` },
        ],
    }), [reduceMotion, leafWidth]);
    const heroFoldStyle = useAnimatedStyle(() => ({
        borderTopLeftRadius: reduceMotion ? radius.xl : interpolate(homeFoldProgress(offset.value, leafWidth), [0.5, 1], [0, radius.xl], Extrapolation.CLAMP),
        borderBottomLeftRadius: reduceMotion ? radius.xl : interpolate(homeFoldProgress(offset.value, leafWidth), [0.5, 1], [0, radius.xl], Extrapolation.CLAMP),
    }), [reduceMotion, leafWidth]);
    // Android backfaceVisibility checks the child's local rotation, not its rotating parent.
    // Fade only its print at the edge, preserving the solid paper as it turns behind.
    const frontFaceStyle = useAnimatedStyle(() => ({
        opacity: reduceMotion ? 1 : interpolate(homeFoldProgress(offset.value, leafWidth), [75 / 180, 0.5], [1, 0], Extrapolation.CLAMP),
    }), [reduceMotion, leafWidth]);

    return (
        <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.deck, { paddingBottom: Math.max(spacing.sm, cardHeight * 0.065) }]}
            snapToOffsets={reduceMotion ? [0, lastSnap] : [...new Set([0, Math.min(leafWidth, lastSnap), lastSnap])].sort((a, b) => a - b)}
            decelerationRate="fast"
            removeClippedSubviews={false}
            directionalLockEnabled
            nestedScrollEnabled
            overScrollMode="never"
            onScroll={onScroll}
            scrollEventThrottle={16}>
            <View testID="home-feature-spread" onLayout={onSpreadLayout} style={[styles.spread, { width: cardWidth, minHeight: layout.minimumHeight }]}>
                <View collapsable={false} style={[styles.leafSlot, { width: leafWidth }]}>
                    <Animated.View testID="home-feature-fold" pointerEvents="box-none" collapsable={false} renderToHardwareTextureAndroid={!reduceMotion} style={[styles.foldCarrier, { width: leafWidth * 2, height: cardHeight * 2.4 }, foldStyle]}>
                        <Animated.View testID="home-feature-fold-paper" collapsable={false} style={[styles.leaf, { width: leafWidth, height: cardHeight, backgroundColor: foldSurface }]}>
                            {record && <LinearGradient testID="home-record-fold-lighting" pointerEvents="none" colors={colors.featuredRecordFoldGradient} locations={[0, 0.52, 1]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />}
                            <Animated.View testID="home-feature-fold-face" collapsable={false} style={[styles.leafFace, frontFaceStyle]}>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`${t("home.favoriteSheet")} · ${t("home.songCount", { count: props.favoriteCount })}`}
                                    style={[styles.collection, { backgroundColor: record ? undefined : foldSurface, borderColor: colors.divider, borderRightWidth: record ? 0 : StyleSheet.hairlineWidth }]}
                                    onPress={() => navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, { id: props.favoriteSheet.id })}>
                                    <ThemeText numberOfLines={2} fontSize="tag" color={foldSecondary}>{t("home.myCollection")}</ThemeText>
                                    <View style={styles.collectionCount}>
                                        {props.favoriteArtwork ? <FastImage source={props.favoriteArtwork} placeholderSource={ImgAsset.albumDefault} style={styles.collectionCover} />
                                            : <Icon name="musical-note" size={rpx(40)} color={foldForeground} />}
                                        <ThemeText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} color={foldForeground} fontWeight="semibold" style={styles.count}>{t("home.songCount", { count: props.favoriteCount })}</ThemeText>
                                    </View>
                                    <Icon name="chevron-right" size={rpx(22)} color={foldSecondary} />
                                </Pressable>
                            </Animated.View>
                            {record && <LinearGradient testID="home-record-spine" pointerEvents="none" colors={colors.featuredRecordSpineGradient} locations={[0, 0.45, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.spine} />}
                        </Animated.View>
                    </Animated.View>
                </View>
                <Animated.View testID="home-feature-front" collapsable={false} style={[styles.hero, heroFoldStyle]}>
                    <HomeHero music={props.music} joined appearance={appearance} />
                </Animated.View>
            </View>
            <View style={{ width: companionWidth, minHeight: layout.minimumHeight }}>
                <ShiYinCard
                    appearance={appearance}
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
    spread: { flexDirection: "row" },
    leafSlot: { zIndex: 0, overflow: "visible" },
    // Left half contains the paper; empty right half puts the native pivot on the seam.
    // The empty lower area puts the vanishing point below the actual card, with a small free-edge drop.
    foldCarrier: { position: "absolute", left: 0, top: 0, overflow: "visible" },
    leaf: { borderTopLeftRadius: radius.xl, borderBottomLeftRadius: radius.xl, overflow: "hidden" },
    leafFace: { flex: 1 },
    hero: { flex: 1, zIndex: 1, borderRadius: radius.xl, overflow: "hidden" },
    collection: { flex: 1, minHeight: Math.max(44, controlSize.minimumTouch), paddingHorizontal: spacing.sm, paddingVertical: spacing.lg, justifyContent: "space-between", alignItems: "flex-start", borderTopLeftRadius: radius.xl, borderBottomLeftRadius: radius.xl, borderRightWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
    collectionCount: { gap: spacing.xs, alignItems: "flex-start", width: "100%" },
    collectionCover: { width: rpx(68), height: rpx(68), borderRadius: radius.xs },
    spine: { position: "absolute", width: rpx(12), right: 0, top: 0, bottom: 0 },
    count: { fontSize: fontRpx(24), width: "100%" },
});
