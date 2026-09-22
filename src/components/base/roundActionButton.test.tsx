import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import RoundActionButton from "@/components/base/roundActionButton";

jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/hooks/useColors", () => () => ({
    primary: "#3978FF",
    onPrimary: "#FFFFFF",
}));
jest.mock("@/utils/rpx", () => ({
    __esModule: true,
    default: (value: number) => value,
    fontRpx: (value: number) => value,
    fontRpxRound: (value: number) => value,
    rpxRound: (value: number) => value,
}));

function render(variant: "solid" | "inverse" | "tonal", props = {}) {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(
            <RoundActionButton variant={variant} iconName="play" {...props} />,
        );
    });
    return renderer!;
}

/** 取圆钮方框（带 borderRadius 的那一层）的样式 */
function boxStyle(renderer: TestRenderer.ReactTestRenderer) {
    const node = renderer.root.findAllByProps({ accessibilityRole: "button" })[0];
    return StyleSheet.flatten(node?.props.style) as Record<string, unknown>;
}

describe("RoundActionButton", () => {
    it("solid 是主色实底 + onPrimary 图标", () => {
        const onPress = jest.fn();
        const renderer = render("solid", { onPress, accessibilityLabel: "p" });

        const style = boxStyle(renderer);
        expect(style.backgroundColor).toBe("#3978FF");
        expect(style.width).toBe(70);
        expect(style.height).toBe(70);
        expect(style.borderRadius).toBe(35);

        const icon = renderer.root.findByProps({ name: "play" });
        expect(icon.props.color).toBe("#FFFFFF");
    });

    it("inverse 是白底 + 深色图标 + 投影，与主题无关", () => {
        const renderer = render("inverse", {
            onPress: jest.fn(),
            accessibilityLabel: "p",
        });

        const style = boxStyle(renderer);
        expect(style.backgroundColor).toBe("#FFFFFF");
        expect(style.shadowColor).toBe("#13244E");
        expect(style.elevation).toBe(4);

        const icon = renderer.root.findByProps({ name: "play" });
        expect(icon.props.color).toBe("#17213E");
    });

    it("tonal 是主色 16% 底 + 主色图标", () => {
        const renderer = render("tonal", {
            onPress: jest.fn(),
            accessibilityLabel: "p",
        });

        const style = boxStyle(renderer);
        expect(style.backgroundColor).toBe("rgba(57, 120, 255, 0.16)");

        const icon = renderer.root.findByProps({ name: "play" });
        expect(icon.props.color).toBe("#3978FF");
    });

    it("size 只改直径，圆角始终是一半", () => {
        const renderer = render("tonal", {
            size: 76,
            onPress: jest.fn(),
            accessibilityLabel: "p",
        });

        const style = boxStyle(renderer);
        expect(style.width).toBe(76);
        expect(style.height).toBe(76);
        expect(style.borderRadius).toBe(38);
    });

    it("没有 onPress 时渲染成 View，不抢外层点击", () => {
        const renderer = render("tonal");

        expect(
            renderer.root.findAllByProps({ accessibilityRole: "button" }),
        ).toHaveLength(0);
        expect(renderer.root.findAllByProps({ onPress: expect.anything() })).toHaveLength(0);
    });

    it("loading 时用转圈替代图标，且不响应点击", () => {
        const onPress = jest.fn();
        const renderer = render("tonal", {
            loading: true,
            onPress,
            accessibilityLabel: "p",
        });

        expect(renderer.root.findAllByProps({ name: "play" })).toHaveLength(0);
        const node = renderer.root.findByProps({
            accessibilityRole: "button",
        });
        expect(node.props.disabled).toBe(true);
    });

    it("onPress 拿到手势事件，调用方能 stopPropagation", () => {
        const stopPropagation = jest.fn();
        const onPress = jest.fn(event => event.stopPropagation());
        const renderer = render("tonal", {
            onPress,
            accessibilityLabel: "p",
        });

        act(() => {
            renderer.root
                .findByProps({ accessibilityLabel: "p" })
                .props.onPress({ stopPropagation });
        });

        expect(stopPropagation).toHaveBeenCalledTimes(1);
    });

    it("叠加层与图标都在绝对定位层里，不拦截点击", () => {
        const renderer = render("solid", {
            onPress: jest.fn(),
            accessibilityLabel: "p",
            children: <React.Fragment>ring</React.Fragment>,
        });

        // children 叠加层 + 图标层，两层 absolute-fill 锁死同一个圆心；
        // 图标一旦走流内布局，在带进度环的实机上会被顶出圆心。
        const layers = renderer.root.findAllByProps({ pointerEvents: "none" });
        const absoluteLayers = layers.filter(layer => {
            const style = StyleSheet.flatten(layer.props.style);
            return style?.position === "absolute";
        });
        expect(absoluteLayers.length).toBeGreaterThanOrEqual(2);
        expect(renderer.toJSON()).toBeTruthy();
    });
});
