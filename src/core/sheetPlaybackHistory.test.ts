const mockValues = new Map<string, string>();
const mockJotai = jest.requireActual("jotai");
jest.mock("jotai", () => mockJotai);
jest.mock("@/utils/getOrCreateMMKV", () => ({
    __esModule: true,
    default: () => ({
        getString: (key: string) => mockValues.get(key),
        set: (key: string, value: string) => mockValues.set(key, value),
    }),
}));

function loadHistory() {
    return require("./sheetPlaybackHistory") as typeof import("./sheetPlaybackHistory");
}

const sheet: IMusic.IMusicSheetItemBase = { id: "favorites", platform: "local", title: "Favorites" };

describe("sheet playback history", () => {
    beforeEach(() => {
        jest.resetModules();
        mockValues.clear();
    });

    it("persists navigation metadata without song sources or unrelated fields", () => {
        const history = loadHistory();
        history.recordSheetPlayback({
            routeName: "local-sheet-detail",
            sheet: { ...sheet, musicList: [{ url: "temporary-secret" }], background: "private-background", artist: "Artist", coverImg: "cover", worksNum: 12, categoryId: "plugin-required" },
        });
        expect(JSON.parse(mockValues.get("history")!)).toEqual([{
            routeName: "local-sheet-detail",
            sheet: { ...sheet, artist: "Artist", coverImg: "cover", worksNum: 12, categoryId: "plugin-required" },
        }]);
        jest.resetModules();
        expect(loadHistory().getSheetPlaybackHistory()[0].sheet.title).toBe("Favorites");
    });

    it("moves a repeated collection to the front with updated metadata", () => {
        const history = loadHistory();
        history.recordSheetPlayback({ sheet, routeName: "local-sheet-detail" });
        history.recordSheetPlayback({ sheet: { ...sheet, id: "second" }, routeName: "local-sheet-detail" });
        history.recordSheetPlayback({ sheet: { ...sheet, title: "Updated" }, routeName: "local-sheet-detail" });
        expect(history.getSheetPlaybackHistory().map(entry => entry.sheet.title)).toEqual(["Updated", "Favorites"]);
    });

    it("keeps identical IDs from different sources and collection types separate", () => {
        const history = loadHistory();
        for (const routeName of ["plugin-sheet-detail", "album-detail", "top-list-detail"]) {
            history.recordSheetPlayback({ sheet, routeName });
        }
        history.recordSheetPlayback({ sheet: { ...sheet, platform: "remote" }, routeName: "plugin-sheet-detail" });
        expect(history.getSheetPlaybackHistory()).toHaveLength(4);
    });

    it("caps history at fifty newest collections", () => {
        const history = loadHistory();
        for (let index = 0; index < 60; index++) {
            history.recordSheetPlayback({ sheet: { ...sheet, id: String(index) }, routeName: "local-sheet-detail" });
        }
        expect(history.getSheetPlaybackHistory().map(entry => entry.sheet.id)).toEqual(Array.from({ length: 50 }, (_, index) => String(59 - index)));
    });

    it.each(["not json", "{}", "null"])("recovers from invalid saved data: %s", value => {
        mockValues.set("history", value);
        expect(loadHistory().getSheetPlaybackHistory()).toEqual([]);
    });

    it("filters invalid entries and duplicates on restore", () => {
        const entry = { sheet, routeName: "local-sheet-detail" };
        mockValues.set("history", JSON.stringify([null, {}, entry, entry, { sheet, routeName: "history" }]));
        expect(loadHistory().getSheetPlaybackHistory()).toEqual([entry]);
    });

    it("ignores missing collection IDs and unrelated pages", () => {
        const history = loadHistory();
        history.recordSheetPlayback({ sheet, routeName: "history" });
        history.recordSheetPlayback({ sheet: { ...sheet, id: "" }, routeName: "plugin-sheet-detail" });
        expect(history.getSheetPlaybackHistory()).toEqual([]);
        expect(mockValues.has("history")).toBe(false);
    });

    it("removes one record and clears only this history store", () => {
        const history = loadHistory();
        history.recordSheetPlayback({ sheet, routeName: "local-sheet-detail" });
        history.recordSheetPlayback({ sheet, routeName: "album-detail" });
        history.removeSheetPlayback(history.getSheetPlaybackHistory()[1]);
        expect(history.getSheetPlaybackHistory().map(entry => entry.routeName)).toEqual(["album-detail"]);
        history.clearSheetPlaybackHistory();
        expect(mockValues.get("history")).toBe("[]");
        expect(history.getSheetPlaybackHistory()).toEqual([]);
    });
});
