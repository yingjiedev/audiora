import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, Text, View } from "react-native";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { resolveThemeColors } from "@/utils/themeColors";
import { blendOver, contrastRatio } from "@/utils/colorContrast";
import PillTabBar from "./pillTabBar";

let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("react-native/Libraries/Components/ScrollView/ScrollView", () => {
    const ReactMock = require("react");
    return { __esModule: true, default: (props: any) => ReactMock.createElement("ScrollView", props, props.children) };
});

const routes = [{ key: "local", title: "本地音乐" }, { key: "online", title: "在线音乐" }];

describe("PillTabBar theme and navigation", () => {
    it.each([
        ["light", lightColors, false],
        ["dark", darkColors, true],
        ["custom purple", { ...lightColors, primary: "#B68CFF", card: "rgba(255,255,255,0.8)" }, false],
        ["custom teal", { ...darkColors, primary: "#B0F5DA", card: "rgba(24,35,60,0.8)" }, true],
    ] as const)("uses a readable selected state on %s", (_name, palette, dark) => {
        mockColors = resolveThemeColors({ ...palette, background: palette.pageBackground }, dark);
        for (const variant of ["underline", "pill"] as const) {
            let renderer: TestRenderer.ReactTestRenderer;
            act(() => {
                renderer = TestRenderer.create(<PillTabBar variant={variant} routes={routes} index={0} onIndexChange={jest.fn()} />);
            });
            const tabs = routes.map(route => renderer!.root.findAllByProps({ accessibilityLabel: route.title }).find(node => typeof node.props.onPress === "function")!);
            expect(StyleSheet.flatten(tabs[0].findByType(Text).props.style).color).toBe(mockColors.active);
            if (variant === "underline") {
                const indicator = tabs[0].findAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.backgroundColor === mockColors.active);
                expect(indicator).toBeDefined();
            }
            expect(StyleSheet.flatten(tabs[1].findByType(Text).props.style).color).toBe(mockColors.textSecondary);
            const page = blendOver(mockColors.pageBackground, dark ? darkColors.pageBackground : lightColors.pageBackground);
            const background = blendOver(StyleSheet.flatten(tabs[0].props.style).backgroundColor ?? page, page);
            expect(contrastRatio(blendOver(mockColors.active, background), background)).toBeGreaterThanOrEqual(4.5);
            act(() => renderer!.unmount());
        }
    });

    it("keeps named, selected tabs reachable in both variants", () => {
        mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
        const change = jest.fn();
        for (const variant of ["underline", "pill"] as const) {
            let renderer: TestRenderer.ReactTestRenderer;
            act(() => {
                renderer = TestRenderer.create(<PillTabBar variant={variant} routes={routes} index={0} onIndexChange={change} />);
            });
            const tabs = routes.map(route => renderer!.root.findAllByProps({ accessibilityLabel: route.title }).find(node => typeof node.props.onPress === "function")!);
            expect(tabs[0].props.accessibilityLabel).toBe("本地音乐");
            expect(tabs[0].props.accessibilityState).toEqual({ selected: true });
            expect(tabs[1].props.accessibilityState).toEqual({ selected: false });
            tabs.forEach(tab => {
                const style = StyleSheet.flatten(tab.props.style);
                expect(style.minWidth).toBeGreaterThanOrEqual(44);
                expect(style.minHeight).toBeGreaterThanOrEqual(44);
            });
            act(() => tabs[1].props.onPress());
            expect(change).toHaveBeenLastCalledWith(1);
            act(() => renderer!.unmount());
        }
    });
});
