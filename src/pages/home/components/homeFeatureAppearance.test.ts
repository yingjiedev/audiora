import { homeFoldProgress, pickHomeFeatureAppearance } from "./homeFeatureAppearance";

describe("Home feature appearance and shared fold progress", () => {
    it.each([0, 0.1, 0.499999])("selects the cover window for the first half of the random range (%s)", sample => {
        expect(pickHomeFeatureAppearance(sample)).toBe("window");
    });

    it.each([0.5, 0.75, 0.999999])("selects the record for the second half of the random range (%s)", sample => {
        expect(pickHomeFeatureAppearance(sample)).toBe("record");
    });

    it.each([NaN, Infinity, -Infinity])("falls back to the window if a sample is not finite (%s)", sample => {
        expect(pickHomeFeatureAppearance(sample)).toBe("window");
    });

    it("clamps overscroll and avoids division by zero", () => {
        expect(homeFoldProgress(-20, 60)).toBe(0);
        expect(homeFoldProgress(1000, 60)).toBe(1);
        expect(homeFoldProgress(30, 60)).toBe(0.5);
        expect(homeFoldProgress(100, 0)).toBe(0);
        expect(homeFoldProgress(100, -5)).toBe(0);
    });

    it("turns continuously in both directions and slows near the open and closed endpoints", () => {
        const forward = Array.from({ length: 101 }, (_, step) => homeFoldProgress(step, 100));
        forward.slice(1).forEach((value, index) => expect(value).toBeGreaterThan(forward[index]));
        const reverse = Array.from({ length: 101 }, (_, step) => homeFoldProgress(100 - step, 100));
        expect(reverse).toEqual([...forward].reverse());
        expect(forward[1] - forward[0]).toBeLessThan((forward[51] - forward[50]) / 20);
        expect(forward[100] - forward[99]).toBeLessThan((forward[51] - forward[50]) / 20);
        expect(forward[100]).toBe(1);
    });
});
