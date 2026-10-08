import { transformFileSync } from "@babel/core";
import { join } from "path";
import { runInNewContext } from "vm";
import { motion } from "@/constants/designSystem";

type WorkletFunction = ((...args: unknown[]) => unknown) & {
    __initData?: { code: string };
    __closure?: Record<string, unknown>;
};

// Exercise the actual Babel output: Jest's Reanimated mock runs everything on
// JS and therefore cannot detect ordinary functions captured by UI worklets.
function compileMotionMath(): typeof import("./motionMath") {
    const code = transformFileSync(join(__dirname, "motionMath.ts"), {
        configFile: false,
        babelrc: false,
        presets: ["@babel/preset-typescript"],
        plugins: [
            "react-native-worklets/plugin",
            "@babel/plugin-transform-modules-commonjs",
        ],
    })?.code;
    if (!code) {
        throw new Error("Motion math did not compile");
    }
    const exports = {};
    runInNewContext(code, {
        global: { Error },
        exports,
        require: (name: string) => {
            if (name === "@/constants/designSystem") {
                return { motion };
            }
            throw new Error(`Unexpected worklet dependency: ${name}`);
        },
    });
    return exports as typeof import("./motionMath");
}

function cloneForUI(value: unknown): unknown {
    if (typeof value === "function") {
        const worklet = value as WorkletFunction;
        if (!worklet.__initData) {
            return () => {
                throw new Error("Tried to synchronously call a Remote Function");
            };
        }
        const uiFunction = runInNewContext(
            `(${worklet.__initData.code})`,
        ) as WorkletFunction;
        uiFunction.__closure = cloneForUI(worklet.__closure) as Record<string, unknown>;
        return uiFunction.bind(uiFunction);
    }
    if (Array.isArray(value)) {
        return value.map(cloneForUI);
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, child]) => [key, cloneForUI(child)]),
        );
    }
    return value;
}

function onUI<T>(callback: T): T {
    expect((callback as WorkletFunction).__initData?.code).toBeDefined();
    return cloneForUI(callback) as T;
}

describe("motion functions on a separate UI runtime", () => {
    const math = compileMotionMath();

    it("keeps the runtime guard active for ordinary JS functions", () => {
        const remote = cloneForUI(() => 1) as () => number;
        expect(remote).toThrow("Remote Function");
    });

    it.each(Object.entries(motion.easing))(
        "runs the %s easing curve without capturing JS helpers",
        (_name, curve) => {
            const easing = math.cubicBezier(curve[0], curve[1], curve[2], curve[3]);
            const uiEasing = onUI(easing);
            for (const progress of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1]) {
                expect(uiEasing(progress)).toBeCloseTo(easing(progress), 8);
            }
        },
    );

    it("runs cover morph and drag math including their nested helpers", () => {
        const origin = { x: 12, y: 640, width: 40, height: 40 };
        const target = { x: 30, y: 100, width: 320, height: 320 };
        const morph = onUI(math.coverMorphTransform);
        for (const progress of [0, 0.5, 1]) {
            expect(morph(origin, target, progress)).toEqual(
                math.coverMorphTransform(origin, target, progress),
            );
        }
        expect(onUI(math.dragProgress)(240, 800)).toBe(0.5);
        expect(onUI(math.dismissDecision)(240, 0, 800)).toBe("dismiss");
        expect(onUI(math.dismissDecision)(0, 0, 800)).toBe("cancel");
        expect(onUI(math.clamp)(NaN, 0, 1)).toBe(0);
        expect(onUI(math.lerp)(0, 10, 0.5)).toBe(5);
    });

    it("serializes duration tokens and the reduced motion setting", () => {
        const duration = onUI(math.motionDuration);
        expect(duration("slow")).toBe(motion.duration.slow);
        expect(duration("slow", true)).toBe(motion.duration.fast);
    });
});
