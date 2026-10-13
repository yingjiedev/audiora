import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { withSpring, withTiming } from "react-native-reanimated";

import useMotion, { MotionApi } from "@/hooks/useMotion";
import { withMotionSpring, withMotionTiming } from "./motion";
import {
    clamp,
    coverMorphTransform,
    cubicBezier,
    dismissDecision,
    dragProgress,
    lerp,
    motionDuration,
} from "./motionMath";

/**
 * Why this suite exists
 * ---------------------
 * Reanimated runs animation callbacks, `useAnimatedStyle`, gesture handlers and
 * `runOnUI` bodies on the **UI runtime**, and a plain JS function reached from
 * there aborts the process:
 *
 *   com.facebook.jni.CppException: [Worklets] Tried to synchronously call a
 *   Remote Function. Called "anonymous" on the UI Runtime.
 *
 * That crash shipped twice. The first one took the app down on launch (the
 * bezier easing was solved in JS); the second one fired the moment a toast
 * showed, because a `finished => { "worklet"; ... }` callback chained
 * `motion.timing(...)` — a method of the `useMotion()` object, which was a plain
 * JS closure at the time. So: **everything in the motion layer has to be a
 * worklet**, and that is what this suite pins down.
 *
 * The babel worklets plugin (injected by `babel-preset-expo`, see
 * babel.config.js) stamps `__workletHash` onto every function declared with a
 * `"worklet"` directive. These assertions read that property, so they need no
 * Reanimated runtime — which is just as well, because
 * `react-native-reanimated`'s entry point is ESM and does not parse under Jest.
 * The two primitives the layer wraps are stubbed; the stubs only record calls.
 */
jest.mock("react-native-reanimated", () => ({
    __esModule: true,
    withTiming: jest.fn(),
    withSpring: jest.fn(),
    useReducedMotion: () => false,
}));

const WORKLET_MARKER = "__workletHash";

/** Fails with the offending name in the diff instead of a bare `undefined`. */
function expectWorklet(name: string, value: unknown) {
    expect({ name, type: typeof value }).toEqual({ name, type: "function" });
    expect({
        name,
        workletHashType: typeof (value as Record<string, unknown>)[
            WORKLET_MARKER
        ],
    }).toEqual({ name, workletHashType: "number" });
}

function renderMotionApi(): MotionApi {
    const ref: { current: MotionApi | null } = { current: null };

    function Probe() {
        ref.current = useMotion();
        return null;
    }

    act(() => {
        TestRenderer.create(<Probe />);
    });

    if (!ref.current) {
        throw new Error("useMotion() did not return a motion API");
    }
    return ref.current;
}

beforeEach(() => {
    jest.mocked(withTiming).mockReset();
    jest.mocked(withSpring).mockReset();
});

describe("motionMath worklets", () => {
    it("marks every pure helper the UI runtime calls", () => {
        expectWorklet("motionDuration", motionDuration);
        expectWorklet("clamp", clamp);
        expectWorklet("lerp", lerp);
        expectWorklet("coverMorphTransform", coverMorphTransform);
        expectWorklet("dragProgress", dragProgress);
        expectWorklet("dismissDecision", dismissDecision);
    });

    it("returns a worklet easing curve", () => {
        const easing = cubicBezier(0.2, 0, 0, 1);

        expectWorklet("cubicBezier(...)", easing);
        // Still a correct curve: monotonic, 0 → 1 across the unit interval.
        expect(easing(0)).toBe(0);
        expect(easing(1)).toBe(1);
        expect(easing(0.5)).toBeGreaterThan(0);
        expect(easing(0.5)).toBeLessThan(1);
    });
});

describe("motion builders", () => {
    it("marks the withMotion* wrappers", () => {
        expectWorklet("withMotionTiming", withMotionTiming);
        expectWorklet("withMotionSpring", withMotionSpring);
    });

    it("withMotionTiming resolves tokens and clamps them under Reduce Motion", () => {
        withMotionTiming(1, { duration: "normal", easing: "standard" });
        expect(jest.mocked(withTiming).mock.calls[0][1]).toMatchObject({
            duration: 240,
        });

        withMotionTiming(0, { duration: "normal", reduceMotion: true });
        expect(jest.mocked(withTiming).mock.calls[1][1]).toMatchObject({
            duration: 160,
        });
    });

    it("withMotionSpring swaps to a tween under Reduce Motion only", () => {
        withMotionSpring(1, { velocity: 800 });
        expect(jest.mocked(withSpring)).toHaveBeenCalledTimes(1);
        expect(jest.mocked(withSpring).mock.calls[0][1]).toMatchObject({
            velocity: 800,
        });
        expect(jest.mocked(withTiming)).not.toHaveBeenCalled();

        withMotionSpring(0, { reduceMotion: true });
        expect(jest.mocked(withTiming)).toHaveBeenCalledTimes(1);
        expect(jest.mocked(withTiming).mock.calls[0][1]).toMatchObject({
            duration: 160,
        });
    });
});

describe("useMotion()", () => {
    it("returns a UI-runtime safe API", () => {
        const motion = renderMotionApi();

        expectWorklet("motion.duration", motion.duration);
        expectWorklet("motion.easing", motion.easing);
        expectWorklet("motion.timing", motion.timing);
        expectWorklet("motion.spring", motion.spring);
    });

    it("keeps duration/easing resolvable on the JS side too", () => {
        const motion = renderMotionApi();

        expect(motion.reduceMotion).toBe(false);
        expect(motion.duration("normal")).toBe(240);
        expectWorklet("motion.easing('standard')", motion.easing("standard"));
    });

    it("chains a second animation from inside a callback (the toast crash)", () => {
        const motion = renderMotionApi();

        // The shape that used to throw: `toast.tsx` builds the hold + fade-out
        // from the completion callback of the fade-in, and that callback runs on
        // the UI runtime.
        motion.timing(1, { duration: "normal" }, () => {
            "worklet";
            motion.timing(0, { duration: "fast" });
        });

        const finished = jest.mocked(withTiming).mock.calls[0][2] as () => void;
        expect(jest.mocked(withTiming).mock.calls[0][0]).toBe(1);
        expectWorklet("finished => ...", finished);

        // Stands in for the UI runtime invoking the completion callback.
        finished();

        expect(jest.mocked(withTiming).mock.calls).toHaveLength(2);
        expect(jest.mocked(withTiming).mock.calls[1][0]).toBe(0);
        expect(jest.mocked(withTiming).mock.calls[1][1]).toMatchObject({
            duration: 160,
        });
    });
});
