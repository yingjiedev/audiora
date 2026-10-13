import React from "react";
import { Image, StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { contrastRatio } from "@/utils/colorContrast";
import { resolveThemeColors } from "@/utils/themeColors";
import ShiYinCard from "./ShiYinCard";
import { homeFeatureLayout } from "./homeFeatureLayout";

const mockStart = jest.fn();
let mockLoading = false;
let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { homeDiscoveryStudio: 7 } }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("./homeBody/useShiYin", () => () => ({ loading: mockLoading, start: mockStart }));

describe("Featured discovery companion", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    beforeEach(() => {
        mockStart.mockClear(); mockLoading = false;
    });
    afterEach(() => act(() => renderer?.unmount()));

    it.each([
        ["light", lightColors, false],
        ["dark", darkColors, true],
        ["purple", { ...lightColors, primary: "#7459C7" }, false],
        ["bright", { ...lightColors, primary: "#FFCC00" }, false],
    ])("uses readable text and actual actions on the %s companion", (_name, palette, dark) => {
        mockColors = resolveThemeColors({ ...palette, background: palette.pageBackground }, dark);
        act(() => {
            renderer = TestRenderer.create(<ShiYinCard topListPlugins={[]} />);
        });
        const target = renderer.root.findByProps({ accessibilityLabel: "home.shiyin" });
        const surface = StyleSheet.flatten(target.props.style).backgroundColor;
        expect(surface).toBe(mockColors.featuredWindowSurface);
        target.findAllByType("ThemeText" as any).forEach(text => {
            expect(contrastRatio(text.props.color, surface)).toBeGreaterThanOrEqual(4.5);
        });
        target.findAllByType("Icon" as any).forEach(icon => {
            expect(contrastRatio(icon.props.color, StyleSheet.flatten(icon.parent!.props.style).backgroundColor)).toBeGreaterThanOrEqual(3);
        });
        act(() => target.props.onPress());
        expect(mockStart).toHaveBeenCalledTimes(1);
        mockLoading = true;
        act(() => renderer.update(<ShiYinCard topListPlugins={[]} />));
        expect(target.props.disabled).toBe(true);
        expect(target.props.accessibilityState).toEqual({ disabled: true, busy: true });
        expect(target.findAllByType("Icon" as any).some(icon => icon.props.name === "play")).toBe(false);
    });

    it("matches the compact record card height while retaining the real queue action", () => {
        act(() => {
            renderer = TestRenderer.create(<ShiYinCard topListPlugins={[]} appearance="record" />);
        });
        const target = renderer.root.findByProps({ accessibilityLabel: "home.shiyin" });
        expect(StyleSheet.flatten(target.props.style).minHeight).toBe(homeFeatureLayout.record.minimumHeight);
        expect(StyleSheet.flatten(target.props.style).overflow).toBe("visible");
        expect(StyleSheet.flatten(target.props.style).boxShadow[0].color).toBe(mockColors.featuredRecordHalo);
        expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "home-discovery-clip" }).props.style).overflow).toBe("hidden");
        const artwork = renderer.root.findByType(Image);
        expect(artwork.props.source).toBe(7);
        expect(StyleSheet.flatten(artwork.parent!.props.style).height).toBe(homeFeatureLayout.record.artworkHeight);
        act(() => target.props.onPress());
        expect(mockStart).toHaveBeenCalledTimes(1);
    });
});
