import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import HomeBottomNavigation from "./HomeBottomNavigation";

jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/core/i18n", () => ({
    useI18N: () => ({ t: (key: string) => key }),
}));
jest.mock("@/hooks/useColors", () => () => ({
    primary: "#3978FF",
    text: "#111827",
    textSecondary: "#6B7280",
    tabBar: "#FFFFFF",
    surface: "#FFFFFF",
    shadow: "#0B1B3A",
    border: "#E5E7EB",
}));
jest.mock("@/utils/rpx", () => ({
    __esModule: true,
    default: (value: number) => value,
}));
jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function render(activeTab: "home" | "library" | "mine") {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(
            <HomeBottomNavigation
                activeTab={activeTab}
                onSelectHome={jest.fn()}
                onSelectLibrary={jest.fn()}
                onSelectMine={jest.fn()}
            />,
        );
    });
    return renderer!;
}

function iconNames(renderer: TestRenderer.ReactTestRenderer) {
    return renderer.root.findAllByType("Icon").map(node => node.props.name);
}

/**
 * Pressable 会把无障碍属性透传给内部 View，同一份 props 会被匹配两次；
 * 只保留外层 Pressable（父节点不再带同一个 role 的那个）。
 */
function pressables(
    renderer: TestRenderer.ReactTestRenderer,
    role: "tab" | "button",
) {
    return renderer.root
        .findAllByProps({ accessibilityRole: role })
        .filter(node => node.parent?.props?.accessibilityRole !== role);
}

/** 选中态不再画指示器底色：任何 View 都不该出现半透明染色底 */
function tintedViews(renderer: TestRenderer.ReactTestRenderer) {
    return renderer.root.findAll(node => {
        if (node.type !== "View") {
            return false;
        }
        const bg = StyleSheet.flatten(node.props.style)?.backgroundColor;
        return typeof bg === "string" && bg.includes("rgba");
    });
}

function labels(renderer: TestRenderer.ReactTestRenderer) {
    return renderer.root
        .findAllByType("ThemeText")
        .map(node => [node.props.color, node.props.fontWeight]);
}

describe("HomeBottomNavigation", () => {
    it("switches to the filled variant only for the selected tab", () => {
        expect(iconNames(render("home"))).toEqual([
            "home-filled",
            "library-outline",
            "user",
        ]);
        expect(iconNames(render("library"))).toEqual([
            "home-outline",
            "library-filled",
            "user",
        ]);
        expect(iconNames(render("mine"))).toEqual([
            "home-outline",
            "library-outline",
            "user-filled",
        ]);
    });

    it("marks the selected tab with filled icon plus bold primary label only", () => {
        expect(tintedViews(render("library"))).toHaveLength(0);
        expect(labels(render("library"))).toEqual([
            ["#6B7280", "regular"],
            ["#3978FF", "bold"],
            ["#6B7280", "regular"],
        ]);
    });

    it("exposes tab semantics and reports the selected one to TalkBack", () => {
        const tabs = pressables(render("mine"), "tab");

        expect(tabs.map(tab => tab.props.accessibilityLabel)).toEqual([
            "home.home",
            "home.musicLibrary",
            "home.mine",
        ]);
        expect(
            tabs.map(tab => tab.props.accessibilityState?.selected),
        ).toEqual([false, false, true]);
    });
});
