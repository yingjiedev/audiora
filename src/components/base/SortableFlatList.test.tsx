import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import SortableFlatList from "./SortableFlatList";

const mockScrollToOffset = jest.fn();
const data = Array.from({ length: 20 }, (_, id) => ({ id }));

jest.mock("@shopify/flash-list", () => {
    const ReactModule = require("react");
    return {
        FlashList: ReactModule.forwardRef((props: any, ref: any) => {
            ReactModule.useImperativeHandle(ref, () => ({ scrollToOffset: mockScrollToOffset }));
            return ReactModule.createElement("FlashList", props,
                props.data.map((item: { id: number }, index: number) =>
                    ReactModule.createElement(ReactModule.Fragment, { key: item.id }, props.renderItem({ item, index })),
                ),
            );
        }),
    };
});
jest.mock("@/constants/globalStyle", () => ({ fwflex1: { flex: 1 } }));
jest.mock("@/constants/uiConst", () => ({ iconSizeConst: { normal: 24 } }));
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/hooks/useTextColor", () => () => "black");
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value / 2 }));

function render(initialOffset = 100) {
    let renderer!: TestRenderer.ReactTestRenderer;
    const onSortEnd = jest.fn();
    act(() => {
        renderer = TestRenderer.create(
            <SortableFlatList data={data} itemHeight={50} renderItem={() => <React.Fragment />} onSortEnd={onSortEnd} />,
            { createNodeMock: () => ({ setNativeProps: jest.fn() }) },
        );
    });
    const list = () => renderer.root.findByType("FlashList" as any);
    act(() => {
        list().props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 240, height: 300 } } });
        list().props.onScroll({ nativeEvent: { contentOffset: { y: initialOffset } } });
    });
    const start = () => act(() => {
        const handles = renderer.root.findAll(node => typeof node.props.onTouchStart === "function" && !node.props.onTouchMove);
        handles[0].props.onTouchStart();
        list().props.onTouchStart({ nativeEvent: { pageY: 150, locationY: 20 } });
    });
    const move = (pageY: number) => act(() => list().props.onTouchMove({ nativeEvent: { pageY } }));
    const scroll = (y: number) => act(() => list().props.onScroll({ nativeEvent: { contentOffset: { y } } }));
    return { renderer, list, start, move, scroll, onSortEnd };
}

describe("sortable list scrolling", () => {
    beforeEach(() => mockScrollToOffset.mockClear());

    it("starts edge scrolling on RN and waits for the current scroll before continuing", () => {
        const { renderer, start, move, scroll } = render();
        start();
        move(280);
        expect(mockScrollToOffset.mock.calls).toEqual([[{ animated: true, offset: 400 }]]);
        move(285);
        expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
        scroll(400);
        expect(mockScrollToOffset).toHaveBeenLastCalledWith({ animated: true, offset: 700 });
        expect(mockScrollToOffset).toHaveBeenCalledTimes(2);
        act(() => renderer.unmount());
    });

    it.each(["onTouchEnd", "onTouchCancel"])("stops edge scrolling after %s", finish => {
        const { renderer, list, start, move, scroll } = render();
        start();
        move(280);
        act(() => list().props[finish]({ nativeEvent: { pageY: 280 } }));
        scroll(400);
        move(280);
        expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
        expect(list().props.scrollEnabled).toBe(true);
        act(() => renderer.unmount());
    });

    it("allows another drag after cancellation without retaining the old direction or scroll guard", () => {
        const { renderer, list, start, move, scroll } = render();
        start();
        move(280);
        act(() => list().props.onTouchCancel());
        scroll(100);
        start();
        move(20);
        expect(mockScrollToOffset).toHaveBeenLastCalledWith({ animated: true, offset: 0 });
        expect(mockScrollToOffset).toHaveBeenCalledTimes(2);
        scroll(0);
        expect(mockScrollToOffset).toHaveBeenCalledTimes(2);
        act(() => renderer.unmount());
    });

    it("ignores movement without an active drag and clamps auto scrolling at the lower boundary", () => {
        const { renderer, start, move, scroll } = render(650);
        move(280);
        expect(mockScrollToOffset).not.toHaveBeenCalled();
        start();
        move(280);
        expect(mockScrollToOffset).toHaveBeenLastCalledWith({ animated: true, offset: 700 });
        scroll(700);
        expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
        act(() => renderer.unmount());
    });
});
