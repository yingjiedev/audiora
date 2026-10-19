import { createAndroidAutoCatalog, getAndroidAutoMediaId } from "./androidAutoCatalog";

const song = (id: string, platform = "source") => ({
    id, platform, title: id, artist: "artist", album: "album", artwork: "//example.com/cover.jpg",
    duration: 200, url: "https://secret/audio", headers: { Authorization: "secret" }, cek: "secret",
} as IMusic.IMusicItem);

it("keeps identities unambiguous across platforms, separators and URI escapes", () => {
    expect(getAndroidAutoMediaId(song("b:c", "a"))).not.toBe(getAndroidAutoMediaId(song("c", "a:b")));
    expect(getAndroidAutoMediaId(song("a%3Ab"))).not.toBe(getAndroidAutoMediaId(song("a:b")));
    expect(getAndroidAutoMediaId(song("same", "one"))).not.toBe(getAndroidAutoMediaId(song("same", "two")));
});

it("exports the whole queue and current metadata without audio URLs or credentials", () => {
    const queue = Array.from({ length: 1000 }, (_, index) => song(String(index)));
    const catalog = createAndroidAutoCatalog(queue, { ...queue[999], title: "Updated" });
    expect(catalog.items).toHaveLength(1000);
    expect(catalog.items[999]).toMatchObject({ title: "Updated", artwork: "https://example.com/cover.jpg" });
    expect(catalog.currentMediaId).toBe(getAndroidAutoMediaId(queue[999]));
    expect(JSON.stringify(catalog)).not.toContain("secret");
    expect(queue[999].title).toBe("999");
});

it("handles an empty queue and bundled artwork", () => {
    expect(createAndroidAutoCatalog([], null)).toEqual({ currentMediaId: null, items: [] });
    expect(createAndroidAutoCatalog([{ ...song("1"), artwork: 7 as any }]).items[0].artwork).toBe("");
});
