export interface EqualizerBand {
    frequencyHz: number;
    gainDb: number;
}

export interface AudioEffectsTuning {
    bands: EqualizerBand[];
    preampDb: number;
}

export const PRESET_IDS = ["flat", "vocal", "bass", "bright", "soft"] as const;
export type AudioEffectsPreset = typeof PRESET_IDS[number] | "custom";

export interface AudioEffectsSettings extends AudioEffectsTuning {
    enabled: boolean;
    preset: AudioEffectsPreset;
    savedCustom: AudioEffectsTuning | null;
}

export interface AudioEffectsState {
    loaded: boolean;
    version: number;
    settings: AudioEffectsSettings;
    status: "waiting" | "ready" | "unsupported" | "error";
    active: boolean;
    frequencies: number[];
    minimumGain: number;
    maximumGain: number;
    supportsPreamp: boolean;
    supportsLimiter: boolean;
}

const FREQUENCIES = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const CURVES: Record<typeof PRESET_IDS[number], number[]> = {
    flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    vocal: [-2, -2, -1, 0, 1, 2, 3, 2, 0, -1],
    bass: [4, 4, 3, 1, 0, -1, -1, 0, 0, 0],
    bright: [-1, -1, 0, 0, 0, 1, 2, 3, 3, 2],
    soft: [1, 1, 1, 0, 0, 0, -1, -2, -3, -3],
};

export function presetBands(preset: typeof PRESET_IDS[number]): EqualizerBand[] {
    return FREQUENCIES.map((frequencyHz, index) => ({ frequencyHz, gainDb: CURVES[preset][index] }));
}

export function defaultSettings(): AudioEffectsSettings {
    return { enabled: false, preset: "flat", bands: presetBands("flat"), preampDb: 0, savedCustom: null };
}

export function sameTuning(left: AudioEffectsTuning, right: AudioEffectsTuning | null): boolean {
    return !!right && left.preampDb === right.preampDb && left.bands.length === right.bands.length &&
        left.bands.every((band, index) => band.frequencyHz === right.bands[index].frequencyHz && band.gainDb === right.bands[index].gainDb);
}

export function initialState(supported: boolean): AudioEffectsState {
    return {
        loaded: false,
        version: -1,
        settings: defaultSettings(),
        status: supported ? "waiting" : "unsupported",
        active: false,
        frequencies: [],
        minimumGain: -6,
        maximumGain: 6,
        supportsPreamp: false,
        supportsLimiter: false,
    };
}

/** Interpolate control points across devices whose native frequency bands differ. */
export function gainAt(bands: EqualizerBand[], frequencyHz: number): number {
    if (frequencyHz <= bands[0].frequencyHz) {
        return bands[0].gainDb;
    }
    const last = bands[bands.length - 1];
    if (frequencyHz >= last.frequencyHz) {
        return last.gainDb;
    }
    const upper = bands.findIndex(band => band.frequencyHz >= frequencyHz);
    const left = bands[upper - 1];
    const right = bands[upper];
    const fraction = Math.log(frequencyHz / left.frequencyHz) / Math.log(right.frequencyHz / left.frequencyHz);
    return left.gainDb + fraction * (right.gainDb - left.gainDb);
}

export function editBand(state: AudioEffectsState, frequencyHz: number, gainDb: number): AudioEffectsSettings {
    const frequencies = state.frequencies;
    if (!frequencies.includes(frequencyHz) || !Number.isFinite(gainDb)) {
        return state.settings;
    }
    return {
        ...state.settings,
        preset: "custom",
        bands: frequencies.map(frequency => ({
            frequencyHz: frequency,
            gainDb: Math.max(state.minimumGain, Math.min(state.maximumGain,
                frequency === frequencyHz ? gainDb : gainAt(state.settings.bands, frequency))),
        })),
    };
}

export function parseNativeState(raw: string): AudioEffectsState {
    const state = JSON.parse(raw) as AudioEffectsState;
    const validBands = (bands: EqualizerBand[]) => Array.isArray(bands) && bands.length > 0 && bands.length <= 32 &&
        bands.every((band, index) => Number.isFinite(band.frequencyHz) && band.frequencyHz >= 20 && band.frequencyHz <= 24000 &&
            Number.isFinite(band.gainDb) && Math.abs(band.gainDb) <= 6 &&
            (index === 0 || band.frequencyHz > bands[index - 1].frequencyHz));
    const validTuning = (tuning: AudioEffectsTuning) => tuning && validBands(tuning.bands) &&
        Number.isFinite(tuning.preampDb) && tuning.preampDb >= -12 && tuning.preampDb <= 0;
    if (!state || !Number.isSafeInteger(state.version) || state.version < 0 ||
        !["waiting", "ready", "unsupported", "error"].includes(state.status) ||
        typeof state.active !== "boolean" || !state.settings || typeof state.settings.enabled !== "boolean" ||
        ![...PRESET_IDS, "custom"].includes(state.settings.preset) || !validTuning(state.settings) ||
        (state.settings.savedCustom !== null && !validTuning(state.settings.savedCustom)) ||
        !Array.isArray(state.frequencies) || state.frequencies.length > 32 ||
        !state.frequencies.every(frequency => Number.isFinite(frequency) && frequency > 0) ||
        !Number.isFinite(state.minimumGain) || !Number.isFinite(state.maximumGain) ||
        state.minimumGain > 0 || state.maximumGain < 0 || state.minimumGain >= state.maximumGain ||
        typeof state.supportsPreamp !== "boolean" || typeof state.supportsLimiter !== "boolean") {
        throw new Error("Invalid audio effects state");
    }
    return { ...state, loaded: true };
}

export function formatFrequency(frequencyHz: number): string {
    return frequencyHz >= 1000 ? `${+(frequencyHz / 1000).toFixed(1)} kHz` : `${+frequencyHz.toFixed(1)} Hz`;
}

export function formatGain(gainDb: number): string {
    const rounded = Math.round(gainDb * 10) / 10;
    return `${rounded > 0 ? "+" : ""}${rounded} dB`;
}
