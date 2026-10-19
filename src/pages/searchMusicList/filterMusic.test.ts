import { filterMusic } from "./filterMusic";
const songs = [
    { id: "one", platform: "local", title: "Night Sky", artist: "Artist", album: "Album" },
    { id: "two", platform: "online", title: "Dawn" },
] as IMusic.IMusicItem[];
const platformName = (name: string) => name === "local" ? "Device" : "My source";
describe("local list search", () => {
    it("normalizes case and surrounding whitespace without modifying the input", () => {
        expect(filterMusic("  NIGHT  ", songs, platformName)).toEqual([songs[0]]);
        expect(filterMusic("artist", songs, platformName)).toEqual([songs[0]]);
        expect(filterMusic("album", songs, platformName)).toEqual([songs[0]]);
        expect(filterMusic("my source", songs, platformName)).toEqual([songs[1]]);
        expect(songs).toHaveLength(2);
    });
    it("keeps all tracks for an empty query and excludes absent metadata from matching", () => {
        expect(filterMusic("  ", songs, platformName)).toBe(songs);
        expect(filterMusic("undefined", songs, platformName)).toEqual([]);
        expect(filterMusic("missing", songs, platformName)).toEqual([]);
        expect(filterMusic("sky", [], platformName)).toEqual([]);
    });
});
