import { Buffer } from "buffer";
import { normalizeRawSongKey, QmcKeyError, resolveSongKey } from "./songKey";

const raw = Buffer.from([0, 17, 34, 255]).toString("base64");

describe("externally supplied QMC song keys", () => {
    it.each([raw, `base64:${raw}`, "hex:001122ff"])("normalizes explicit raw key %s", value => {
        expect(normalizeRawSongKey(value)).toBe(`base64:${raw}`);
    });
    it("does not guess hex for a string valid as base64", () => {
        expect(normalizeRawSongKey("abcd")).toBe("base64:abcd");
    });
    it.each([undefined, null, 7, "", " ", "hex:f", "hex:gg", "base64:", "a===", "AB==", "AA", "AA==!", "hex:" + "00".repeat(4097)])("rejects malformed or oversized keys %#", value => {
        expect(() => normalizeRawSongKey(value)).toThrow(QmcKeyError);
    });
    it("preserves long raw keys instead of truncating them like legacy EKey", () => {
        const key = Buffer.alloc(1024, 17).toString("base64");
        expect(normalizeRawSongKey(key)).toBe(`base64:${key}`);
    });
    it("allows the documented size boundary", () => {
        const key = Buffer.alloc(4096, 17).toString("base64");
        expect(normalizeRawSongKey(key)).toBe(`base64:${key}`);
    });
    it("never interprets legacy EKey as a raw key", () => {
        expect(() => resolveSongKey({ url: "https://host/audio", ekey: raw })).toThrow(QmcKeyError);
    });
    it.each(["a.mflac", "a.mflac0", "a.MGG?token=x", "file:///a.mmp4#fragment"])("requires a key for %s", url => {
        expect(() => resolveSongKey({ url })).toThrow(QmcKeyError);
    });
    it("prefers an explicit raw key and leaves CENC and plain URLs alone", () => {
        expect(resolveSongKey({ url: "a.mflac", qmcRawKey: raw, ekey: "legacy" })).toBe(`base64:${raw}`);
        expect(resolveSongKey({ url: "a.m4a", cek: "external-cek", ekey: "legacy" })).toBeUndefined();
        expect(resolveSongKey({ url: "a.flac" })).toBeUndefined();
    });
});
