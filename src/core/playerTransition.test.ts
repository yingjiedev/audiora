import {
    armPlayerTransition,
    cancelPlayerTransitionCollapse,
    collapsePlayerTransition,
    expandPlayerTransition,
    playerTransition,
    resetPlayerTransition,
} from "./playerTransition";
import { withMotionSpring, withMotionTiming } from "@/utils/motion";

let mockOnUI = false;
let mockQueue: (() => void)[] = [];
let mockCompletion: ((finished: boolean) => void) | undefined;
const mockSpringOrigins: number[] = [];
const mockDismissOrigins: number[] = [];
const mockEntryOrigins: number[] = [];

jest.mock("react-native-reanimated", () => ({
    makeMutable: (initial: unknown) => {
        let current = initial;
        return {
            get value() {
                return current;
            },
            set value(next: unknown) {
                if (mockOnUI) {
                    current = next;
                } else {
                    mockQueue.push(() => {
                        current = next;
                    });
                }
            },
        };
    },
    runOnUI: (callback: () => void) => () => mockQueue.push(callback),
    cancelAnimation: jest.fn(() => {
        expect(mockOnUI).toBe(true);
    }),
    runOnJS: (callback: () => void) => () => {
        expect(mockOnUI).toBe(true);
        callback();
    },
}));
jest.mock("@/utils/motion", () => ({
    withMotionSpring: jest.fn((target: number, _options: unknown, callback?: (finished: boolean) => void) => {
        expect(mockOnUI).toBe(true);
        const state = require("./playerTransition").playerTransition();
        mockSpringOrigins.push(target === 0 ? state.dismissProgress.value : state.progress.value);
        mockCompletion = callback;
        return target;
    }),
    withMotionTiming: jest.fn((target: number, _options: unknown, callback?: (finished: boolean) => void) => {
        expect(mockOnUI).toBe(true);
        const state = require("./playerTransition").playerTransition();
        (callback ? mockDismissOrigins : mockEntryOrigins).push(callback ? state.dismissProgress.value : state.progress.value);
        mockCompletion = callback;
        return target;
    }),
}));

function onUI(callback: () => void) {
    mockOnUI = true;
    try {
        callback();
    } finally {
        mockOnUI = false;
    }
}

function flushUI() {
    while (mockQueue.length) {
        onUI(mockQueue.shift()!);
    }
}

describe("player transition UI ordering", () => {
    beforeEach(() => {
        mockQueue = [];
        resetPlayerTransition();
        flushUI();
        onUI(() => {
            playerTransition().progress.value = 1;
            playerTransition().dismissProgress.value = 0;
        });
        jest.clearAllMocks();
        mockSpringOrigins.length = 0;
        mockDismissOrigins.length = 0;
        mockEntryOrigins.length = 0;
        mockCompletion = undefined;
    });

    it("starts below the screen even while JS reads pre-preparation progress", () => {
        const { progress } = playerTransition();
        armPlayerTransition();
        expect(progress.value).toBe(1);
        expandPlayerTransition();
        flushUI();
        expect(mockEntryOrigins).toEqual([0]);
        expect(progress.value).toBe(1);
    });

    it("uses the same entrance without artwork measurements and supports Reduce Motion", () => {
        armPlayerTransition();
        expandPlayerTransition({ reduceMotion: true });
        flushUI();
        expect(mockEntryOrigins).toEqual([0]);
        expect(withMotionTiming).toHaveBeenCalledWith(1, {
            duration: "screen", easing: "decelerate", reduceMotion: true,
        });
    });

    it("runs collapse completion on JS only when the UI animation finishes", () => {
        const finished = jest.fn();
        collapsePlayerTransition(finished);
        expect(finished).not.toHaveBeenCalled();
        flushUI();
        expect(playerTransition().progress.value).toBe(1);
        expect(playerTransition().dismissProgress.value).toBe(1);
        expect(withMotionTiming).toHaveBeenCalledWith(1, {
            duration: "screen", easing: "accelerate", reduceMotion: undefined,
        }, expect.any(Function));
        onUI(() => mockCompletion?.(false));
        expect(finished).not.toHaveBeenCalled();
        onUI(() => mockCompletion?.(true));
        expect(finished).toHaveBeenCalledTimes(1);
    });

    it("restores a cancelled drag from its current progress and velocity", () => {
        onUI(() => {
            playerTransition().dismissProgress.value = 0.2;
        });
        cancelPlayerTransitionCollapse({ velocity: -2 });
        expect(playerTransition().dismissProgress.value).toBe(0.2);
        flushUI();
        expect(mockSpringOrigins).toEqual([0.2]);
        expect(withMotionSpring).toHaveBeenCalledWith(0, { velocity: -2 });
        expect(playerTransition().dismissProgress.value).toBe(0);
        expect(playerTransition().progress.value).toBe(1);
    });

    it("continues dismissal from a drag without reversing entry", () => {
        onUI(() => {
            playerTransition().dismissProgress.value = 0.4;
        });
        collapsePlayerTransition(jest.fn(), { reduceMotion: true });
        flushUI();
        expect(mockDismissOrigins).toEqual([0.4]);
        expect(playerTransition().progress.value).toBe(1);
        expect(withMotionTiming).toHaveBeenCalledWith(1, {
            duration: "screen", easing: "accelerate", reduceMotion: true,
        }, expect.any(Function));
    });

    it("clears dismissal before a new entrance", () => {
        onUI(() => {
            playerTransition().dismissProgress.value = 1;
        });
        armPlayerTransition();
        flushUI();
        expect(playerTransition().dismissProgress.value).toBe(0);
    });

    it("resets an old transition before arming a new opening", () => {
        onUI(() => {
            playerTransition().progress.value = 0.4;
            playerTransition().dismissProgress.value = 0.6;
        });
        resetPlayerTransition();
        armPlayerTransition();
        expandPlayerTransition();
        flushUI();
        expect(playerTransition().dismissProgress.value).toBe(0);
        expect(mockEntryOrigins).toEqual([0]);
    });

    it("freezes entry when closing halfway through so exit starts from its current position", () => {
        onUI(() => {
            playerTransition().progress.value = 0.35;
        });
        collapsePlayerTransition(jest.fn());
        flushUI();
        expect(playerTransition().progress.value).toBe(0.35);
        expect(mockDismissOrigins).toEqual([0]);
        expect(playerTransition().dismissProgress.value).toBe(1);
    });

    it("preserves a newly armed opening when the previous player's cleanup arrives afterwards", () => {
        armPlayerTransition();
        resetPlayerTransition();
        expandPlayerTransition();
        flushUI();
        expect(mockEntryOrigins).toEqual([0]);
        expect(playerTransition().progress.value).toBe(1);
    });
});
