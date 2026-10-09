import React from "react";
import { BackHandler, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { cancelAnimation } from "react-native-reanimated";
import {
    cancelPlayerTransitionCollapse,
    collapsePlayerTransition,
    expandPlayerTransition,
} from "@/core/playerTransition";
import MusicDetail from "./index";
import NavBar from "./components/navBar";

const mockProgress = { value: 0 };
let mockGesture: Record<string, jest.Mock>;
let mockBackPress: () => boolean | null | undefined;
let mockRemoval: (() => void) | undefined;
let mockOrientation = "vertical";
let mockTab = "album";
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
jest.mock("@/hooks/useMotion", () => () => ({ reduceMotion: false }));
jest.mock("@/core/appConfig", () => ({
    __esModule: true,
    default: {
        getConfig: (key: string) =>
            key === "basic.musicDetailDefault" ? mockTab : false,
    },
    useAppConfig: () => undefined,
}));
jest.mock("@/core/playerTransition", () => ({
    playerTransition: () => ({ progress: mockProgress }),
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

describe("full player input lifecycle", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        mockProgress.value = 0;
        mockRemoval = undefined;
        mockOrientation = "vertical";
        mockTab = "album";
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
            velocity: -0,
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
                        node.props.pointerEvents === "none",
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
