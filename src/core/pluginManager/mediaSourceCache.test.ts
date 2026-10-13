import { readCachedMediaSource } from "./mediaSourceCache";
import { QmcKeyError, resolveSongKey } from "@/service/mflac/songKey";

describe("cached encrypted media sources", () => {
    it("retains the external raw key and source headers across serialization", () => {
        const source = {
            url: "https://example.com/opaque-audio",
            qmcRawKey: "hex:010203",
            headers: { Authorization: "user-token", "user-agent": "source-agent" },
        };
        const cached = JSON.parse(JSON.stringify(source));
        const restored = readCachedMediaSource(cached, { headers: { Authorization: "stale" } });
        expect(resolveSongKey(restored)).toBe("base64:AQID");
        expect(restored.headers).toEqual(source.headers);
        expect(restored.userAgent).toBe("source-agent");
        expect(cached).toEqual(source);
    });

    it("retains obsolete EKey provenance so opaque encrypted URLs are rejected", () => {
        const restored = readCachedMediaSource({ url: "https://example.com/opaque-audio", ekey: "wrapped" }, {});
        expect(() => resolveSongKey(restored)).toThrow(QmcKeyError);
    });

    it("preserves CENC keys and supports legacy plain source headers", () => {
        const restored = readCachedMediaSource({ url: "https://example.com/audio", cek: "external-cek" }, {
            headers: { Authorization: "legacy" },
            userAgent: "legacy-agent",
        });
        expect(restored.cek).toBe("external-cek");
        expect(restored.headers).toEqual({ Authorization: "legacy" });
        expect(restored.userAgent).toBe("legacy-agent");
        expect(resolveSongKey(restored)).toBeUndefined();
    });
});
