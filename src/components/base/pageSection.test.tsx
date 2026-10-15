import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, View } from "react-native";
import { PageAction } from "./pageSection";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { resolveThemeColors } from "@/utils/themeColors";
import { blendOver, contrastRatio } from "@/utils/colorContrast";

let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
jest.mock("./icon", () => "MockIcon");
jest.mock("./themeText", () => "MockText");
jest.mock("@/hooks/useColors", () => () => mockColors);

function render(props: React.ComponentProps<typeof PageAction>) {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<PageAction {...props} />);
    });
    const button = renderer!.root.findAllByProps({ accessibilityRole: "button" }).find(node => typeof node.props.onPress === "function")!;
    const surface = button.findAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.backgroundColor)!;
    return { renderer: renderer!, button, surface };
}

describe("PageAction compact sizing", () => {
    it("lets a text action use the foreground of a custom navigation bar", () => {
        mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground, appBar: "#18233C", appBarText: "#FFFFFF" }, false);
        const { renderer, surface } = render({ title: "Done", onPress: jest.fn(), variant: "text", textColor: mockColors.appBarText });
        const text = surface.findByType("MockText" as any);
        const fill = blendOver(StyleSheet.flatten(surface.props.style).backgroundColor as string, mockColors.appBar!);
        expect(contrastRatio(text.props.color, fill)).toBeGreaterThanOrEqual(4.5);
        act(() => renderer.unmount());
    });
    it("fits content by default while keeping a larger labeled click target", () => {
        const press = jest.fn();
        const { renderer, button, surface } = render({ title: "Pause all", icon: "pause", onPress: press });
        const targetStyle = StyleSheet.flatten(button.props.style({ pressed: false }));
        const surfaceStyle = StyleSheet.flatten(surface.props.style);
        expect(targetStyle.minWidth).toBeGreaterThanOrEqual(44);
        expect(targetStyle.minHeight).toBeGreaterThanOrEqual(44);
        expect(targetStyle.backgroundColor).toBeUndefined();
        expect(targetStyle.width).toBeUndefined();
        expect(surfaceStyle.minHeight).toBe(32);
        expect(surfaceStyle.minHeight).toBeLessThan(targetStyle.minHeight);
        expect(surfaceStyle.width).toBeUndefined();
        expect(surface.props.pointerEvents).toBe("none");
        expect(button.props.accessibilityLabel).toBe("Pause all");
        act(() => button.props.onPress());
        expect(press).toHaveBeenCalledTimes(1);
        act(() => renderer.unmount());
    });

    it("uses a larger full-width surface only when requested", () => {
        const { renderer, button, surface } = render({ title: "Confirm files", onPress: jest.fn(), variant: "primary", size: "standard", fullWidth: true });
        expect(StyleSheet.flatten(button.props.style({ pressed: false })).width).toBe("100%");
        expect(StyleSheet.flatten(surface.props.style)).toMatchObject({ width: "100%", minHeight: 40 });
        act(() => renderer.unmount());
    });

    it("keeps disabled and pressed feedback on the whole control", () => {
        const { renderer, button } = render({ title: "Pause all", onPress: jest.fn(), disabled: true });
        expect(button.props.disabled).toBe(true);
        expect(button.props.accessibilityState).toEqual({ disabled: true });
        expect(StyleSheet.flatten(button.props.style({ pressed: true })).opacity).toBe(0.45);
        act(() => renderer.update(<PageAction title="Pause all" onPress={jest.fn()} />));
        const enabled = renderer.root.findAllByProps({ accessibilityRole: "button" }).find(node => typeof node.props.onPress === "function")!;
        expect(StyleSheet.flatten(enabled.props.style({ pressed: true })).opacity).toBe(0.7);
        act(() => renderer.unmount());
    });

    it.each([
        ["light", lightColors, false],
        ["dark", darkColors, true],
        ["custom", { ...lightColors, primary: "#B68CFF", card: "rgba(255,255,255,0.8)" }, false],
    ] as const)("keeps readable semantic colors on the actual inner surface in %s", (_name, palette, dark) => {
        mockColors = resolveThemeColors({ ...palette, background: palette.pageBackground }, dark);
        const defaultPage = dark ? darkColors.pageBackground : lightColors.pageBackground;
        const page = blendOver(mockColors.pageBackground ?? defaultPage, defaultPage);
        for (const variant of ["primary", "tonal", "danger", "text"] as const) {
            const { renderer, surface } = render({ title: "Action", onPress: jest.fn(), variant });
            const background = blendOver(StyleSheet.flatten(surface.props.style).backgroundColor as string, page);
            const text = surface.findByType("MockText" as any);
            expect(contrastRatio(blendOver(text.props.color, background), background)).toBeGreaterThanOrEqual(4.5);
            act(() => renderer.unmount());
        }
    });
});
