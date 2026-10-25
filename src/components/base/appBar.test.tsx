/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, TouchableWithoutFeedback } from "react-native";
import { Provider } from "jotai";
import AppBar from "./appBar";
import { PortalHost } from "./portal";
import ListItem from "./listItem";
import rpx from "@/utils/rpx";

let mockAnchor = { x: 846, y: 24, width: 44, height: 44 };
let mockHost = { x: 0, y: 0, width: 1280, height: 800 };
let mockAnchorMeasure: ((callback: (...values: number[]) => void) => void) | undefined;
let mockHostMeasure: ((callback: (...values: number[]) => void) => void) | undefined;
const mockAction = jest.fn();
const mockMotion = { timing: (value: number) => value };

jest.mock("react-native/Libraries/Components/View/View", () => {
    const R = require("react");
    return { __esModule: true, default: R.forwardRef((props, ref) => {
        R.useImperativeHandle(ref, () => ({ measureInWindow: callback => {
            const anchor = props.testID === "app-bar-menu-anchor";
            const measure = anchor ? mockAnchorMeasure : mockHostMeasure;
            if (measure) measure(callback);
            else {
                const { x, y, width, height } = anchor ? mockAnchor : mockHost;
                callback(x, y, width, height);
            }
        } }));
        return R.createElement("MockView", props, props.children);
    }) };
});
jest.mock("react-native-reanimated", () => {
    const R = require("react");
    return {
        __esModule: true,
        default: { View: "AnimatedView" },
        useSharedValue: value => R.useRef({ value }).current,
        useAnimatedStyle: style => style(),
    };
});
jest.mock("@/hooks/useMotion", () => () => mockMotion);
jest.mock("@/hooks/useColors", () => () => ({ primary: "white", appBarText: "black", surfaceElevated: "white" }));
jest.mock("@/hooks/useHasCustomBackground", () => () => false);
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: key => key }) }));
jest.mock("@/core/theme", () => ({ getDialogSurfaceColor: () => "black" }));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));
jest.mock("./iconButton", () => "IconButton");
jest.mock("./themeText", () => "ThemeText");
jest.mock("./statusBar", () => "StatusBar");
jest.mock("./listItem", () => {
    const R = require("react");
    const Item = props => R.createElement("ListItem", props, props.children);
    Item.ListItemIcon = "ListItemIcon";
    Item.Content = "ListItemContent";
    return { __esModule: true, default: Item };
});

describe("AppBar Portal menu positioning", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    function render() {
        act(() => {
            renderer = TestRenderer.create(<Provider>
                <AppBar withStatusBar menu={[{ icon: "arrow-left", title: "Settings", onPress: mockAction }]}>Album</AppBar>
                <PortalHost />
            </Provider>);
        });
    }
    function anchor() {
        return renderer.root.findByProps({ testID: "app-bar-menu-anchor" });
    }
    function openMenu() {
        act(() => anchor().props.onPress());
    }
    function menu() {
        return renderer.root.findByProps({ testID: "app-bar-menu" });
    }
    function corner() {
        return renderer.root.findByProps({ testID: "app-bar-menu-corner" });
    }
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        mockAnchor = { x: 846, y: 24, width: 44, height: 44 };
        mockHost = { x: 0, y: 0, width: 1280, height: 800 };
        mockAnchorMeasure = undefined;
        mockHostMeasure = undefined;
    });
    afterEach(() => {
        act(() => renderer?.unmount());
        jest.useRealTimers();
    });

    it.each([
        ["phone", 390, 332, 0, 0],
        ["navigation rail", 1024, 966, 0, 0],
        ["supporting pane", 1280, 846, 0, 0],
        ["inset Portal host", 1280, 858, 12, 24],
    ] as const)("anchors both menu and arrow to window measurements with %s", (_name, width, x, hostX, hostY) => {
        mockHost = { x: hostX, y: hostY, width, height: 800 };
        mockAnchor = { x, y: 48, width: 44, height: 44 };
        render();
        openMenu();
        expect(menu().props.pointerEvents).toBe("auto");
        expect(StyleSheet.flatten(menu().props.style)).toMatchObject({
            right: Math.max(rpx(24), mockHost.width - (mockAnchor.x - mockHost.x + 44)),
            top: 92 - mockHost.y + rpx(20),
        });
        expect(StyleSheet.flatten(corner().props.style)).toMatchObject({
            left: mockAnchor.x - mockHost.x + 22 - rpx(10),
            top: 92 - mockHost.y,
        });
    });

    it("remeasures the trigger after a pane changes the content width", () => {
        mockAnchor.x = 1222;
        render();
        openMenu();
        const previousRight = StyleSheet.flatten(menu().props.style).right as number;
        mockAnchor.x = 846;
        act(() => anchor().props.onLayout());
        expect(menu().props.pointerEvents).toBe("none");
        openMenu();
        expect(StyleSheet.flatten(menu().props.style).right).toBe(previousRight + 376);
        expect(StyleSheet.flatten(corner().props.style).left).toBe(868 - rpx(10));
    });

    it.each(["anchor", "host"])("ignores delayed %s measurements after resizing", source => {
        let measured!: (...values: number[]) => void;
        if (source === "anchor") {
            mockAnchorMeasure = callback => {
                measured = callback;
            };
        } else {
            mockHostMeasure = callback => {
                measured = callback;
            };
        }
        render();
        openMenu();
        expect(menu().props.pointerEvents).toBe("none");
        act(() => renderer.root.findByProps({ testID: "app-bar-menu-overlay" }).props.onLayout());
        act(() => measured(0, 0, 1280, 800));
        expect(menu().props.pointerEvents).toBe("none");
        expect(anchor().props.accessibilityState.expanded).toBe(false);
    });

    it.each(["anchor", "host"])("keeps the menu closed when the %s is not measurable", source => {
        if (source === "anchor") mockAnchor.width = 0;
        else mockHost.width = 0;
        render();
        openMenu();
        expect(menu().props.pointerEvents).toBe("none");
    });

    it("dismisses on resize or outside press and preserves menu actions", () => {
        render();
        openMenu();
        act(() => renderer.root.findByProps({ testID: "app-bar-menu-overlay" }).props.onLayout());
        expect(menu().props.pointerEvents).toBe("none");
        openMenu();
        act(() => renderer.root.findByType(TouchableWithoutFeedback).props.onPress());
        expect(menu().props.pointerEvents).toBe("none");
        openMenu();
        act(() => renderer.root.findByType(ListItem).props.onPress());
        expect(menu().props.pointerEvents).toBe("none");
        expect(mockAction).not.toHaveBeenCalled();
        act(() => jest.runOnlyPendingTimers());
        expect(mockAction).toHaveBeenCalledTimes(1);
    });
});
