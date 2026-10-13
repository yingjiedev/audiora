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
    const tree = (activeSection: string) => (
        <StickyHeader scrollAnimatedValue={new Animated.Value(0)} onLayout={jest.fn()}>
            <HomeSectionNavigation sections={sections} activeSection={activeSection} onSelect={onSelect} onLayout={onLayout} />
        </StickyHeader>
    );
    const render = (activeSection = "recommend") => act(() => {
        renderer = TestRenderer.create(tree(activeSection));
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
        expect(fill.overflow).toBe("hidden");
        expect(text.parent!.props.collapsable).toBe(false);
        expect(text.props.numberOfLines).toBe(1);
    });

    it("retains the same native rounded mask and background across every selection", () => {
        render();
        const masks = renderer.root.findAllByType("ThemeText" as any).map(text => text.parent!);
        const layers = masks.map(mask => mask.findAll(node => node.props.pointerEvents === "none" && node.props.collapsable === false)[0]);
        for (const active of ["favorites", "charts", "recommend", "favorites"]) {
            act(() => renderer.update(tree(active)));
            renderer.root.findAllByType("ThemeText" as any).forEach((text, index) => {
                expect(text.parent).toBe(masks[index]);
                expect(text.props.fontWeight).toBe("semibold");
                expect(StyleSheet.flatten(layers[index].props.style)).toMatchObject({ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 14, backgroundColor: "primary", opacity: sections[index].key === active ? 1 : 0 });
                expect(StyleSheet.flatten(masks[index].props.style)).toMatchObject({ borderRadius: 14, overflow: "hidden" });
            });
        }
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
