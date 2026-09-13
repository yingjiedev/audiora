import {
    formatAudioQualityText,
    getMusicItemAudioMeta,
    mapLocalQuality,
    normalizeAudioMeta,
    resolveLocalAudioMeta,
} from "./localQuality";

describe("normalizeAudioMeta", () => {
    it("drops invalid values and keeps clean ones", () => {
        expect(
            normalizeAudioMeta({
                bitrate: 2304000,
                sampleRate: 96000,
                bitDepth: 24,
                codec: "flac",
                channelCount: 2,
            }),
        ).toEqual({
            bitrate: 2304000,
            sampleRate: 96000,
            bitDepth: 24,
            codec: "flac",
            channelCount: 2,
        });
    });

    it("rejects NaN, zero and negative values", () => {
        expect(
            normalizeAudioMeta({
                bitrate: -1,
                sampleRate: Number.NaN,
                bitDepth: 0,
                codec: "",
            }),
        ).toBeUndefined();
    });

    it("coerces numeric strings and ignores empty meta", () => {
        expect(normalizeAudioMeta({ bitrate: "320000" })).toEqual({
            bitrate: 320000,
            sampleRate: undefined,
            bitDepth: undefined,
            codec: undefined,
            channelCount: undefined,
        });
        expect(normalizeAudioMeta(null)).toBeUndefined();
        expect(normalizeAudioMeta({})).toBeUndefined();
    });
});

describe("mapLocalQuality - lossless", () => {
    it("marks 16-bit/44.1kHz FLAC as flac (SQ)", () => {
        expect(
            mapLocalQuality({
                codec: "flac",
                bitDepth: 16,
                sampleRate: 44100,
                bitrate: 900000,
            }),
        ).toBe("flac");
    });

    it("marks 24-bit/96kHz FLAC as hires (HR)", () => {
        expect(
            mapLocalQuality({
                codec: "flac",
                bitDepth: 24,
                sampleRate: 96000,
                bitrate: 2304000,
            }),
        ).toBe("hires");
    });

    it("marks 16-bit/96kHz FLAC as hires by sample rate alone", () => {
        expect(
            mapLocalQuality({ codec: "flac", sampleRate: 96000 }),
        ).toBe("hires");
    });

    it("maps wav/alac/ape to lossless tiers", () => {
        expect(
            mapLocalQuality({ codec: "wav", bitDepth: 16, sampleRate: 44100 }),
        ).toBe("flac");
        expect(mapLocalQuality({ codec: "alac", sampleRate: 44100 })).toBe(
            "flac",
        );
        expect(mapLocalQuality({ codec: "ape", sampleRate: 44100 })).toBe(
            "flac",
        );
    });
});

describe("mapLocalQuality - lossy", () => {
    it("maps bitrate tiers for known lossy codecs", () => {
        expect(mapLocalQuality({ codec: "mp3", bitrate: 320000 })).toBe("320k");
        expect(mapLocalQuality({ codec: "mp3", bitrate: 319000 })).toBe("192k");
        expect(mapLocalQuality({ codec: "aac", bitrate: 192000 })).toBe("192k");
        expect(mapLocalQuality({ codec: "aac", bitrate: 191000 })).toBe("128k");
        expect(mapLocalQuality({ codec: "mp3", bitrate: 128000 })).toBe("128k");
        expect(mapLocalQuality({ codec: "mp3", bitrate: 96000 })).toBe("96k");
    });

    it("returns null when lossy codec has no bitrate", () => {
        expect(mapLocalQuality({ codec: "mp3" })).toBeNull();
    });
});

describe("mapLocalQuality - unknown info", () => {
    it("returns null for empty or missing meta", () => {
        expect(mapLocalQuality(undefined)).toBeNull();
        expect(mapLocalQuality(null)).toBeNull();
        expect(mapLocalQuality({})).toBeNull();
    });

    it("treats bit depth without codec as lossless", () => {
        expect(mapLocalQuality({ bitDepth: 24 })).toBe("hires");
        expect(mapLocalQuality({ bitDepth: 16 })).toBe("flac");
    });

    it("maps low bitrate without codec to lossy tiers", () => {
        expect(mapLocalQuality({ bitrate: 128000 })).toBe("128k");
        expect(mapLocalQuality({ bitrate: 96000 })).toBe("96k");
    });

    it("never guesses master/hq from a high bitrate alone", () => {
        expect(mapLocalQuality({ bitrate: 2304000 })).toBeNull();
        expect(mapLocalQuality({ bitrate: 900000 })).toBeNull();
    });
});

describe("formatAudioQualityText", () => {
    it("formats codec, bit depth, sample rate and bitrate", () => {
        expect(
            formatAudioQualityText({
                codec: "flac",
                bitDepth: 24,
                sampleRate: 96000,
                bitrate: 2304000,
            }),
        ).toBe("FLAC · 24-bit · 96 kHz · 2304 kbps");
    });

    it("formats fractional sample rates and bitrate-only files", () => {
        expect(
            formatAudioQualityText({ codec: "mp3", bitrate: 319000 }),
        ).toBe("MP3 · 319 kbps");
        expect(
            formatAudioQualityText({
                codec: "flac",
                bitDepth: 16,
                sampleRate: 44100,
                bitrate: 900000,
            }),
        ).toBe("FLAC · 16-bit · 44.1 kHz · 900 kbps");
    });

    it("returns undefined when nothing reliable is known", () => {
        expect(formatAudioQualityText(undefined)).toBeUndefined();
        expect(formatAudioQualityText({ codec: "" })).toBeUndefined();
    });
});

describe("getMusicItemAudioMeta", () => {
    it("reads $audioMeta from internal serialize key", () => {
        const musicItem = {
            id: "1",
            platform: "本地",
            title: "t",
            artist: "a",
            duration: 1,
            album: "al",
            artwork: "",
            $: { localPath: "/tmp/a.flac", audioMeta: { bitDepth: 24 } },
        } as any;
        expect(getMusicItemAudioMeta(musicItem)).toEqual({
            bitrate: undefined,
            sampleRate: undefined,
            bitDepth: 24,
            codec: undefined,
            channelCount: undefined,
        });
    });

    it("prefers metadata from the matching local-sheet copy", () => {
        const requestedItem = {
            id: "1",
            platform: "online",
            $: { audioMeta: { codec: "mp3", bitrate: 128000 } },
        } as any;
        const localMusicItem = {
            id: "1",
            platform: "online",
            $: {
                localPath: "/tmp/downloaded.flac",
                audioMeta: {
                    codec: "flac",
                    bitDepth: 24,
                    sampleRate: 96000,
                },
            },
        } as any;

        expect(resolveLocalAudioMeta(requestedItem, localMusicItem)).toEqual({
            bitrate: undefined,
            sampleRate: 96000,
            bitDepth: 24,
            codec: "flac",
            channelCount: undefined,
        });
    });

    it("returns undefined for legacy items without audioMeta", () => {
        const musicItem = {
            id: "1",
            platform: "本地",
            title: "t",
            artist: "a",
            duration: 1,
            album: "al",
            artwork: "",
            $: { localPath: "/tmp/a.flac" },
        } as any;
        expect(getMusicItemAudioMeta(musicItem)).toBeUndefined();
    });
});
