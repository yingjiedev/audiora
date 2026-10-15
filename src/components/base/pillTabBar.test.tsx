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
        for (const variant of ["underline", "pill", "compact"] as const) {
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
            const defaultPage = dark ? darkColors.pageBackground : lightColors.pageBackground;
            const page = blendOver(mockColors.pageBackground ?? defaultPage, defaultPage);
            const surface = variant !== "underline" ? tabs[0].findAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.backgroundColor) : undefined;
            const surfaceColor = StyleSheet.flatten(surface?.props.style)?.backgroundColor;
            const background = blendOver(typeof surfaceColor === "string" ? surfaceColor : page, page);
            expect(contrastRatio(blendOver(mockColors.active, background), background)).toBeGreaterThanOrEqual(4.5);
            act(() => renderer!.unmount());
        }
    });

    it("keeps named, selected tabs reachable with a separate spoken label in every variant", () => {
        mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
        const change = jest.fn();
        for (const variant of ["underline", "pill", "compact"] as const) {
            let renderer: TestRenderer.ReactTestRenderer;
            act(() => {
                renderer = TestRenderer.create(<PillTabBar variant={variant} routes={routes} index={0} onIndexChange={change} getAccessibilityLabel={route => `音源：${route.title}`} />);
            });
            const tabs = routes.map(route => renderer!.root.findAllByProps({ accessibilityLabel: `音源：${route.title}` }).find(node => typeof node.props.onPress === "function")!);
            expect(tabs[0].props.accessibilityLabel).toBe("音源：本地音乐");
            expect(tabs.map(tab => tab.findByType(Text).props.children)).toEqual(routes.map(route => route.title));
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

    it("keeps pill backgrounds compact inside centered touch targets", () => {
        mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
        const title = "A very long source name";
        const change = jest.fn();
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<PillTabBar routes={[{ key: "source", title, count: 12 }]} index={0} onIndexChange={change} getBadge={route => route.count ?? null} />);
        });
        const tab = renderer!.root.findAllByProps({ accessibilityLabel: title }).find(node => typeof node.props.onPress === "function")!;
        const target = StyleSheet.flatten(tab.props.style);
        expect(target.minHeight).toBeGreaterThanOrEqual(44);
        expect(target.backgroundColor).toBeUndefined();
        expect(target.justifyContent).toBe("center");
        const surface = tab.findAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.backgroundColor)!;
        const surfaceStyle = StyleSheet.flatten(surface.props.style);
        expect(surfaceStyle.minHeight).toBe(32);
        expect(surfaceStyle.minHeight).toBeLessThan(target.minHeight);
        expect(surfaceStyle.justifyContent).toBe("center");
        const texts = tab.findAllByType(Text);
        expect(texts[0].props.children).toBe(title);
        expect(texts[0].props.numberOfLines).toBe(1);
        expect(StyleSheet.flatten(texts[0].props.style).flexShrink).toBe(1);
        expect(texts[1].props.children).toBe(12);
        act(() => tab.props.onPress());
        expect(change).toHaveBeenCalledWith(0);
        act(() => renderer!.unmount());
    });
});
