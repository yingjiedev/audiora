import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, View } from "react-native";
import SettingRow from "./settingRow";
import { settingsLayout } from "./settingsLayout";

jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/hooks/useColors", () => () => ({
    card: "#FFFFFF",
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

function renderRow() {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
        renderer = TestRenderer.create(
            <SettingRow
                title="标题"
                value="一个非常非常长的当前选项值"
                right={<View testID="control" />}
                showChevron
                onPress={() => {}}
            />,
        );
    });

    return renderer!;
}

describe("SettingRow", () => {
    it("标题区可以收缩，右侧内容不会把行顶出卡片", () => {
        const renderer = renderRow();

        const content = renderer.root
            .findAllByType(View)
            .find(node => flattenStyle(node.props.style).flex === 1);

        expect(flattenStyle(content?.props.style)).toMatchObject({
            flex: 1,
            minWidth: 0,
            flexShrink: 1,
        });
    });

    it("当前值与控件都受百分比限宽约束，不使用固定像素", () => {
        const renderer = renderRow();

        const styles = renderer.root
            .findAllByType(View)
            .map(node => flattenStyle(node.props.style))
            .concat(
                renderer.root
                    .findAllByType(Text)
                    .map(node => flattenStyle(node.props.style)),
            );

        const limited = styles.filter(
            item => item.maxWidth === settingsLayout.valueMaxWidth,
        );

        // 值文本 + 控件槽各一处
        expect(limited).toHaveLength(2);
        expect(limited.every(item => typeof item.maxWidth === "string")).toBe(
            true,
        );
        expect(
            limited.some(item => item.flexShrink === 1) &&
                limited.some(item => item.flexShrink === 0),
        ).toBe(true);
    });

    it("行内边距统一取自布局令牌", () => {
        const renderer = renderRow();

        const row = renderer.root.findAllByType(View)[0];
        expect(flattenStyle(row.props.style).paddingHorizontal).toBe(
            settingsLayout.rowPadding,
        );
    });

    it("没有传 showChevron 时不渲染层级箭头", () => {
        let renderer: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(<SettingRow title="标题" />);
        });

        expect(
            renderer!.root.findAllByProps({ name: "chevron-right" }),
        ).toHaveLength(0);
    });

    it("说明文字默认单行，descriptionLines 可放宽行数", () => {
        const DESC = "一段很长的说明文字";
        let renderer: TestRenderer.ReactTestRenderer;

        const descriptionNode = () =>
            renderer!.root
                .findAllByType(Text)
                .find(node => node.props.children === DESC);

        act(() => {
            renderer = TestRenderer.create(
                <SettingRow title="标题" description={DESC} />,
            );
        });
        expect(descriptionNode()?.props.numberOfLines).toBe(1);

        act(() => {
            renderer = TestRenderer.create(
                <SettingRow
                    title="标题"
                    description={DESC}
                    descriptionLines={3}
                />,
            );
        });
        expect(descriptionNode()?.props.numberOfLines).toBe(3);
    });
});
