import React from "react";
import { DeviceEventEmitter, Modal } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import PanelBase from "./panelBase";
import { panelInfoStore } from "../usePanel";

const mockAnimations: Array<{ target: number; complete?: (finished: boolean) => void }> = [];
const mockJSQueue: Array<() => void> = [];

jest.mock("react-native-reanimated", () => ({
    __esModule: true,
    default: { View: "AnimatedView" },
    useSharedValue: (value: number) => require("react").useRef({ value }).current,
    useAnimatedStyle: () => ({}),
    runOnJS: (callback: (...args: any[]) => void) => (...args: any[]) => {
        mockJSQueue.push(() => callback(...args));
    },
}));
jest.mock("@/hooks/useMotion", () => () => ({
    timing: (target: number, _options: unknown, complete?: (finished: boolean) => void) => {
        mockAnimations.push({ target, complete });
        return target;
    },
}));
jest.mock("@/hooks/useColors", () => () => ({}));
jest.mock("@/hooks/useOrientation", () => () => "vertical");
jest.mock("@react-navigation/native", () => ({ useTheme: () => ({ dark: false }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock("@/core/appConfig", () => ({ __esModule: true, default: { getConfig: () => undefined } }));
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value / 2, vh: () => 400 }));
jest.mock("@/utils/motion", () => ({ KEYBOARD_TIMING: {} }));
jest.mock("../usePanel", () => ({ panelInfoStore: { setValue: jest.fn() } }));

describe("panel content readiness", () => {
    const renderers: TestRenderer.ReactTestRenderer[] = [];

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        mockAnimations.length = 0;
        mockJSQueue.length = 0;
    });

    afterEach(() => {
        act(() => renderers.splice(0).forEach(renderer => renderer.unmount()));
        jest.useRealTimers();
    });

    function render() {
        const renderContent = jest.fn(() => null);
        function Content() {
            return renderContent();
        }
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<PanelBase renderBody={loading => loading ? null : <Content />} />);
        });
        renderers.push(renderer);
        return {
            renderer,
            renderContent,
            show: () => act(() => renderer.root.findByType(Modal).props.onShow?.()),
            close: () => act(() => DeviceEventEmitter.emit("hidePanel")),
        };
    }

    function flushJS() {
        act(() => mockJSQueue.splice(0).forEach(callback => callback()));
    }

    it("starts in the visible modal and waits for animation completion, regardless of elapsed time", () => {
        const panel = render();
        expect(mockAnimations).toHaveLength(0);
        panel.show();
        panel.show();
        expect(mockAnimations.map(animation => animation.target)).toEqual([1]);
        act(() => jest.advanceTimersByTime(1000));
        expect(panel.renderContent).not.toHaveBeenCalled();
        act(() => mockAnimations[0].complete?.(true));
        expect(panel.renderContent).not.toHaveBeenCalled();
        flushJS();
        expect(panel.renderContent).toHaveBeenCalledTimes(1);
    });

    it("does not mount list content when opening is interrupted by closing", () => {
        const panel = render();
        panel.show();
        panel.close();
        act(() => mockAnimations[0].complete?.(false));
        act(() => jest.advanceTimersByTime(1000));
        flushJS();
        expect(panel.renderContent).not.toHaveBeenCalled();
        act(() => mockAnimations[1].complete?.(true));
        flushJS();
        expect(panelInfoStore.setValue).toHaveBeenCalledWith({ name: null, payload: null });
    });

    it("ignores a queued completion after close starts or after unmount", () => {
        const closing = render();
        closing.show();
        act(() => mockAnimations[0].complete?.(true));
        closing.close();
        flushJS();
        expect(closing.renderContent).not.toHaveBeenCalled();

        const unmounted = render();
        unmounted.show();
        act(() => mockAnimations[2].complete?.(true));
        act(() => unmounted.renderer.unmount());
        flushJS();
        expect(unmounted.renderContent).not.toHaveBeenCalled();
    });

    it("opens normally after a previous panel unmounts", () => {
        const first = render();
        first.show();
        act(() => first.renderer.unmount());
        const next = render();
        next.show();
        act(() => mockAnimations[1].complete?.(true));
        flushJS();
        expect(next.renderContent).toHaveBeenCalledTimes(1);
    });
});
