import { splitTitleHighlight } from "./musicItemTitle";

describe("song title search highlighting", () => {
    it("highlights every match and preserves the original title", () => {
        expect(splitTitleHighlight("Still - still (Live)", "STILL")).toEqual([
            { text: "Still", highlight: true }, { text: " - ", highlight: false },
            { text: "still", highlight: true }, { text: " (Live)", highlight: false },
        ]);
    });
    it("matches Chinese titles without removing version names", () => {
        expect(splitTitleHighlight("还是会想你 (DJ版)", "还是会想你")).toEqual([
            { text: "还是会想你", highlight: true }, { text: " (DJ版)", highlight: false },
        ]);
    });
    it("treats regex punctuation literally", () => {
        expect(splitTitleHighlight("Song [Live] Song", "[Live]")).toEqual([
            { text: "Song ", highlight: false }, { text: "[Live]", highlight: true },
            { text: " Song", highlight: false },
        ]);
    });
    it.each([undefined, "", "   ", "missing"])("handles absent or unmatched query %s", query => {
        expect(splitTitleHighlight("Song", query)).toEqual([{ text: "Song", highlight: false }]);
    });
    it("handles empty titles", () => {
        expect(splitTitleHighlight("", "song")).toEqual([{ text: "", highlight: false }]);
    });
    it("preserves match positions after Unicode characters with expanding lowercase mappings", () => {
        expect(splitTitleHighlight("İSong", "song")).toEqual([
            { text: "İ", highlight: false }, { text: "Song", highlight: true },
        ]);
    });
});
