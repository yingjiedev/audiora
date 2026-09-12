import React from "react";
import { InteractionManager } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import useEnterTransitionEnd from "./useEnterTransitionEnd";

type TransitionEndEvent = { data?: { closing?: boolean } };

let mockTransitionEndListener:
    | ((event?: TransitionEndEvent) => void)
    | null = null;
let mockTransitionListenerActive = false;
const mockUnsubscribe = jest.fn();

jest.mock("@react-navigation/native", () => ({
    useNavigation: () => ({
        addListener: (
            _event: string,
            listener: (event?: TransitionEndEvent) => void,
        ) => {
            mockTransitionEndListener = listener;
            mockTransitionListenerActive = true;
            return () => {
                mockTransitionListenerActive = false;
                mockUnsubscribe();
            };
        },
    }),
}));

describe("useEnterTransitionEnd", () => {
    let pendingTasks: (() => void)[];
    let taskCancels: jest.Mock[];
    const renderers: TestRenderer.ReactTestRenderer[] = [];

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        mockTransitionEndListener = null;
        mockTransitionListenerActive = false;
        pendingTasks = [];
        taskCancels = [];
        jest.spyOn(
            InteractionManager,
            "runAfterInteractions",
        ).mockImplementation(callback => {
            const cancel = jest.fn();
            taskCancels.push(cancel);
            pendingTasks.push(callback);
            return { cancel } as any;
        });
    });

    afterEach(() => {
        const mounted = renderers.splice(0);
        act(() => {
            mounted.forEach(renderer => renderer.unmount());
        });
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    function renderProbe() {
        let ready = false;

        function Probe() {
            ready = useEnterTransitionEnd();
            return null;
        }

        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<Probe />);
        });
        renderers.push(renderer);

        return {
            isReady: () => ready,
            fireTransitionEnd: (closing = false) =>
                act(() => {
                    if (mockTransitionListenerActive) {
                        mockTransitionEndListener?.({ data: { closing } });
                    }
                }),
            flushInteractions: () =>
                act(() => {
                    const tasks = pendingTasks;
                    pendingTasks = [];
                    tasks.forEach(task => task());
                }),
            runFallback: () =>
                act(() => {
                    jest.advanceTimersByTime(600);
                }),
            unmount: () =>
                act(() => {
                    renderer.unmount();
                }),
        };
    }

    it("waits for transitionEnd before scheduling heavy content", () => {
        const probe = renderProbe();

        probe.flushInteractions();
        expect(probe.isReady()).toBe(false);
        expect(InteractionManager.runAfterInteractions).not.toHaveBeenCalled();

        probe.fireTransitionEnd();
        expect(probe.isReady()).toBe(false);
        expect(InteractionManager.runAfterInteractions).toHaveBeenCalledTimes(1);

        probe.flushInteractions();
        expect(probe.isReady()).toBe(true);
    });

    it("ignores closing transitionEnd events", () => {
        const probe = renderProbe();

        probe.fireTransitionEnd(true);
        probe.flushInteractions();

        expect(probe.isReady()).toBe(false);
        expect(InteractionManager.runAfterInteractions).not.toHaveBeenCalled();
    });

    it("schedules only one interaction task for repeated transitionEnd events", () => {
        const probe = renderProbe();

        probe.fireTransitionEnd();
        probe.fireTransitionEnd();

        expect(InteractionManager.runAfterInteractions).toHaveBeenCalledTimes(1);
        probe.flushInteractions();
        expect(probe.isReady()).toBe(true);
    });

    it("uses the fallback directly when transitionEnd is missing", () => {
        const probe = renderProbe();

        probe.runFallback();

        expect(probe.isReady()).toBe(true);
        expect(InteractionManager.runAfterInteractions).not.toHaveBeenCalled();
    });

    it("can become ready after remounting", () => {
        const firstProbe = renderProbe();
        firstProbe.unmount();

        const secondProbe = renderProbe();
        secondProbe.fireTransitionEnd();
        secondProbe.flushInteractions();

        expect(secondProbe.isReady()).toBe(true);
    });

    it("cleans up navigation, fallback, and pending interactions on unmount", () => {
        const probe = renderProbe();
        probe.fireTransitionEnd();
        expect(jest.getTimerCount()).toBe(1);

        probe.unmount();

        expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
        expect(taskCancels[0]).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);

        probe.flushInteractions();
        expect(probe.isReady()).toBe(false);
    });

    it("does not create an interaction task when unmounted before transitionEnd", () => {
        const probe = renderProbe();

        probe.unmount();
        probe.runFallback();

        expect(InteractionManager.runAfterInteractions).not.toHaveBeenCalled();
        expect(taskCancels).toHaveLength(0);
    });
});
