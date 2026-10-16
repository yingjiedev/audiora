import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, View } from "react-native";
import Checkbox from "./checkbox";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { resolveThemeColors } from "@/utils/themeColors";
import { blendOver, contrastRatio } from "@/utils/colorContrast";

let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("@/components/base/icon", () => "Icon");

it.each([
    ["light", lightColors, false],
    ["dark", darkColors, true],
    ["pale custom", { ...lightColors, primary: "#FFF5B0" }, false],
    ["dark custom", { ...darkColors, primary: "#30206A" }, true],
] as const)("keeps the selected checkbox readable on its actual fill in %s", (_name, palette, dark) => {
    mockColors = resolveThemeColors({ ...palette, background: palette.pageBackground }, dark);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<Checkbox checked />);
    });
    const fill = StyleSheet.flatten(renderer!.root.findAllByType(View)[0].props.style).backgroundColor as string;
    const check = renderer!.root.findByType("Icon" as any);
    expect(check.props.color).toBe(mockColors.onPrimary);
    expect(contrastRatio(check.props.color, fill)).toBeGreaterThanOrEqual(4.5);
    act(() => renderer!.update(<Checkbox checked={false} />));
    expect(renderer!.root.findAllByType("Icon" as any)).toHaveLength(0);
    const border = StyleSheet.flatten(renderer!.root.findAllByType(View)[0].props.style).borderColor as string;
    expect(border).toBe(mockColors.textSecondary);
    const page = blendOver(mockColors.pageBackground!, dark ? darkColors.pageBackground : lightColors.pageBackground);
    expect(contrastRatio(blendOver(border, page), page)).toBeGreaterThanOrEqual(3);
    act(() => renderer!.unmount());
});
