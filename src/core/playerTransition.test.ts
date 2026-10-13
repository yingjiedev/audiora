import {
    armPlayerTransition,
    cancelPlayerTransitionCollapse,
    collapsePlayerTransition,
    expandPlayerTransition,
    playerTransition,
    resetPlayerTransition,
} from "./playerTransition";
import { withMotionSpring } from "@/utils/motion";

let mockOnUI = false;
let mockQueue: (() => void)[] = [];
let mockCompletion: ((finished: boolean) => void) | undefined;
const mockSpringOrigins: number[] = [];

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
        mockSpringOrigins.push(require("./playerTransition").playerTransition().progress.value);
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
        onUI(() => mockCompletion?.(false));
        expect(finished).not.toHaveBeenCalled();
        onUI(() => mockCompletion?.(true));
        expect(finished).toHaveBeenCalledTimes(1);
    });

    it("restores a cancelled drag from its current progress and velocity", () => {
        onUI(() => {
            playerTransition().progress.value = 0.2;
        });
        cancelPlayerTransitionCollapse({ velocity: -2 });
        expect(playerTransition().progress.value).toBe(0.2);
        flushUI();
        expect(mockSpringOrigins).toEqual([0.2]);
        expect(withMotionSpring).toHaveBeenCalledWith(1, { velocity: -2 });
        expect(playerTransition().progress.value).toBe(1);
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
