import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, View } from "react-native";
import SettingSection from "./settingSection";
import { settingsLayout } from "./settingsLayout";

jest.mock("@/hooks/useColors", () => () => ({
    card: "#FFFFFF",
    text: "#1A1A1A",
    textSecondary: "#8A8F99",
}));

jest.mock("@/utils/rpx", () => {
    const rpx = (value: number) => value;
    return {
        __esModule: true,
        default: rpx,
        fontRpx: rpx,
        fontRpxRound: rpx,
        rpxRound: rpx,
    };
});

function flattenStyle(style: any): Record<string, any> {
    if (!Array.isArray(style)) {
        return style ?? {};
    }
    return style.reduce(
        (acc, item) => ({ ...acc, ...flattenStyle(item) }),
        {} as Record<string, any>,
    );
}

function findText(
    renderer: TestRenderer.ReactTestRenderer,
    content: string,
): any {
    return renderer.root
        .findAllByType(Text)
        .find(node => node.props.children === content);
}

function render(node: React.ReactElement) {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(node);
    });
    return renderer!;
}

describe("SettingSection", () => {
    it("不传 description 时只渲染标题一行，标题字号与间距保持原样", () => {
        const renderer = render(
            <SettingSection title="分组标题">
                <View testID="child" />
            </SettingSection>,
        );

        expect(findText(renderer, "分组标题")).toBeTruthy();
        expect(findText(renderer, "分组说明")).toBeUndefined();

        const titleStyle = flattenStyle(findText(renderer, "分组标题").props.style);
        expect(titleStyle.marginBottom).toBe(settingsLayout.titleGap);
    });

    it("传 description 时渲染独立说明行，字号小于标题", () => {
        const renderer = render(
            <SettingSection title="分组标题" description="分组说明">
                <View testID="child" />
            </SettingSection>,
        );

        const title = findText(renderer, "分组标题");
        const description = findText(renderer, "分组说明");

        expect(title).toBeTruthy();
        expect(description).toBeTruthy();
        expect(
            flattenStyle(description.props.style).fontSize,
        ).toBeLessThan(flattenStyle(title.props.style).fontSize);
    });

    it("标题与说明都放在卡片之外（卡片只包 children）", () => {
        const renderer = render(
            <SettingSection title="分组标题" description="分组说明">
                <View testID="child" />
            </SettingSection>,
        );

        const child = renderer.root.findByProps({ testID: "child" });
        const card = renderer.root
            .findAllByType(View)
            .find(node => flattenStyle(node.props.style).borderRadius ===
                settingsLayout.cardRadius);

        expect(card).toBeTruthy();
        // 说明文字不是卡片的后代
        expect(
            renderer.root
                .findAllByType(Text)
                .filter(node => node.props.children === "分组说明")
                .some(node => {
                    let parent = node.parent;
                    while (parent) {
                        if (parent === card) {
                            return true;
                        }
                        parent = parent.parent;
                    }
                    return false;
                }),
        ).toBe(false);
        expect(child).toBeTruthy();
    });
});
