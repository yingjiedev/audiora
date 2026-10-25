import { mediaGridColumns } from "./useMediaGrid";

describe("media grid layout", () => {
    it("keeps covers readable when a narrow screen or larger font reduces the space", () => {
        expect(mediaGridColumns(390, 1, 20)).toBe(3);
        expect(mediaGridColumns(390, 2, 20)).toBe(1);
        expect(mediaGridColumns(180, 1, 20)).toBe(1);
    });
    it("bounds the column count during initial layout and on wide screens", () => {
        expect(mediaGridColumns(0, 1, 20)).toBe(1);
        expect(mediaGridColumns(1200, 1, 20)).toBe(6);
        expect(mediaGridColumns(390, 0.8, 20)).toBe(3);
    });
});
