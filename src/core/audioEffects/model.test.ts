import { defaultSettings, editBand, formatFrequency, formatGain, gainAt, initialState, parseNativeState, presetBands } from "./model";

describe("audio effects curves", () => {
    it("interpolates by logarithmic frequency and holds the end bands", () => {
        const bands = [{ frequencyHz: 100, gainDb: -4 }, { frequencyHz: 400, gainDb: 4 }];
        expect(gainAt(bands, 200)).toBeCloseTo(0);
        expect(gainAt(bands, 20)).toBe(-4);
        expect(gainAt(bands, 20000)).toBe(4);
    });

    it("edits the actual device bands while retaining the tuning at the other frequencies", () => {
        const state = { ...initialState(true), frequencies: [60, 230, 910, 3600, 14000], minimumGain: -3, maximumGain: 3 };
        state.settings = { ...defaultSettings(), bands: presetBands("bass") };
        const next = editBand(state, 910, -20);
        expect(next.preset).toBe("custom");
        expect(next.bands.map(band => band.frequencyHz)).toEqual(state.frequencies);
        expect(next.bands[2].gainDb).toBe(-3);
        expect(next.bands[0].gainDb).toBe(3);
        expect(editBand(state, 999, 2)).toBe(state.settings);
        expect(editBand(state, 910, NaN)).toBe(state.settings);
    });

    it("returns independent presets and formats sub-bass/high bands and signed gains", () => {
        const bands = presetBands("flat");
        bands[0].gainDb = 6;
        expect(presetBands("flat")[0].gainDb).toBe(0);
        expect(formatFrequency(31.5)).toBe("31.5 Hz");
        expect(formatFrequency(16000)).toBe("16 kHz");
        expect(formatGain(2.51)).toBe("+2.5 dB");
        expect(formatGain(-0.001)).toBe("0 dB");
    });

    it("rejects corrupt or unsafe native curves and accepts a restored custom preset", () => {
        const state = { ...initialState(true), version: 1 };
        state.settings.savedCustom = { bands: presetBands("vocal"), preampDb: -3 };
        expect(parseNativeState(JSON.stringify(state)).loaded).toBe(true);
        for (const bands of [[], [{ frequencyHz: 0, gainDb: 0 }], [{ frequencyHz: 60, gainDb: 100 }],
            [{ frequencyHz: 200, gainDb: 0 }, { frequencyHz: 60, gainDb: 0 }]]) {
            expect(() => parseNativeState(JSON.stringify({ ...state, settings: { ...state.settings, bands } }))).toThrow();
        }
        expect(() => parseNativeState("{} ")).toThrow();
        expect(() => parseNativeState("invalid")).toThrow();
    });
});
