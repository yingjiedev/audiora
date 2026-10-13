import { getRecentPageLayout } from "./myMusicLayout";

describe("recent music cover layout", () => {
    it("fills a phone page with three whole covers and no partial next title", () => {
        const layout = getRecentPageLayout(360, 12, 96);
        expect(layout.columns).toBe(3);
        expect(layout.coverWidth).toBeGreaterThanOrEqual(96);
        expect(layout.coverWidth * 3 + layout.gap * 2).toBeCloseTo(layout.width);
    });

    it("uses two readable covers when three would be too narrow", () => {
        const layout = getRecentPageLayout(280, 12, 96);
        expect(layout.columns).toBe(2);
        expect(layout.coverWidth).toBeGreaterThanOrEqual(96);
        expect(layout.coverWidth * 2 + layout.gap).toBeCloseTo(280);
    });

    it("keeps wide containers on three complete items per page", () => {
        const layout = getRecentPageLayout(700, 16, 96);
        expect(layout.columns).toBe(3);
        expect(layout.coverWidth * 3 + layout.gap * 2).toBeCloseTo(700);
    });

    it("keeps a complete cover inside an exceptionally narrow container", () => {
        const layout = getRecentPageLayout(24, 16, 96);
        expect(layout.columns).toBe(1);
        expect(layout.coverWidth).toBe(24);
    });

    it.each([0, -1, Number.NaN])("provides a finite initial size before valid layout: %s", viewportWidth => {
        expect(getRecentPageLayout(viewportWidth, 8, 96).coverWidth).toBe(96);
    });
});
