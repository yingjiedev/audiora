import React from "react";
import { AppState, AppStateStatus } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { cancelAnimation, withRepeat, withTiming } from "react-native-reanimated";
import MarqueeText from "./marqueeText";

let mockReducedMotion = false;
let mockAppStateChanged: (state: AppStateStatus) => void;
const mockOffset = { value: 0 as unknown };

jest.mock("./themeText", () => "ThemeText");
jest.mock("@/hooks/useMotion", () => () => ({
    reduceMotion: mockReducedMotion,
    duration: () => 360,
}));
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value / 2 }));
jest.mock("react-native-reanimated", () => ({
    __esModule: true,
    default: { View: "AnimatedView" },
    Easing: { linear: (value: number) => value },
    useSharedValue: () => mockOffset,
    useAnimatedStyle: (factory: () => unknown) => factory(),
    cancelAnimation: jest.fn(),
    runOnUI: (callback: () => void) => callback,
    withTiming: jest.fn((toValue: number, config: unknown) => ({ toValue, config })),
    withDelay: jest.fn((delay: number, animation: unknown) => ({ delay, animation })),
    withRepeat: jest.fn((animation: unknown) => ({ animation })),
}));

const label = "A long song title · Artist";

function render(text = label, active = true) {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<MarqueeText text={text} active={active} />);
    });
    return renderer!;
}

function measure(renderer: TestRenderer.ReactTestRenderer, id: string, width: number) {
    const view = renderer.root.findAllByProps({ testID: id })
        .find(node => typeof node.props.onLayout === "function")!;
    act(() => view.props.onLayout({ nativeEvent: { layout: { width } } }));
}

describe("MarqueeText", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockOffset.value = 0;
        mockReducedMotion = false;
        AppState.currentState = "active";
        jest.spyOn(AppState, "addEventListener").mockImplementation((_event, callback) => {
            mockAppStateChanged = callback as (state: AppStateStatus) => void;
            return { remove: jest.fn() };
        });
    });

    afterEach(() => jest.restoreAllMocks());

    it("starts only after valid overflow measurements and stops when the text fits", () => {
        const renderer = render();
        measure(renderer, "marquee-text-viewport", Number.NaN);
        measure(renderer, "marquee-text-content", Number.POSITIVE_INFINITY);
        measure(renderer, "marquee-text-content", 300);
        expect(withRepeat).not.toHaveBeenCalled();
        measure(renderer, "marquee-text-viewport", 120);
        expect(withRepeat).toHaveBeenCalledTimes(1);
        expect(withTiming).toHaveBeenCalledWith(expect.any(Number), expect.objectContaining({ duration: expect.any(Number) }));
        measure(renderer, "marquee-text-viewport", 350);
        expect(mockOffset.value).toBe(0);
        expect(withRepeat).toHaveBeenCalledTimes(1);
        expect(cancelAnimation).toHaveBeenCalled();
    });

    it("remeasures a new label and ignores late layout events from the previous label", () => {
        const renderer = render();
        measure(renderer, "marquee-text-viewport", 120);
        measure(renderer, "marquee-text-content", 300);
        const oldMeasure = renderer.root.findByProps({ testID: "marquee-text-content" }).props.onLayout;
        act(() => renderer.update(<MarqueeText text="Another long song · Another artist" />));
        expect(mockOffset.value).toBe(0);
        expect(withRepeat).toHaveBeenCalledTimes(1);
        measure(renderer, "marquee-text-content", 300);
        expect(withRepeat).toHaveBeenCalledTimes(2);
        act(() => oldMeasure({ nativeEvent: { layout: { width: 500 } } }));
        expect(withRepeat).toHaveBeenCalledTimes(2);
        expect(mockOffset.value).not.toBe(0);
    });

    it("keeps offscreen items and reduced-motion text static", () => {
        const renderer = render(label, false);
        measure(renderer, "marquee-text-viewport", 120);
        measure(renderer, "marquee-text-content", 300);
        expect(withRepeat).not.toHaveBeenCalled();
        mockReducedMotion = true;
        act(() => renderer.update(<MarqueeText text={label} />));
        expect(withRepeat).not.toHaveBeenCalled();
        expect(mockOffset.value).toBe(0);
        mockReducedMotion = false;
        act(() => renderer.update(<MarqueeText text={label} />));
        expect(withRepeat).toHaveBeenCalledTimes(1);
    });

    it("pauses in the background, restarts in the foreground and cancels on unmount", () => {
        const renderer = render();
        measure(renderer, "marquee-text-viewport", 120);
        measure(renderer, "marquee-text-content", 300);
        act(() => mockAppStateChanged("background"));
        expect(mockOffset.value).toBe(0);
        expect(withRepeat).toHaveBeenCalledTimes(1);
        act(() => mockAppStateChanged("active"));
        expect(withRepeat).toHaveBeenCalledTimes(2);
        (cancelAnimation as jest.Mock).mockClear();
        act(() => renderer.unmount());
        expect(cancelAnimation).toHaveBeenCalledTimes(1);
        expect(mockOffset.value).toBe(0);
    });
});
