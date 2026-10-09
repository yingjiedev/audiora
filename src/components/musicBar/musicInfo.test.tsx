import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { GestureDetector } from "react-native-gesture-handler";
import TrackPlayer from "@/core/trackPlayer";
import { armPlayerTransition } from "@/core/playerTransition";
import { openPlayer } from "@/core/playerOverlay";
import MusicInfo from "./musicInfo";

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
jest.mock("@/core/playerOverlay", () => ({ openPlayer: jest.fn() }));
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
            runOnJS: () => chain,
        };
        return chain;
    }
    return {
        GestureDetector: "GestureDetector",
        Gesture: { Tap: gesture, Pan: gesture, Race: (pan: unknown, tap: unknown) => ({ pan, tap }) },
    };
});

function render(onPress?: () => void) {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<MusicInfo musicItem={song} onPress={onPress} />);
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
        expect(armPlayerTransition).toHaveBeenCalledTimes(1);
        expect(jest.mocked(armPlayerTransition).mock.invocationCallOrder[0])
            .toBeLessThan(jest.mocked(openPlayer).mock.invocationCallOrder[0]);
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
});
