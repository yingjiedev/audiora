import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { contrastRatio } from "@/utils/colorContrast";
import { resolveThemeColors } from "@/utils/themeColors";
import ShiYinCard from "./ShiYinCard";

const mockStart = jest.fn();
let mockLoading = false;
let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { homeListeningClouds: 7 } }));
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
});
