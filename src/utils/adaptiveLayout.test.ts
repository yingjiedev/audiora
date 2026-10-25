import { adaptiveLayout, panelLayout } from "./adaptiveLayout";

describe("adaptive window layout", () => {
    it.each([[599, false, 0], [600, true, 80], [839, true, 80], [840, true, 80], [1199, true, 80], [1200, true, 224]])(
        "selects navigation for a %sdp window", (width, wide, navigationWidth) => {
            expect(adaptiveLayout(width as number, 900)).toMatchObject({ wide, navigationWidth });
        },
    );

    it("opens supporting content only when both panes fit", () => {
        expect(adaptiveLayout(943, 800, true).showPane).toBe(false);
        expect(adaptiveLayout(944, 800, true)).toMatchObject({ showPane: true, contentWidth: 528 });
        expect(adaptiveLayout(1280, 800, true)).toMatchObject({ showPane: true, paneWidth: 360, contentWidth: 680 });
        expect(adaptiveLayout(1280, 800).showPane).toBe(false);
    });

    it("requires height as well as width for the tablet player", () => {
        expect(adaptiveLayout(840, 479).splitPlayer).toBe(false);
        expect(adaptiveLayout(839, 1200).splitPlayer).toBe(false);
        expect(adaptiveLayout(840, 480).splitPlayer).toBe(true);
    });

    it("handles a missing or invalid initial measurement", () => {
        for (const width of [0, -100, NaN, Infinity]) {
            expect(adaptiveLayout(width, 800, true)).toMatchObject({ wide: false, contentWidth: 0, showPane: false });
        }
    });

    it("sizes panels from the current window rather than the control scale", () => {
        expect(panelLayout(390, 844, 24, 24)).toEqual({ side: false, width: 390, maxHeight: 796 });
        expect(panelLayout(768, 1024)).toMatchObject({ side: false, width: 768 });
        expect(panelLayout(1024, 768, 24, 16)).toEqual({ side: true, width: 480, maxHeight: 728 });
        expect(panelLayout(400, 300)).toMatchObject({ side: false, width: 400 });
    });
});
