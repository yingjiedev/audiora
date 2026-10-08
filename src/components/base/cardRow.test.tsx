import React from "react";
import { StyleSheet, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import CardRow from "@/components/base/cardRow";

jest.mock("@/hooks/useColors", () => () => ({
    card: "#FFFFFF",
    text: "#111827",
    textSecondary: "#6B7280",
}));
jest.mock("@/utils/rpx", () => ({
    __esModule: true,
    default: (value: number) => value,
    fontRpx: (value: number) => value,
    fontRpxRound: (value: number) => value,
    rpxRound: (value: number) => value,
}));

function render(props: Record<string, unknown> = {}) {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<CardRow title="title" {...props} />);
    });
    return renderer!;
}

/** 卡片壳 = 扁平化样式里带 minHeight 的那一层 */
function shellStyle(renderer: TestRenderer.ReactTestRenderer) {
    const node = renderer.root.findAll(
        candidate => StyleSheet.flatten(candidate.props.style)?.minHeight === 116,
    )[0];
    return StyleSheet.flatten(node.props.style) as Record<string, unknown>;
}

function testIDs(renderer: TestRenderer.ReactTestRenderer) {
    // 只看宿主节点（type 是字符串），否则 composite 和 host 会各命中一次
    return renderer.root
        .findAll(
            candidate =>
                typeof candidate.type === "string" &&
                typeof candidate.props.testID === "string",
        )
        .map(candidate => candidate.props.testID);
}

describe("CardRow", () => {
    it("把卡片壳的 token 收敛在组件内部", () => {
        const renderer = render({ description: "desc" });

        expect(shellStyle(renderer)).toMatchObject({
            minHeight: 116,
            borderRadius: 22,
            paddingHorizontal: 18,
            backgroundColor: "#FFFFFF",
        });
    });

    it("没有 onPress 时不渲染成可点击节点", () => {
        const renderer = render();

        expect(
            renderer.root.findAllByProps({ accessibilityRole: "button" }),
        ).toHaveLength(0);
    });

    it("有 onPress 时整卡可点，并带上无障碍标签", () => {
        const onPress = jest.fn();
        const renderer = render({ onPress, accessibilityLabel: "card" });

        const card = renderer.root.findByProps({
            accessibilityRole: "button",
        });
        expect(card.props.accessibilityLabel).toBe("card");
        act(() => {
            card.props.onPress();
        });
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("按 leading / 文案 / trailing 的顺序渲染", () => {
        const renderer = render({
            description: "desc",
            leading: <View testID="leading" />,
            trailing: <View testID="trailing" />,
        });

        expect(testIDs(renderer)).toEqual(["leading", "trailing"]);
        expect(
            renderer.root.findAll(
                candidate =>
                    typeof candidate.type === "string" &&
                    candidate.props.children === "desc",
            ),
        ).toHaveLength(1);
    });

    it("disabled 传给 Pressable，由它拦截点击", () => {
        const renderer = render({
            onPress: jest.fn(),
            disabled: true,
            accessibilityLabel: "card",
        });

        const card = renderer.root.findByProps({
            accessibilityRole: "button",
        });
        expect(card.props.disabled).toBe(true);
    });
});
