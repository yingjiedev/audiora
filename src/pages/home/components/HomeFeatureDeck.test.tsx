import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { blendOver, contrastRatio } from "@/utils/colorContrast";
import { resolveThemeColors } from "@/utils/themeColors";
import HomeFeatureDeck from "./HomeFeatureDeck";

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
    interpolate: (value: number, inputs: number[], outputs: number[]) => outputs[0] + (outputs[1] - outputs[0]) * Math.max(0, Math.min(1, value / inputs[1])),
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
    });
    afterEach(() => act(() => renderer?.unmount()));
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
        expect(renderer.root.findByType("FastImage" as any).props.source).toBe(props.favoriteArtwork);
        expect(renderer.root.findByType("ShiYinCard" as any).props.preferredArtists).toBe(props.tasteArtists);
    });

    it("clamps overscroll folds and removes perspective when reduced motion is enabled", () => {
        render();
        const fold = () => StyleSheet.flatten(renderer.root.findByType("AnimatedView" as any).props.style).transform;
        expect(fold()).toEqual([{ perspective: 600 }, { rotateY: "-18deg" }]);
        const deck = renderer.root.findByType("AnimatedScrollView" as any);
        act(() => deck.props.onScroll({ contentOffset: { x: 99999 } }));
        act(() => renderer.update(<HomeFeatureDeck {...props} />));
        expect(fold()).toEqual([{ perspective: 600 }, { rotateY: "-38deg" }]);
        mockReduced = true;
        act(() => renderer.update(<HomeFeatureDeck {...props} />));
        expect(fold()).toEqual([]);
        expect(renderer.root.findByProps({ accessibilityLabel: "home.favoriteSheet · 5 songs" }).props.onPress).toEqual(expect.any(Function));
    });

    it.each([320, 375, 430, 768])("keeps the next card reachable with bounded widths at %s dp", width => {
        mockWidth = width;
        render();
        const deck = renderer.root.findByType("AnimatedScrollView" as any);
        const spread = StyleSheet.flatten(deck.findByType("HomeHero" as any).parent!.props.style);
        expect(spread.width).toBeLessThan(width - 40);
        expect(spread.width).toBeGreaterThan(200);
        expect(deck.props.snapToOffsets).toEqual([0, spread.width + 8]);
    });

    it.each([
        ["light", lightColors, false],
        ["dark", darkColors, true],
        ["custom", { ...lightColors, primary: "#7459C7" }, false],
        ["transparent", { ...lightColors, card: "rgba(255,255,255,0.72)", surface: "rgba(238,244,255,0.8)" }, false],
    ])("preserves readable collection text on the actual %s leaf surface", (_label, colors, dark) => {
        mockColors = resolveThemeColors({ ...colors, background: colors.pageBackground }, dark);
        render();
        const background = blendOver(mockColors.card, mockColors.pageBackground);
        renderer.root.findAllByType("ThemeText" as any).forEach(node => {
            expect(contrastRatio(blendOver(node.props.color, background), background)).toBeGreaterThanOrEqual(4.5);
        });
    });
});
