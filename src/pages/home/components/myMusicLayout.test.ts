import { getRecentCoverWidth } from "./myMusicLayout";

describe("recent music cover layout", () => {
    it("fits three whole covers plus the next-cover hint on a phone", () => {
        const width = getRecentCoverWidth(360, 8, 96);
        expect(width).toBeGreaterThanOrEqual(96);
        expect(width * 3 + 8 * 3).toBeLessThan(360);
        expect(width * 3 + 8 * 4).toBeCloseTo(360);
    });

    it("uses two readable covers when three would be too narrow", () => {
        const width = getRecentCoverWidth(280, 8, 96);
        expect(width).toBeGreaterThanOrEqual(96);
        expect(width * 2 + 8 * 3).toBeCloseTo(280);
    });

    it("reflows wider containers into four complete covers", () => {
        const width = getRecentCoverWidth(700, 16, 96);
        expect(width * 4 + 16 * 5).toBeCloseTo(700);
    });

    it("keeps a complete cover inside an exceptionally narrow container", () => {
        expect(getRecentCoverWidth(24, 16, 96)).toBe(12);
    });

    it.each([0, -1, Number.NaN])("provides a finite initial size before valid layout: %s", viewportWidth => {
        expect(getRecentCoverWidth(viewportWidth, 8, 96)).toBe(96);
    });
});
