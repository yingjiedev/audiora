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
        mockDismissOrigins.push(require("./playerTransition").playerTransition().dismissProgress.value);
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
        jest.clearAllMocks();
        mockSpringOrigins.length = 0;
        mockDismissOrigins.length = 0;
        mockCompletion = undefined;
    });

    it("starts from the measured frame even while JS reads pre-preparation progress", () => {
        const { origin, progress } = playerTransition();
        origin.value = { x: 10, y: 600, width: 40, height: 40 };
        armPlayerTransition();
        expect(progress.value).toBe(1);
        expandPlayerTransition();
        flushUI();
        expect(mockSpringOrigins).toEqual([0]);
        expect(progress.value).toBe(1);
    });

    it("opens directly without a measured artwork frame", () => {
        armPlayerTransition();
        expandPlayerTransition({ reduceMotion: true });
        flushUI();
        expect(mockSpringOrigins).toEqual([1]);
        expect(withMotionSpring).toHaveBeenCalledWith(1, { reduceMotion: true });
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

    it("continues dismissal from a drag without reversing the cover morph", () => {
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

    it("clears an old frame before measuring and arming a new opening", () => {
        const { origin } = playerTransition();
        onUI(() => {
            origin.value = { x: 10, y: 700, width: 40, height: 40 };
        });
        resetPlayerTransition();
        origin.value = { x: 30, y: 590, width: 70, height: 70 };
        armPlayerTransition();
        expandPlayerTransition();
        flushUI();
        expect(origin.value).toEqual({ x: 30, y: 590, width: 70, height: 70 });
        expect(mockSpringOrigins).toEqual([0]);
    });
});
