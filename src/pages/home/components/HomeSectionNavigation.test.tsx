import React from "react";
import { Animated, StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import HomeSectionNavigation from "./HomeSectionNavigation";

jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/hooks/useColors", () => () => ({ pageBackground: "page", primary: "primary", onPrimary: "onPrimary", textSecondary: "secondary" }));
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value / 2 }));

// Use RN's real cloning implementation; the Jest ScrollView mock skips it.
const StickyHeader = jest.requireActual("react-native/Libraries/Components/ScrollView/ScrollViewStickyHeader").default;
const sections = [{ key: "recommend", title: "For you" }, { key: "favorites", title: "Favorites" }, { key: "charts", title: "Charts" }];

describe("Home navigation inside the native sticky wrapper", () => {
    const onSelect = jest.fn();
    const onLayout = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;
    beforeEach(() => jest.clearAllMocks());
    afterEach(() => act(() => renderer?.unmount()));
    const render = (activeSection = "recommend") => act(() => {
        renderer = TestRenderer.create(
            <StickyHeader scrollAnimatedValue={new Animated.Value(0)} onLayout={jest.fn()}>
                <HomeSectionNavigation sections={sections} activeSection={activeSection} onSelect={onSelect} onLayout={onLayout} />
            </StickyHeader>,
        );
    });

    it("retains the horizontal row after RN replaces the direct child's style", () => {
        render();
        const child = renderer.root.findByType(HomeSectionNavigation);
        expect(StyleSheet.flatten(child.props.style)).toEqual({ flex: 1 });
        const row = renderer.root.findByProps({ testID: "home-channel-row" });
        expect(StyleSheet.flatten(row.props.style).flexDirection).toBe("row");
        expect(row.findAllByType("ThemeText" as any).map(text => text.props.children)).toEqual(["For you", "Favorites", "Charts"]);
    });

    it("keeps the selected fill content-sized and rounded while targets remain at least 44dp", () => {
        render();
        const selected = renderer.root.findByProps({ accessibilityLabel: "For you" });
        expect(StyleSheet.flatten(selected.props.style).minHeight).toBeGreaterThanOrEqual(44);
        const text = selected.findByType("ThemeText" as any);
        const fill = StyleSheet.flatten(text.parent!.props.style);
        expect(fill.alignSelf).toBe("flex-start");
        expect(fill.width).toBeUndefined();
        expect(fill.borderRadius).toBeGreaterThan(0);
        expect(fill.borderRadius).toBeLessThanOrEqual(fill.minHeight / 2);
        expect(text.props.numberOfLines).toBe(1);
    });

    it("preserves section selection and layout measurement through the native wrapper", () => {
        render("favorites");
        const favorites = renderer.root.findByProps({ accessibilityLabel: "Favorites" });
        expect(favorites.props.accessibilityState.selected).toBe(true);
        act(() => favorites.props.onPress());
        expect(onSelect).toHaveBeenCalledWith("favorites");
        const measuredWrapper = renderer.root.findAll(node => node.props.collapsable === false && typeof node.props.onLayout === "function")[0];
        const event = { nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 48 } } };
        act(() => measuredWrapper.props.onLayout(event));
        expect(onLayout).toHaveBeenCalledWith(event);
    });
});
