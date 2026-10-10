import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { GestureDetector } from "react-native-gesture-handler";
import TrackPlayer from "@/core/trackPlayer";
import { armPlayerTransition } from "@/core/playerTransition";
import { openPlayer } from "@/core/playerOverlay";
import MusicInfo from "./musicInfo";
import MarqueeText from "@/components/base/marqueeText";

let mockUIRuntime = false;
let mockMeasuredFrame: { pageX: number; pageY: number; width: number; height: number } | null = null;
const mockTransitionOrigin = { value: null as { x: number; y: number; width: number; height: number } | null };
const song: IMusic.IMusicItem = {
    id: "song",
    platform: "test",
    title: "Song",
    artist: "Artist",
    duration: 210,
    album: "Album",
    artwork: "cover.jpg",
};

jest.mock("@/components/base/fastImage", () => "FastImage");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/marqueeText", () => "MarqueeText");
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: 1 } }));
jest.mock("@/hooks/useMotion", () => () => ({
    duration: () => 160,
    easing: () => (value: number) => value,
}));
jest.mock("@/core/playerTransition", () => ({
    armPlayerTransition: jest.fn(),
    playerTransition: () => {
        if (mockUIRuntime) {
            throw new Error("JS transition accessor called on the UI runtime");
        }
        return { origin: mockTransitionOrigin };
    },
}));
jest.mock("@/core/playerOverlay", () => ({
    openPlayer: jest.fn((prepare?: () => void) => prepare?.()),
}));
jest.mock("@/core/trackPlayer", () => ({
    __esModule: true,
    default: {
        previousMusic: null,
        nextMusic: null,
        skipToPrevious: jest.fn(),
        skipToNext: jest.fn(),
    },
}));
jest.mock("@/hooks/useColors", () => () => ({ text: "#10172D", musicBarText: "#10172D" }));
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value / 2 }));
jest.mock("@/utils/artwork", () => ({ resolveArtwork: () => undefined }));
jest.mock("@/utils/mediaExtra", () => ({ useMediaExtraProperty: jest.fn() }));
jest.mock("react-native-reanimated", () => ({
    __esModule: true,
    default: { View: "AnimatedView" },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedRef: () => ({ current: null }),
    measure: () => mockMeasuredFrame,
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (value: number, _config: unknown, callback?: () => void) => {
        callback?.();
        return value;
    },
    runOnJS: (callback: () => void) => callback,
    runOnUI: (callback: () => void) => () => {
        mockUIRuntime = true;
        try {
            callback();
        } finally {
            mockUIRuntime = false;
        }
    },
}));
jest.mock("react-native-gesture-handler", () => {
    function gesture() {
        const callbacks: Record<string, unknown> = {};
        const chain = {
            callbacks,
            onStart: (callback: unknown) => {
                callbacks.start = callback;
                return chain;
            },
            onUpdate: (callback: unknown) => {
                callbacks.update = callback;
                return chain;
            },
            onEnd: (callback: unknown) => {
                callbacks.end = callback;
                return chain;
            },
            minPointers: () => chain,
            maxPointers: () => chain,
            minDuration: () => chain,
            runOnJS: () => chain,
        };
        return chain;
    }
    return {
        GestureDetector: "GestureDetector",
        Gesture: {
            Tap: gesture, Pan: gesture, LongPress: gesture,
            Race: (pan: unknown, ...rest: unknown[]) => ({
                pan, tap: rest[rest.length - 1], longPress: rest.length > 1 ? rest[0] : undefined,
            }),
        },
    };
});

function render(onPress?: () => void, onExpand?: () => void) {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<MusicInfo musicItem={song} onPress={onPress} onExpand={onExpand} compact={!!onExpand} expandAccessibilityLabel="Expand player" />);
    });
    return renderer!;
}

describe("MusicInfo interactions", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUIRuntime = false;
        mockMeasuredFrame = null;
        mockTransitionOrigin.value = null;
    });

    it("updates the artwork frame on the UI runtime without calling the JS state accessor", () => {
        mockMeasuredFrame = { pageX: 12, pageY: 640, width: 40, height: 40 };
        const renderer = render();
        const artwork = renderer.root.findAll(node => node.props.collapsable === false && typeof node.props.onLayout === "function")[0];
        act(() => artwork.props.onLayout());
        expect(mockTransitionOrigin.value).toEqual({ x: 12, y: 640, width: 40, height: 40 });
    });

    it("keeps the full-player shortcut for existing music bars", () => {
        const renderer = render();
        act(() => renderer.root.findByType(GestureDetector).props.gesture.tap.callbacks.start());
        expect(openPlayer).toHaveBeenCalledTimes(1);
        expect(openPlayer).toHaveBeenCalledWith(armPlayerTransition);
        expect(armPlayerTransition).toHaveBeenCalledTimes(1);
    });

    it("shows the title and artist together in the active compact marquee", () => {
        const renderer = render(undefined, jest.fn());
        const marquee = renderer.root.findByType(MarqueeText);
        expect(marquee.props.text).toBe("Song · Artist");
        expect(marquee.props.active).toBe(true);
    });

    it("expands the new dock by tapping or activating with a screen reader", () => {
        const onPress = jest.fn();
        const renderer = render(onPress);
        act(() => renderer.root.findByType(GestureDetector).props.gesture.tap.callbacks.start());
        const button = renderer.root.findAllByProps({ accessibilityRole: "button" })
            .find(node => typeof node.props.onAccessibilityAction === "function")!;
        act(() => button.props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } }));
        expect(onPress).toHaveBeenCalledTimes(2);
        expect(openPlayer).not.toHaveBeenCalled();
        expect(armPlayerTransition).not.toHaveBeenCalled();
    });

    it("opens the full player through accessibility without a custom handler", () => {
        const renderer = render();
        const button = renderer.root.findAllByProps({ accessibilityRole: "button" })
            .find(node => typeof node.props.onAccessibilityAction === "function")!;
        act(() => button.props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } }));
        expect(openPlayer).toHaveBeenCalledWith(armPlayerTransition);
    });

    it("retains horizontal swipes to skip songs without expanding", () => {
        const onPress = jest.fn();
        const renderer = render(onPress);
        const info = renderer.root.findAll(node => typeof node.props.onLayout === "function")[0];
        act(() => info.props.onLayout({ nativeEvent: { layout: { width: 100 } } }));
        const pan = renderer.root.findByType(GestureDetector).props.gesture.pan;
        act(() => pan.callbacks.end({ translationX: 40, velocityX: 300 }, true));
        act(() => pan.callbacks.end({ translationX: -40, velocityX: -300 }, true));
        act(() => pan.callbacks.end({ translationX: 20, velocityX: 0 }, true));
        expect(TrackPlayer.skipToPrevious).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.skipToNext).toHaveBeenCalledTimes(1);
        expect(onPress).not.toHaveBeenCalled();
    });

    it("expands on upward swipe, hold and accessibility while keeping tap as the full-player shortcut", () => {
        const onExpand = jest.fn();
        const renderer = render(undefined, onExpand);
        const gesture = renderer.root.findByType(GestureDetector).props.gesture;
        act(() => gesture.pan.callbacks.end({ translationX: 2, translationY: -40, velocityX: 0 }, true));
        act(() => gesture.longPress.callbacks.start());
        const button = renderer.root.findAllByProps({ accessibilityRole: "button" })
            .find(node => typeof node.props.onAccessibilityAction === "function")!;
        expect(button.props.accessibilityActions).toContainEqual({ name: "expand", label: "Expand player" });
        act(() => button.props.onAccessibilityAction({ nativeEvent: { actionName: "expand" } }));
        expect(onExpand).toHaveBeenCalledTimes(3);
        expect(openPlayer).not.toHaveBeenCalled();
        expect(TrackPlayer.skipToNext).not.toHaveBeenCalled();
        expect(TrackPlayer.skipToPrevious).not.toHaveBeenCalled();
        act(() => gesture.tap.callbacks.start());
        expect(openPlayer).toHaveBeenCalledWith(armPlayerTransition);
        expect(onExpand).toHaveBeenCalledTimes(3);
    });

    it("ignores short, downward and cancelled vertical drags and retains horizontal skips in compact mode", () => {
        const onExpand = jest.fn();
        const renderer = render(undefined, onExpand);
        const info = renderer.root.findAll(node => typeof node.props.onLayout === "function")[0];
        act(() => info.props.onLayout({ nativeEvent: { layout: { width: 100 } } }));
        const pan = renderer.root.findByType(GestureDetector).props.gesture.pan;
        act(() => pan.callbacks.end({ translationX: 0, translationY: -20, velocityX: 0 }, true));
        act(() => pan.callbacks.end({ translationX: 0, translationY: 40, velocityX: 0 }, true));
        act(() => pan.callbacks.end({ translationX: 40, translationY: 80, velocityX: 1600 }, true));
        act(() => pan.callbacks.end({ translationX: 0, translationY: -40, velocityX: 0 }, false));
        act(() => pan.callbacks.end({ translationX: 40, translationY: -10, velocityX: 300 }, true));
        act(() => pan.callbacks.end({ translationX: -40, translationY: 10, velocityX: -300 }, true));
        expect(onExpand).not.toHaveBeenCalled();
        expect(openPlayer).not.toHaveBeenCalled();
        expect(TrackPlayer.skipToPrevious).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.skipToNext).toHaveBeenCalledTimes(1);
    });
});
