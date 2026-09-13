import { normalizePluginMediaSourceResult } from "./mediaSource";

describe("plugin media source normalization", () => {
    it("preserves and normalizes an explicitly reported actual quality", () => {
        expect(normalizePluginMediaSourceResult({
            url: "https://example.com/audio",
            quality: "high",
            ekey: "key",
        })).toEqual({
            url: "https://example.com/audio",
            quality: "320k",
            ekey: "key",
            userAgent: undefined,
            audioMeta: undefined,
        });
    });

    it("keeps valid technical metadata and removes invalid values", () => {
        expect(normalizePluginMediaSourceResult({
            url: "https://example.com/audio",
            headers: { "user-agent": "Audiora" },
            audioMeta: {
                codec: " FLAC ",
                bitrate: -1,
                bitDepth: 24,
                sampleRate: 96000,
            },
        })).toEqual({
            url: "https://example.com/audio",
            headers: { "user-agent": "Audiora" },
            userAgent: "Audiora",
            quality: undefined,
            audioMeta: {
                codec: "flac",
                bitrate: undefined,
                bitDepth: 24,
                sampleRate: 96000,
                channelCount: undefined,
            },
        });
    });
});
