import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import SourceTabs from "./sourceTabs";

const mockScroll = jest.fn();
jest.mock("@/hooks/useColors", () => () => ({ active: "blue", textSecondary: "gray" }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: key => key }) }));
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("react-native/Libraries/Components/ScrollView/ScrollView", () => {
    const R = require("react");
    return { __esModule: true, default: R.forwardRef((props, ref) => {
        R.useImperativeHandle(ref, () => ({ scrollTo: mockScroll }));
        return R.createElement("SourceScroll", props, props.children);
    }) };
});

it("makes overflowing sources reachable and reveals the selected source after a tab swipe", () => {
    const routes = [{ key: "all", title: "全部" }, { key: "a", title: "QQ音乐" }, { key: "b", title: "小狗音乐" }];
    const select = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<SourceTabs routes={routes} index={0} onIndexChange={select} />);
    });
    const scroll = () => renderer.root.findByType("SourceScroll" as any);
    const tabs = () => renderer.root.findAll(node => typeof node.props.onPress === "function").filter(node => node.props.accessibilityRole === "tab");
    act(() => {
        renderer.root.findAll(node => typeof node.props.onLayout === "function")[0].props.onLayout({ nativeEvent: { layout: { width: 204 } } });
        scroll().props.onLayout({ nativeEvent: { layout: { width: 160 } } });
        scroll().props.onContentSizeChange(300);
        tabs().forEach((tab, index) => tab.props.onLayout({ nativeEvent: { layout: { x: index * 100, width: 100 } } }));
    });
    act(() => renderer.root.findAll(node => typeof node.props.onPress === "function").find(node => node.props.accessibilityLabel === "aggregate.moreSources")!.props.onPress());
    expect(mockScroll).toHaveBeenLastCalledWith({ x: 128, animated: false });
    act(() => renderer.update(<SourceTabs routes={routes} index={2} onIndexChange={select} />));
    expect(mockScroll).toHaveBeenLastCalledWith({ x: 140, animated: false });
    act(() => tabs()[1].props.onPress());
    expect(select).toHaveBeenCalledWith(1);
    act(() => scroll().props.onScroll({ nativeEvent: { contentOffset: { x: 140 } } }));
    act(() => renderer.root.findAll(node => typeof node.props.onPress === "function").find(node => node.props.accessibilityLabel === "aggregate.moreSources")!.props.onPress());
    expect(mockScroll).toHaveBeenLastCalledWith({ x: 0, animated: false });
    act(() => scroll().props.onContentSizeChange(180));
    expect(renderer.root.findAll(node => node.props.accessibilityLabel === "aggregate.moreSources")).toHaveLength(0);
    act(() => renderer.unmount());
});
