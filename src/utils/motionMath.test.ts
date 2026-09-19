import {
    DISMISS_DISTANCE_RATIO,
    DISMISS_VELOCITY,
    clamp,
    coverMorphTransform,
    cubicBezier,
    dismissDecision,
    dragProgress,
    lerp,
    motionDuration,
} from "./motionMath";
import { motion as motionTokens } from "@/constants/designSystem";

const MINI: Parameters<typeof coverMorphTransform>[0] = {
    x: 24,
    y: 900,
    width: 74,
    height: 74,
};

const FULL: Parameters<typeof coverMorphTransform>[1] = {
    x: 75,
    y: 200,
    width: 600,
    height: 600,
};

describe("clamp / lerp", () => {
    it("keeps values inside the range", () => {
        expect(clamp(-1, 0, 1)).toBe(0);
        expect(clamp(2, 0, 1)).toBe(1);
        expect(clamp(0.4, 0, 1)).toBe(0.4);
    });

    it("treats NaN as the lower bound so a bogus frame cannot freeze the UI", () => {
        expect(clamp(NaN, 0, 1)).toBe(0);
    });

    it("interpolates and clamps out-of-range progress", () => {
        expect(lerp(0, 10, 0.5)).toBe(5);
        expect(lerp(0, 10, -1)).toBe(0);
        expect(lerp(0, 10, 2)).toBe(10);
    });
});

describe("coverMorphTransform", () => {
    it("sits exactly on the mini artwork when collapsed", () => {
        const { translateX, translateY, scale } = coverMorphTransform(
            MINI,
            FULL,
            0,
        );
        const fullCenterX = FULL.x + FULL.width / 2;
        const fullCenterY = FULL.y + FULL.height / 2;

        // transform order is translate → scale about the center, so the box
        // center lands on the mini artwork center and the box matches its size.
        expect(fullCenterX + translateX).toBeCloseTo(MINI.x + MINI.width / 2);
        expect(fullCenterY + translateY).toBeCloseTo(MINI.y + MINI.height / 2);
        expect(FULL.width * scale).toBeCloseTo(MINI.width);
        expect(FULL.height * scale).toBeCloseTo(MINI.height);
    });

    it("returns an identity transform when expanded", () => {
        const { translateX, translateY, scale } = coverMorphTransform(
            MINI,
            FULL,
            1,
        );
        expect(translateX).toBeCloseTo(0);
        expect(translateY).toBeCloseTo(0);
        expect(scale).toBeCloseTo(1);
    });

    it("moves monotonically between the two frames", () => {
        const half = coverMorphTransform(MINI, FULL, 0.5);
        const quarter = coverMorphTransform(MINI, FULL, 0.25);
        expect(half.scale).toBeGreaterThan(quarter.scale);
        expect(Math.abs(half.translateY)).toBeLessThan(
            Math.abs(quarter.translateY),
        );
    });

    it("never scales to zero or flips when the origin is degenerate", () => {
        const { scale } = coverMorphTransform(
            { x: 0, y: 0, width: 0, height: 0 },
            FULL,
            0,
        );
        expect(scale).toBeGreaterThan(0);
    });
});

describe("dragProgress", () => {
    const height = 1000;

    it("stays fully expanded while dragging up", () => {
        expect(dragProgress(-200, height)).toBe(1);
    });

    it("reaches the collapsed state after the full drag distance", () => {
        expect(dragProgress(height * 0.7, height)).toBe(0);
    });

    it("never leaves 0..1", () => {
        expect(dragProgress(height * 5, height)).toBe(0);
        expect(dragProgress(0, height)).toBe(1);
    });

    it("ignores an unmeasured screen", () => {
        expect(dragProgress(300, 0)).toBe(1);
    });
});

describe("dismissDecision", () => {
    const height = 1000;

    it("dismisses past the distance threshold", () => {
        expect(
            dismissDecision(height * DISMISS_DISTANCE_RATIO + 1, 0, height),
        ).toBe("dismiss");
    });

    it("dismisses on a fast fling even for a short drag", () => {
        expect(dismissDecision(40, DISMISS_VELOCITY + 1, height)).toBe(
            "dismiss",
        );
    });

    it("cancels a slow, short drag", () => {
        expect(dismissDecision(60, 200, height)).toBe("cancel");
    });

    it("cancels when the screen height is unknown", () => {
        expect(dismissDecision(600, 2000, 0)).toBe("cancel");
    });
});

describe("cubicBezier", () => {
    it("pins both endpoints and clamps outside 0..1", () => {
        const easing = cubicBezier(0.2, 0, 0, 1);
        expect(easing(0)).toBe(0);
        expect(easing(1)).toBe(1);
        // Reanimated can hand over tiny overshoots from a spring.
        expect(easing(-0.5)).toBe(0);
        expect(easing(1.5)).toBe(1);
    });

    it("matches a linear control polygon", () => {
        const easing = cubicBezier(0.25, 0.25, 0.75, 0.75);
        for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
            expect(easing(t)).toBeCloseTo(t, 3);
        }
    });

    it("is monotonically increasing for every token curve", () => {
        for (const token of Object.values(motionTokens.easing)) {
            const [x1, y1, x2, y2] = token as readonly [
                number,
                number,
                number,
                number,
            ];
            const easing = cubicBezier(x1, y1, x2, y2);
            let previous = -1;
            for (let i = 0; i <= 20; i++) {
                const value = easing(i / 20);
                expect(value).toBeGreaterThanOrEqual(previous);
                previous = value;
            }
        }
    });

    it("front-loads decelerate and back-loads accelerate", () => {
        const decelerate = cubicBezier(...motionTokens.easing.decelerate);
        const accelerate = cubicBezier(...motionTokens.easing.accelerate);
        expect(decelerate(0.25)).toBeGreaterThan(0.25);
        expect(accelerate(0.25)).toBeLessThan(0.25);
    });
});

describe("motionDuration", () => {
    it("returns the token untouched when motion is allowed", () => {
        expect(motionDuration("screen")).toBe(motionTokens.duration.screen);
        expect(motionDuration("slow", false)).toBe(motionTokens.duration.slow);
    });

    it("caps long travel at the fast token under Reduce Motion", () => {
        expect(motionDuration("screen", true)).toBe(motionTokens.duration.fast);
        expect(motionDuration("slow", true)).toBe(motionTokens.duration.fast);
    });

    it("never lengthens a token that is already short", () => {
        expect(motionDuration("micro", true)).toBe(motionTokens.duration.micro);
    });
});
