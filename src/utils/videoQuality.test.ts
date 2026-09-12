import {
    formatVideoQualityDetails,
    getVideoDynamicRange,
    getVideoQualityHeight,
    isHighFrameRate,
    mergeVideoQualityOptions,
    videoSourceQualityOption,
} from "./videoQuality";

describe("video quality metadata", () => {
    it("recognizes 4K, 8K and numeric resolution labels", () => {
        expect(getVideoQualityHeight({ key: "4K" })).toBe(2160);
        expect(getVideoQualityHeight({ key: "uhd", label: "8K HDR" })).toBe(
            4320,
        );
        expect(getVideoQualityHeight({ key: "quality-1080p" })).toBe(1080);
    });

    it("does not let undefined fields erase existing metadata", () => {
        expect(
            mergeVideoQualityOptions(
                [
                    {
                        key: "1080p",
                        label: "Full HD",
                        width: 1920,
                        height: 1080,
                        bitrate: 8_000_000,
                    },
                ],
                [{ key: "1080p", width: undefined, bitrate: 9_000_000 }],
                ["1080p"],
            ),
        ).toEqual([
            {
                key: "1080p",
                label: "Full HD",
                width: 1920,
                height: 1080,
                bitrate: 9_000_000,
            },
        ]);
    });

    it("sorts by resolution before same-resolution range and HFR variants", () => {
        const result = mergeVideoQualityOptions([
            { key: "720-dv", height: 720, dynamicRange: "dolby-vision" },
            { key: "1080-sdr", height: 1080, dynamicRange: "sdr" },
            { key: "1080-hdr", height: 1080, dynamicRange: "hdr10" },
            { key: "1080-hdr-hfr", height: 1080, dynamicRange: "hdr10", label: "60fps" },
        ]);

        expect(result.map(option => option.key)).toEqual([
            "1080-hdr-hfr",
            "1080-hdr",
            "1080-sdr",
            "720-dv",
        ]);
    });

    it("infers dynamic range and high frame rate from common names", () => {
        expect(getVideoDynamicRange({ key: "2160p-dovi" })).toBe(
            "dolby-vision",
        );
        expect(getVideoDynamicRange({ key: "4k_hdr10" })).toBe("hdr10");
        expect(isHighFrameRate({ key: "1080p-60fps" })).toBe(true);
        expect(isHighFrameRate({ key: "1080p" })).toBe(false);
    });

    it("formats resolution, bitrate, size, range, HFR and codec", () => {
        expect(
            formatVideoQualityDetails({
                key: "2160p-dv-60fps",
                width: 3840,
                height: 2160,
                bitrate: 12_500_000,
                size: 2 * 1024 * 1024,
                codec: "HEVC",
            }),
        ).toBe(
            "3840x2160 · 12.5 Mbps · 2.0 MB · Dolby Vision · HFR · HEVC",
        );
    });

    it("keeps plugin default behavior when a source has no quality key", () => {
        expect(videoSourceQualityOption({ url: "https://video.example" })).toBe(
            undefined,
        );
        expect(
            videoSourceQualityOption(
                { url: "https://video.example", height: 1080 },
                "plugin-default",
            ),
        ).toMatchObject({ key: "plugin-default", height: 1080 });
    });

    it("ignores empty quality entries", () => {
        expect(
            mergeVideoQualityOptions(["", "  ", { key: "", height: 720 }]),
        ).toEqual([]);
    });
});
