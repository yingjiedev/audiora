import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { blendOver, contrastRatio } from "@/utils/colorContrast";
import { resolveThemeColors } from "@/utils/themeColors";
import HomeFeatureDeck from "./HomeFeatureDeck";
import { spacing } from "@/constants/designSystem";

const mockNavigate = jest.fn();
let mockReduced = false;
let mockWidth = 375;
let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
const mockOffset = { value: 0 };
jest.mock("react-native", () => Object.defineProperties({}, {
    ...Object.getOwnPropertyDescriptors(jest.requireActual("react-native")),
    useWindowDimensions: { value: () => ({ width: mockWidth, height: 800 }) },
}));
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/fastImage", () => "FastImage");
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: 1 } }));
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("react-native-linear-gradient", () => "LinearGradient");
jest.mock("./HomeHero", () => "HomeHero");
jest.mock("./ShiYinCard", () => "ShiYinCard");
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("@/hooks/useMotion", () => () => ({ reduceMotion: mockReduced }));
jest.mock("@/core/router", () => ({ ROUTE_PATH: { LOCAL_SHEET_DETAIL: "favorite-detail" }, useNavigate: () => mockNavigate }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string, args?: { count: number }) => key === "home.songCount" ? `${args?.count} songs` : key }) }));
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value / 2, fontRpx: (value: number) => value / 2 }));
jest.mock("react-native-reanimated", () => ({
    __esModule: true,
    default: { View: "AnimatedView", ScrollView: "AnimatedScrollView" },
    Extrapolation: { CLAMP: "clamp" },
    interpolate: (value: number, inputs: number[], outputs: number[]) => outputs[0] + (outputs[1] - outputs[0]) * Math.max(0, Math.min(1, (value - inputs[0]) / (inputs[1] - inputs[0]))),
    useSharedValue: () => mockOffset,
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useAnimatedScrollHandler: (handler: unknown) => handler,
}));

const props = {
    music: { id: "current", platform: "demo", title: "Actual song", artist: "Actual artist", duration: 100, album: "Album", artwork: "cover" },
    favoriteSheet: { id: "actual-favorite-sheet", platform: "local" },
    favoriteCount: 5,
    favoriteArtwork: "actual-collection-artwork",
    topListPlugins: [], topListCache: {}, recentHistory: [], tasteArtists: ["Actual artist"],
};

describe("Home folded collection", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    beforeEach(() => {
        mockNavigate.mockClear(); mockReduced = false; mockWidth = 375; mockOffset.value = 0; mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
        jest.spyOn(Math, "random").mockReturnValue(0.25);
    });
    afterEach(() => {
        act(() => renderer?.unmount()); jest.restoreAllMocks();
    });
    const render = (count = 5) => act(() => {
        renderer = TestRenderer.create(<HomeFeatureDeck {...props} favoriteCount={count} />);
    });

    it.each([0, 5, 123])("opens the original collection with its actual %s count and keeps both music actions", count => {
        render(count);
        const collection = renderer.root.findByProps({ accessibilityLabel: `home.favoriteSheet · ${count} songs` });
        expect(StyleSheet.flatten(collection.props.style).minHeight).toBeGreaterThanOrEqual(44);
        act(() => collection.props.onPress());
        expect(mockNavigate).toHaveBeenCalledWith("favorite-detail", { id: props.favoriteSheet.id });
        expect(renderer.root.findByType("HomeHero" as any).props.music).toBe(props.music);
        expect(renderer.root.findByType("HomeHero" as any).props.joined).toBe(true);
        expect(renderer.root.findByType("FastImage" as any).props.source).toBe(props.favoriteArtwork);
        expect(renderer.root.findByType("ShiYinCard" as any).props.preferredArtists).toBe(props.tasteArtists);
    });

    it("clamps overscroll folds and removes perspective when reduced motion is enabled", () => {
        render();
        const leaf = () => renderer.root.findByProps({ testID: "home-feature-fold" });
        const fold = () => StyleSheet.flatten(leaf().props.style).transform;
        const leafWidth = StyleSheet.flatten(renderer.root.findByProps({ testID: "home-feature-fold-paper" }).props.style).width;
        expect(fold()).toEqual([{ perspective: leafWidth * 2.5 }, { rotateY: "0deg" }]);
        const deck = renderer.root.findByType("AnimatedScrollView" as any);
        act(() => deck.props.onScroll({ contentOffset: { x: 99999 } }));
        act(() => renderer.update(<HomeFeatureDeck {...props} />));
        expect(fold()[1]).toEqual({ rotateY: "-180deg" });
        act(() => deck.props.onScroll({ contentOffset: { x: -100 } }));
        act(() => renderer.update(<HomeFeatureDeck {...props} />));
        expect(fold()[1]).toEqual({ rotateY: "0deg" });
        mockReduced = true;
        act(() => renderer.update(<HomeFeatureDeck {...props} />));
        expect(fold()).toEqual([]);
        expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "home-feature-fold-face" }).props.style).opacity).toBe(1);
        expect(leaf().props.renderToHardwareTextureAndroid).toBe(false);
        expect(deck.props.snapToOffsets).not.toContain(leafWidth);
        expect(renderer.root.findByProps({ accessibilityLabel: "home.favoriteSheet · 5 songs" }).props.onPress).toEqual(expect.any(Function));
    });

    it("folds visibly before the leaf scrolls out, and unfolds when swiping back", () => {
        render();
        const deck = renderer.root.findByType("AnimatedScrollView" as any);
        const leaf = renderer.root.findByProps({ testID: "home-feature-fold" });
        const width = StyleSheet.flatten(renderer.root.findByProps({ testID: "home-feature-fold-paper" }).props.style).width;
        const angle = () => parseFloat(StyleSheet.flatten(leaf.props.style).transform[1].rotateY);
        act(() => deck.props.onScroll({ contentOffset: { x: width * 0.5 } }));
        act(() => renderer.update(<HomeFeatureDeck {...props} />));
        expect(angle()).toBe(-90);
        const face = renderer.root.findByProps({ testID: "home-feature-fold-face" });
        expect(StyleSheet.flatten(face.props.style).opacity).toBe(0);
        act(() => deck.props.onScroll({ contentOffset: { x: width } }));
        act(() => renderer.update(<HomeFeatureDeck {...props} />));
        expect(angle()).toBe(-180);
        expect(StyleSheet.flatten(face.props.style).opacity).toBe(0);
        expect(deck.props.snapToOffsets).toContain(width);
        const front = renderer.root.findByProps({ testID: "home-feature-front" });
        expect(StyleSheet.flatten(front.props.style).zIndex).toBeGreaterThan(StyleSheet.flatten(leaf.parent!.props.style).zIndex);
        expect(StyleSheet.flatten(front.props.style).overflow).toBe("hidden");
        expect(StyleSheet.flatten(front.props.style).borderTopLeftRadius).toBeGreaterThan(0);
        act(() => deck.props.onScroll({ contentOffset: { x: width * 0.2 } }));
        act(() => renderer.update(<HomeFeatureDeck {...props} />));
        expect(angle()).toBeCloseTo(-18.72);
        expect(StyleSheet.flatten(face.props.style).opacity).toBe(1);
        expect(deck.props.removeClippedSubviews).toBe(false);
        expect(leaf.props.collapsable).toBe(false);
        expect(leaf.props.renderToHardwareTextureAndroid).toBe(true);
    });

    it.each([320, 375, 430, 768])("keeps the next card reachable with bounded widths at %s dp", width => {
        mockWidth = width;
        render();
        const deck = renderer.root.findByType("AnimatedScrollView" as any);
        const spread = StyleSheet.flatten(deck.findByProps({ testID: "home-feature-spread" }).props.style);
        expect(spread.width).toBeLessThan(width - 40);
        expect(spread.width).toBeGreaterThan(200);
        const leafWidth = StyleSheet.flatten(deck.findByProps({ testID: "home-feature-fold-paper" }).props.style).width;
        const companion = StyleSheet.flatten(deck.findByType("ShiYinCard" as any).parent!.props.style);
        const insets = StyleSheet.flatten(deck.props.contentContainerStyle);
        const contentWidth = spread.width + spacing.md + companion.width + insets.paddingHorizontal * 2;
        const lastSnap = Math.max(0, contentWidth - width);
        expect(deck.props.snapToOffsets).toEqual([0, leafWidth, lastSnap]);
        // The last stop is the actual scroll limit; the next card docks at the page inset.
        // No artificial trailing padding or empty third of the screen.
        expect(insets.paddingRight).toBeUndefined();
        expect(contentWidth - lastSnap - insets.paddingHorizontal).toBeCloseTo(width - insets.paddingHorizontal);
    });

    it.each([320, 375, 430, 768].flatMap(width => [150, 220, 330].map(height => [width, height])))
    ("keeps the hinge attached and the turning back visible at %s dp / %s height", (screenWidth, height) => {
        mockWidth = screenWidth;
        render();
        const deck = renderer.root.findByType("AnimatedScrollView" as any);
        const spread = renderer.root.findByProps({ testID: "home-feature-spread" });
        act(() => spread.props.onLayout({ nativeEvent: { layout: { height } } }));
        const paper = StyleSheet.flatten(renderer.root.findByProps({ testID: "home-feature-fold-paper" }).props.style);
        const hinge = paper.width;
        const frame = () => StyleSheet.flatten(renderer.root.findByProps({ testID: "home-feature-fold" }).props.style);
        // Project the actual native-center transform independently of the scroll mapping.
        // This catches translated pivots, wrong fold direction and symmetric vertical shrink.
        const project = (x: number, y: number) => {
            const style = frame();
            const centerX = style.width / 2, centerY = style.height / 2;
            const radians = parseFloat(style.transform[1].rotateY) * Math.PI / 180;
            const localX = x - centerX;
            const depth = -localX * Math.sin(radians);
            const scale = 1 / (1 - depth / style.transform[0].perspective);
            return { x: centerX + localX * Math.cos(radians) * scale, y: centerY + (y - centerY) * scale };
        };
        for (let step = 0; step <= 60; step++) {
            act(() => deck.props.onScroll({ contentOffset: { x: hinge * step / 60 } }));
            act(() => renderer.update(<HomeFeatureDeck {...props} />));
            expect(project(hinge, 0).x).toBeCloseTo(hinge, 5);
            expect(project(hinge, 0).y).toBeCloseTo(0, 5);
            expect(project(hinge, height).y).toBeCloseTo(height, 5);
            const freeTop = project(0, 0), freeBottom = project(0, height);
            expect(freeTop.y).toBeGreaterThanOrEqual(-0.00001);
            expect(freeBottom.y).toBeGreaterThanOrEqual(height - 0.00001);
            const insets = StyleSheet.flatten(deck.props.contentContainerStyle);
            expect(freeBottom.y).toBeLessThanOrEqual(height + insets.paddingBottom);
            if (step < 30) expect(freeTop.x).toBeLessThan(hinge);
            if (step > 30) expect(freeTop.x).toBeGreaterThan(hinge);
            if (step > 30 && step < 44) expect(frame().opacity).toBe(1);
            if (step > 30 && step < 60) expect(frame().opacity).toBeGreaterThan(0);
        }
        // Full closure must also clear material under rounded front corners.
        expect(frame().opacity).toBe(0);
        act(() => deck.props.onScroll({ contentOffset: { x: hinge * 0.7 } }));
        act(() => renderer.update(<HomeFeatureDeck {...props} />));
        expect(frame().opacity).toBe(1);
        expect(project(0, height).y).toBeGreaterThan(height);
    });

    it("keeps the joined edge square until the paper passes behind, then restores the rounded card", () => {
        render();
        const deck = renderer.root.findByType("AnimatedScrollView" as any);
        const width = StyleSheet.flatten(renderer.root.findByProps({ testID: "home-feature-fold-paper" }).props.style).width;
        const radius = () => StyleSheet.flatten(renderer.root.findByProps({ testID: "home-feature-front" }).props.style).borderTopLeftRadius;
        for (const progress of [0, 0.2, 0.5]) {
            act(() => deck.props.onScroll({ contentOffset: { x: width * progress } }));
            act(() => renderer.update(<HomeFeatureDeck {...props} />));
            expect(radius()).toBe(0);
        }
        act(() => deck.props.onScroll({ contentOffset: { x: width } }));
        act(() => renderer.update(<HomeFeatureDeck {...props} />));
        expect(radius()).toBeGreaterThan(0);
    });

    it("ignores invalid native measurements and preserves the visible sheet with reduced motion", () => {
        render();
        const spread = renderer.root.findByProps({ testID: "home-feature-spread" });
        const paper = () => StyleSheet.flatten(renderer.root.findByProps({ testID: "home-feature-fold-paper" }).props.style);
        act(() => spread.props.onLayout({ nativeEvent: { layout: { height: 220 } } }));
        for (const height of [0, -1, NaN, Infinity]) {
            act(() => spread.props.onLayout({ nativeEvent: { layout: { height } } }));
            expect(paper().height).toBe(220);
        }
        mockOffset.value = paper().width;
        mockReduced = true;
        act(() => renderer.update(<HomeFeatureDeck {...props} />));
        const frame = StyleSheet.flatten(renderer.root.findByProps({ testID: "home-feature-fold" }).props.style);
        expect(frame.transform).toEqual([]);
        expect(frame.opacity).toBe(1);
    });

    it("draws one appearance per visit, preserves it across music, layout and scroll updates, then draws again on remount", () => {
        const random = jest.mocked(Math.random).mockReturnValueOnce(0.75).mockReturnValueOnce(0.25);
        render();
        const appearance = () => renderer.root.findByType("HomeHero" as any).props.appearance;
        expect(appearance()).toBe("record");
        act(() => renderer.root.findByProps({ testID: "home-feature-spread" }).props.onLayout({ nativeEvent: { layout: { height: 250 } } }));
        act(() => renderer.root.findByType("AnimatedScrollView" as any).props.onScroll({ contentOffset: { x: 100 } }));
        act(() => renderer.update(<HomeFeatureDeck {...props} music={{ ...props.music, id: "next-track" }} favoriteCount={6} />));
        expect(appearance()).toBe("record");
        expect(random).toHaveBeenCalledTimes(1);
        act(() => renderer.unmount());
        render();
        expect(appearance()).toBe("window");
        expect(random).toHaveBeenCalledTimes(2);
    });

    it.each([
        ["light", lightColors, false],
        ["dark", darkColors, true],
        ["custom", { ...lightColors, primary: "#7459C7" }, false],
        ["transparent", { ...lightColors, card: "rgba(255,255,255,0.72)", surface: "rgba(238,244,255,0.8)" }, false],
    ].flatMap(row => ["window", "record"].map(appearance => [...row, appearance])))
    ("preserves readable collection text and couples the leaf to the main card appearance in the %s theme", (_label, colors, dark, appearance) => {
        jest.mocked(Math.random).mockReturnValue(appearance === "record" ? 0.75 : 0.25);
        const palette = colors as typeof lightColors;
        mockColors = resolveThemeColors({ ...palette, background: palette.pageBackground }, dark as boolean);
        render();
        expect(renderer.root.findByType("HomeHero" as any).props.appearance).toBe(appearance);
        expect(renderer.root.findByType("ShiYinCard" as any).props.appearance).toBe(appearance);
        const paper = StyleSheet.flatten(renderer.root.findByProps({ testID: "home-feature-fold-paper" }).props.style);
        expect(paper.backgroundColor).toBe(appearance === "record" ? mockColors.featuredRecordFoldSurface : mockColors.featuredWindowFoldSurface);
        const backgrounds = appearance === "record" ? mockColors.featuredRecordFoldGradient : [blendOver(paper.backgroundColor, mockColors.pageBackground)];
        if (appearance === "record") {
            const gradient = renderer.root.findByProps({ testID: "home-record-fold-lighting" });
            expect(gradient.props.colors).toEqual(mockColors.featuredRecordFoldGradient);
            expect(gradient.props.pointerEvents).toBe("none");
            expect(renderer.root.findByProps({ testID: "home-record-spine" }).props.pointerEvents).toBe("none");
        }
        renderer.root.findAllByType("ThemeText" as any).forEach(node => {
            backgrounds.forEach(background => expect(contrastRatio(blendOver(node.props.color, background), background)).toBeGreaterThanOrEqual(4.5));
        });
    });
});
