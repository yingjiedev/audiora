import React from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { cancelAnimation } from "react-native-reanimated";
import {
    cancelPlayerTransitionCollapse,
    collapsePlayerTransition,
    expandPlayerTransition,
} from "@/core/playerTransition";
import MusicDetail from "./index";
import NavBar from "./components/navBar";

jest.mock("@/hooks/useColors", () => () => {
    const { lightColors } = require("@/constants/colorPalette");
    return require("@/utils/themeColors").resolveThemeColors({ ...lightColors, background: "transparent" }, false);
});

const mockProgress = { value: 0 };
const mockDismissProgress = { value: 0 };
let mockReduceMotion = false;
let mockGesture: Record<string, jest.Mock>;
let mockBackPress: () => boolean | null | undefined;
let mockRemoval: (() => void) | undefined;
let mockOrientation = "vertical";
let mockWindow = { width: 390, height: 1334, scale: 1, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({ __esModule: true, default: () => mockWindow }));
let mockTab = "album";
let mockReaction: {
    prepare: () => number;
    react: (value: number, previous: number | null) => void;
    previous: number | null;
} | undefined;
let renderers: TestRenderer.ReactTestRenderer[] = [];

jest.mock("react-native-reanimated", () => {
    const ReactMock = require("react");
    return {
        __esModule: true,
        default: { View: require("react-native").View },
        cancelAnimation: jest.fn(),
        Extrapolation: { CLAMP: "clamp" },
        interpolate: (value: number) => value,
        runOnJS: (callback: Function) => callback,
        useAnimatedStyle: (callback: Function) => callback(),
        useDerivedValue: (callback: () => number) => {
            return ReactMock.useRef({
                get value() {
                    return callback();
                },
            }).current;
        },
        useAnimatedReaction: (
            prepare: () => number,
            react: (value: number, previous: number | null) => void,
        ) => {
            mockReaction = { prepare, react, previous: mockReaction?.previous ?? null };
        },
        useSharedValue: (value: unknown) => ReactMock.useRef({ value }).current,
    };
});
jest.mock("react-native-gesture-handler", () => ({
    GestureDetector: "GestureDetector",
    Gesture: {
        Pan: () => {
            mockGesture = {};
            for (const name of [
                "enabled",
                "minPointers",
                "maxPointers",
                "activeOffsetY",
                "failOffsetX",
                "onBegin",
                "onStart",
                "onUpdate",
                "onEnd",
                "onFinalize",
            ]) {
                mockGesture[name] = jest.fn(() => mockGesture);
            }
            return mockGesture;
        },
    },
}));
jest.mock("react-native-safe-area-context", () => ({
    SafeAreaView: "SafeAreaView",
}));
jest.mock("expo-keep-awake", () => ({
    activateKeepAwakeAsync: jest.fn(),
    deactivateKeepAwake: jest.fn(),
}));
jest.mock("@/hooks/useOrientation", () => () => mockOrientation);
jest.mock("@/hooks/useMotion", () => () => ({ reduceMotion: mockReduceMotion }));
jest.mock("@/core/appConfig", () => ({
    __esModule: true,
    default: {
        getConfig: (key: string) =>
            key === "basic.musicDetailDefault" ? mockTab : false,
    },
    useAppConfig: () => undefined,
}));
jest.mock("@/core/playerTransition", () => ({
    playerTransition: () => ({ progress: mockProgress, dismissProgress: mockDismissProgress }),
    expandPlayerTransition: jest.fn(),
    resetPlayerTransition: jest.fn(),
    cancelPlayerTransitionCollapse: jest.fn(),
    collapsePlayerTransition: jest.fn((callback: () => void) => {
        mockRemoval = callback;
    }),
}));
jest.mock("@/components/base/statusBar", () => "StatusBar");
jest.mock("./components/background", () => "Background");
jest.mock("./components/bottom", () => "Bottom");
jest.mock("./components/content", () => "Content");
jest.mock("./components/content/lyric", () => "Lyric");
jest.mock("@/components/appShell/playbackPane", () => "PlaybackPane");
jest.mock("./components/navBar", () => "NavBar");

function gestureCallback(name: string) {
    return mockGesture[name].mock.calls[0]?.[0] as Function | undefined;
}

function render(onClose = jest.fn()) {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<MusicDetail onClose={onClose} />);
    });
    renderers.push(renderer!);
    return { renderer: renderer!, onClose };
}

function flushVisibility() {
    act(() => {
        const value = mockReaction!.prepare();
        mockReaction!.react(value, mockReaction!.previous);
        mockReaction!.previous = value;
    });
}

function contentView(renderer: TestRenderer.ReactTestRenderer) {
    return renderer.root.findAllByType(View)
        .find(node => node.props.accessibilityElementsHidden !== undefined)!;
}

describe("full player input lifecycle", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        mockProgress.value = 0;
        mockDismissProgress.value = 0;
        mockReduceMotion = false;
        mockRemoval = undefined;
        mockOrientation = "vertical";
        mockWindow = { width: 390, height: 1334, scale: 1, fontScale: 1 };
        mockTab = "album";
        mockReaction = undefined;
        renderers = [];
        jest.spyOn(BackHandler, "addEventListener").mockImplementation(
            (_event, callback) => {
                mockBackPress = callback as () => boolean;
                return { remove: jest.fn() };
            },
        );
    });

    afterEach(() => {
        act(() => renderers.forEach(renderer => renderer.unmount()));
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it("keeps the opening animation running for a tap that never becomes a drag", () => {
        const { renderer } = render();
        expect(expandPlayerTransition).toHaveBeenCalledTimes(1);
        act(() => {
            gestureCallback("onBegin")?.();
            gestureCallback("onFinalize")?.({}, false);
        });
        expect(cancelAnimation).not.toHaveBeenCalled();
        expect(cancelPlayerTransitionCollapse).not.toHaveBeenCalled();
        act(() => renderer.unmount());
    });

    it("compiles all gesture callbacks for the UI runtime", () => {
        const { renderer } = render();
        for (const name of ["onStart", "onUpdate", "onEnd", "onFinalize"]) {
            expect((gestureCallback(name) as Function & { __workletHash?: number }).__workletHash).toBeDefined();
        }
        act(() => renderer.unmount());
    });

    it("starts entry even when JS still sees the value before UI preparation", () => {
        mockProgress.value = 1;
        render();
        expect(expandPlayerTransition).toHaveBeenCalledWith({ reduceMotion: false });
    });

    it("starts the entire background and controls below the screen, then slides them up together", () => {
        const { renderer, onClose } = render();
        const page = renderer.root.findAllByType(View)
            .find(node => node.props.needsOffscreenAlphaCompositing)!;
        const initial = StyleSheet.flatten(page.props.style);
        expect(initial.opacity).toBe(0);
        expect(initial.transform[0].translateY).toBeGreaterThan(0);
        expect(StyleSheet.flatten(contentView(renderer).props.style).opacity).toBeUndefined();
        expect(page.findAllByType(NavBar)).toHaveLength(1);
        mockProgress.value = 0.5;
        act(() => renderer.update(<MusicDetail onClose={onClose} />));
        const middle = StyleSheet.flatten(page.props.style);
        expect(middle.transform[0].translateY).toBeCloseTo(initial.transform[0].translateY / 2);
        mockProgress.value = 1;
        flushVisibility();
        expect(StyleSheet.flatten(page.props.style)).toMatchObject({
            opacity: 1, transform: [{ translateY: 0 }],
        });
    });

    it("closes a partially opened page from its current position without snapping to full screen", () => {
        mockProgress.value = 0.4;
        const { renderer, onClose } = render();
        const page = renderer.root.findAllByType(View)
            .find(node => node.props.needsOffscreenAlphaCompositing)!;
        const initialY = StyleSheet.flatten(page.props.style).transform[0].translateY;
        act(() => renderer.root.findByType(NavBar).props.onBack());
        expect(StyleSheet.flatten(page.props.style).transform[0].translateY).toBe(initialY);
        mockDismissProgress.value = 0.5;
        act(() => renderer.update(<MusicDetail onClose={onClose} />));
        expect(StyleSheet.flatten(page.props.style).transform[0].translateY).toBeGreaterThan(initialY);
        expect(onClose).not.toHaveBeenCalled();
    });

    it("restores the player when an active drag is cancelled even beyond the dismiss threshold", () => {
        const { renderer, onClose } = render();
        act(() => {
            gestureCallback("onStart")?.();
            gestureCallback("onUpdate")?.({ translationY: 500 });
            gestureCallback("onEnd")?.(
                { translationY: 500, velocityY: 2000 },
                false,
            );
            gestureCallback("onFinalize")?.({}, false);
        });
        expect(cancelPlayerTransitionCollapse).toHaveBeenCalledTimes(1);
        expect(cancelPlayerTransitionCollapse).toHaveBeenCalledWith({
            reduceMotion: false,
            velocity: 0,
        });
        expect(collapsePlayerTransition).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
        act(() => renderer.unmount());
    });

    it("recovers an interrupted active gesture that only reaches finalization", () => {
        const { renderer } = render();
        act(() => {
            gestureCallback("onStart")?.();
            gestureCallback("onFinalize")?.({}, false);
            gestureCallback("onFinalize")?.({}, false);
        });
        expect(cancelPlayerTransitionCollapse).toHaveBeenCalledTimes(1);
        act(() => renderer.unmount());
    });

    it("disables fading controls and ignores stale drag events while closing", () => {
        const { renderer, onClose } = render();
        const start = gestureCallback("onStart");
        const update = gestureCallback("onUpdate");
        const end = gestureCallback("onEnd");
        const finalize = gestureCallback("onFinalize");
        act(() => start?.());
        act(() => renderer.root.findByType(NavBar).props.onBack());
        expect(
            renderer.root
                .findAllByType(View)
                .some(
                    node =>
                        node.props.collapsable === false &&
                        StyleSheet.flatten(node.props.style).pointerEvents === "none",
                ),
        ).toBe(true);
        mockProgress.value = 0.1;
        act(() => {
            start?.();
            update?.({ translationY: 50 });
            end?.({ translationY: 50, velocityY: 0 }, true);
            finalize?.({}, false);
        });
        expect(mockProgress.value).toBe(0.1);
        expect(mockDismissProgress.value).toBe(0);
        expect(cancelAnimation).toHaveBeenCalledTimes(1);
        expect(cancelPlayerTransitionCollapse).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
        act(() => mockRemoval?.());
        expect(onClose).toHaveBeenCalledTimes(1);
        act(() => renderer.unmount());
    });

    it("removes once after repeated Back presses and a late animation completion", () => {
        const { renderer, onClose } = render();
        act(() => {
            mockBackPress();
            mockBackPress();
        });
        expect(onClose).not.toHaveBeenCalled();
        expect(collapsePlayerTransition).toHaveBeenCalledTimes(1);
        act(() => jest.advanceTimersByTime(900));
        expect(onClose).toHaveBeenCalledTimes(1);
        act(() => mockRemoval?.());
        expect(onClose).toHaveBeenCalledTimes(1);
        act(() => renderer.unmount());
    });

    it("dismisses a completed downward drag and clears the close watchdog", () => {
        const { renderer, onClose } = render();
        act(() => {
            gestureCallback("onStart")?.();
            gestureCallback("onEnd")?.(
                { translationY: 500, velocityY: 2000 },
                true,
            );
        });
        expect(collapsePlayerTransition).toHaveBeenCalledTimes(1);
        act(() => mockRemoval?.());
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
        act(() => jest.advanceTimersByTime(1000));
        expect(onClose).toHaveBeenCalledTimes(1);
        act(() => renderer.unmount());
    });

    it("ignores a previous player's queued completion after unmount", () => {
        const { renderer, onClose } = render();
        act(() => {
            mockBackPress();
        });
        const oldRemoval = mockRemoval;
        const oldEnd = gestureCallback("onEnd");
        act(() => renderer.unmount());
        mockProgress.value = 1;
        const next = render();
        act(() => {
            oldRemoval?.();
            oldEnd?.({ translationY: 0, velocityY: 0 }, true);
            jest.advanceTimersByTime(1000);
        });
        expect(onClose).not.toHaveBeenCalled();
        expect(next.onClose).not.toHaveBeenCalled();
        expect(cancelPlayerTransitionCollapse).not.toHaveBeenCalled();
        act(() => next.renderer.unmount());
    });

    it("makes transparent controls untouchable and removes an opening animation stuck at zero", () => {
        const { renderer, onClose } = render();
        expect(StyleSheet.flatten(contentView(renderer).props.style).pointerEvents).toBe("none");
        expect(contentView(renderer).props.accessibilityElementsHidden).toBe(true);
        expect((mockReaction!.prepare as Function & { __workletHash?: number }).__workletHash).toBeDefined();
        expect((mockReaction!.react as Function & { __workletHash?: number }).__workletHash).toBeDefined();
        act(() => jest.advanceTimersByTime(899));
        expect(onClose).not.toHaveBeenCalled();
        act(() => jest.advanceTimersByTime(1));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("cancels recovery when the opening animation makes the controls visible", () => {
        const { renderer, onClose } = render();
        mockProgress.value = 1;
        flushVisibility();
        expect(StyleSheet.flatten(contentView(renderer).props.style).pointerEvents).toBe("auto");
        expect(contentView(renderer).props.accessibilityElementsHidden).toBe(false);
        act(() => jest.advanceTimersByTime(1000));
        expect(onClose).not.toHaveBeenCalled();
    });

    it("removes a previously visible player that becomes transparent without requesting exit", () => {
        mockProgress.value = 1;
        const { renderer, onClose } = render();
        flushVisibility();
        mockProgress.value = 0;
        flushVisibility();
        expect(StyleSheet.flatten(contentView(renderer).props.style).pointerEvents).toBe("none");
        act(() => jest.advanceTimersByTime(900));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(collapsePlayerTransition).not.toHaveBeenCalled();
    });

    it("keeps an active drag mounted even when held fully collapsed", () => {
        mockProgress.value = 1;
        const { renderer, onClose } = render();
        act(() => {
            gestureCallback("onStart")?.();
            gestureCallback("onUpdate")?.({ translationY: 2000 });
        });
        flushVisibility();
        expect(mockProgress.value).toBe(1);
        expect(mockDismissProgress.value).toBe(1);
        expect(StyleSheet.flatten(contentView(renderer).props.style).pointerEvents).toBe("auto");
        act(() => jest.advanceTimersByTime(1500));
        expect(onClose).not.toHaveBeenCalled();
        act(() => gestureCallback("onEnd")?.({ translationY: 2000, velocityY: 0 }, false));
        flushVisibility();
        act(() => jest.advanceTimersByTime(450));
        mockDismissProgress.value = 0;
        flushVisibility();
        act(() => jest.advanceTimersByTime(1000));
        expect(onClose).not.toHaveBeenCalled();
        expect(cancelPlayerTransitionCollapse).toHaveBeenCalledTimes(1);
    });

    it("moves one page containing both background and controls without removing immersive art early", () => {
        mockProgress.value = 1;
        mockDismissProgress.value = 0.2;
        const { renderer, onClose } = render();
        const page = renderer.root.findAllByType(View)
            .find(node => node.props.needsOffscreenAlphaCompositing)!;
        const presentation = StyleSheet.flatten(page.props.style);
        expect(presentation.opacity).toBe(1);
        expect(presentation.transform[0].translateY).toBeGreaterThan(0);
        expect(page.findByType("Background" as React.ElementType).props.renderImmersiveCover).toBe(true);
        expect(page.findAllByType(NavBar)).toHaveLength(1);
        expect(page.findAllByType("Content" as React.ElementType)).toHaveLength(1);
        expect(page.props.renderToHardwareTextureAndroid).toBe(false);
        act(() => renderer.root.findByType(NavBar).props.onBack());
        expect(page.findByType("Background" as React.ElementType).props.renderImmersiveCover).toBe(true);
        expect(page.props.renderToHardwareTextureAndroid).toBe(true);
        expect(mockProgress.value).toBe(1);
        expect(onClose).not.toHaveBeenCalled();
    });

    it("uses a stationary whole-page fade under Reduce Motion", () => {
        mockProgress.value = 1;
        mockDismissProgress.value = 0.5;
        mockReduceMotion = true;
        const { renderer } = render();
        const page = renderer.root.findAllByType(View)
            .find(node => node.props.needsOffscreenAlphaCompositing)!;
        expect(StyleSheet.flatten(page.props.style)).toMatchObject({
            opacity: 0.5,
            transform: [{ translateY: 0 }],
        });
        act(() => renderer.root.findByType(NavBar).props.onBack());
        expect(collapsePlayerTransition).toHaveBeenCalledWith(expect.any(Function), { reduceMotion: true });
    });

    it("follows the finger and preserves the cover's entrance progress", () => {
        mockProgress.value = 1;
        render();
        act(() => {
            gestureCallback("onStart")?.();
            gestureCallback("onUpdate")?.({ translationY: 80 });
        });
        expect(mockDismissProgress.value).toBeGreaterThan(0);
        expect(mockDismissProgress.value).toBeLessThan(1);
        expect(mockProgress.value).toBe(1);
    });

    it("rechecks current UI values before a delayed visibility reaction arrives", () => {
        const { onClose } = render();
        mockProgress.value = 1;
        act(() => jest.advanceTimersByTime(1000));
        expect(onClose).not.toHaveBeenCalled();
    });

    it("ignores a queued visibility reaction after the player unmounts", () => {
        const { renderer, onClose } = render();
        const oldReaction = mockReaction!;
        act(() => renderer.unmount());
        mockProgress.value = 1;
        const next = render();
        act(() => {
            oldReaction.react(2, 1);
            jest.advanceTimersByTime(1000);
        });
        expect(onClose).not.toHaveBeenCalled();
        expect(next.onClose).not.toHaveBeenCalled();
    });

    it("uses the wide player in a portrait tablet window without changing device orientation", () => {
        mockWindow = { ...mockWindow, width: 900, height: 1200 };
        const { renderer } = render();
        expect(renderer.root.findAllByType("PlaybackPane" as React.ElementType)).toHaveLength(1);
        expect(renderer.root.findByType("Background" as React.ElementType).props.immersiveCoverEnabled).toBe(false);
        expect(mockGesture.enabled).toHaveBeenCalledWith(false);
    });

    it.each([
        ["vertical", "lyric"],
        ["horizontal", "album"],
    ])(
        "leaves %s / %s interactions outside drag dismissal",
        (orientation, tab) => {
            mockOrientation = orientation;
            mockTab = tab;
            const { renderer } = render();
            expect(mockGesture.enabled).toHaveBeenCalledWith(false);
            act(() => renderer.unmount());
        },
    );
});
