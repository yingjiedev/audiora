import Mp3Util from "@/native/mp3Util";
import {
    getImmediateActualQuality,
    probeActualAudioQuality,
    resetAudioQualityProbeCacheForTests,
} from "./audioQuality";

jest.mock("@/native/mp3Util", () => ({
    __esModule: true,
    default: {
        getAudioMeta: jest.fn(),
    },
}));

const getAudioMetaMock = Mp3Util.getAudioMeta as jest.MockedFunction<
    typeof Mp3Util.getAudioMeta
>;

describe("online playback audio quality", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetAudioQualityProbeCacheForTests();
    });

    it("uses the actual quality explicitly reported by a plugin", () => {
        expect(getImmediateActualQuality({
            url: "https://example.com/audio",
            quality: "master",
        })).toBe("master");
        expect(getImmediateActualQuality({
            url: "https://example.com/audio",
            quality: "high",
        })).toBe("320k");
    });

    it("maps technical metadata included in the source", () => {
        expect(getImmediateActualQuality({
            url: "https://example.com/audio.flac",
            audioMeta: {
                codec: "flac",
                bitDepth: 24,
                sampleRate: 96000,
            },
        })).toBe("hires");
    });

    it("probes an unreported source and reuses the local mapping rules", async () => {
        getAudioMetaMock.mockResolvedValue({
            codec: "mp3",
            bitrate: 192000,
            sampleRate: 44100,
        });

        await expect(probeActualAudioQuality({
            url: "https://example.com/audio.mp3",
            headers: { Authorization: "token" },
        })).resolves.toBe("192k");

        expect(getAudioMetaMock).toHaveBeenCalledWith(
            "https://example.com/audio.mp3",
            { Authorization: "token" },
        );
    });

    it("coalesces concurrent probes and caches their result", async () => {
        let resolveMeta: (
            value: IMusic.IAudioTechnicalMeta,
        ) => void = () => undefined;
        getAudioMetaMock.mockImplementation(() => new Promise(resolve => {
            resolveMeta = resolve;
        }));
        const source = { url: "https://example.com/shared.flac" };

        const first = probeActualAudioQuality(source);
        const second = probeActualAudioQuality(source);
        resolveMeta({ codec: "flac", bitDepth: 16, sampleRate: 44100 });

        await expect(first).resolves.toBe("flac");
        await expect(second).resolves.toBe("flac");
        await expect(probeActualAudioQuality(source)).resolves.toBe("flac");
        expect(getAudioMetaMock).toHaveBeenCalledTimes(1);
    });

    it("returns unknown when probing fails", async () => {
        getAudioMetaMock.mockRejectedValue(new Error("network failed"));

        await expect(probeActualAudioQuality({
            url: "https://example.com/unavailable",
        })).resolves.toBeNull();
    });
});
