export interface EqualizerBand {
    frequencyHz: number;
    gainDb: number;
}

export interface AudioEffectsTuning {
    bands: EqualizerBand[];
    preampDb: number;
}

export const PRESET_IDS = ["flat", "vocal", "bass", "bright", "soft", "pop", "rock", "jazz", "classical", "electronic"] as const;
export type AudioEffectsPreset = typeof PRESET_IDS[number] | "custom";

export const MAX_CUSTOM_PRESETS = 32;
export const MAX_PRESET_NAME_LENGTH = 40;
export const LEGACY_CUSTOM_PRESET_ID = "legacy-custom";

export interface AudioEffectsUserPreset extends AudioEffectsTuning {
    id: string;
    name: string;
}

export interface AudioEffectsSettings extends AudioEffectsTuning {
    enabled: boolean;
    preset: AudioEffectsPreset;
    customPresets: AudioEffectsUserPreset[];
    activeCustomId: string | null;
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
    pop: [1, 2, 2, 0, -1, 1, 2, 2, 1, 0],
    rock: [3, 3, 2, 0, -1, -1, 1, 2, 3, 2],
    jazz: [2, 1, 0, 1, 1, 1, 2, 1, 2, 1],
    classical: [1, 1, 0, 0, -1, 0, 0, 1, 2, 2],
    electronic: [4, 3, 1, 0, -2, 0, 1, 2, 3, 3],
};

export function presetBands(preset: typeof PRESET_IDS[number]): EqualizerBand[] {
    return FREQUENCIES.map((frequencyHz, index) => ({ frequencyHz, gainDb: CURVES[preset][index] }));
}

export function defaultSettings(): AudioEffectsSettings {
    return { enabled: false, preset: "flat", bands: presetBands("flat"), preampDb: 0, customPresets: [], activeCustomId: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Validate portable tuning before restoring anything; never import device/session state. */
function parseTuning(value: unknown): AudioEffectsTuning {
    if (!isRecord(value) || !Array.isArray(value.bands) || value.bands.length === 0 || value.bands.length > 32 ||
        typeof value.preampDb !== "number" || !Number.isFinite(value.preampDb) || value.preampDb < -12 || value.preampDb > 0) {
        throw new Error("Invalid audio effects tuning");
    }
    let previousFrequency = 0;
    const bands = value.bands.map(band => {
        if (!isRecord(band) || typeof band.frequencyHz !== "number" || !Number.isFinite(band.frequencyHz) ||
            band.frequencyHz < 20 || band.frequencyHz > 24000 || band.frequencyHz <= previousFrequency ||
            typeof band.gainDb !== "number" || !Number.isFinite(band.gainDb) || Math.abs(band.gainDb) > 6) {
            throw new Error("Invalid audio effects bands");
        }
        previousFrequency = band.frequencyHz;
        return { frequencyHz: band.frequencyHz, gainDb: band.gainDb };
    });
    return { bands, preampDb: value.preampDb };
}

export function parseAudioEffectsSettings(value: unknown): AudioEffectsSettings {
    if (!isRecord(value) || typeof value.enabled !== "boolean" ||
        ![...PRESET_IDS, "custom"].includes(value.preset as AudioEffectsPreset)) {
        throw new Error("Invalid audio effects settings");
    }
    const legacy = value.savedCustom == null ? null : parseTuning(value.savedCustom);
    const presets: AudioEffectsUserPreset[] = [];
    if (value.customPresets === undefined) {
        if (legacy) presets.push({ ...legacy, id: LEGACY_CUSTOM_PRESET_ID, name: "My preset" });
    } else {
        if (!Array.isArray(value.customPresets) || value.customPresets.length > MAX_CUSTOM_PRESETS) {
            throw new Error("Invalid custom audio presets");
        }
        const ids = new Set<string>();
        const names = new Set<string>();
        for (const entry of value.customPresets) {
            if (!isRecord(entry) || typeof entry.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.id) ||
                typeof entry.name !== "string" || !entry.name.trim() || entry.name.length > MAX_PRESET_NAME_LENGTH ||
                ids.has(entry.id) || names.has(normalizePresetName(entry.name).toLowerCase())) {
                throw new Error("Invalid custom audio preset");
            }
            ids.add(entry.id);
            const name = normalizePresetName(entry.name);
            names.add(name.toLowerCase());
            presets.push({ ...parseTuning(entry), id: entry.id, name });
        }
    }
    const activeCustomId = value.activeCustomId === undefined
        ? value.preset === "custom" && legacy && sameTuning(parseTuning(value), legacy) ? LEGACY_CUSTOM_PRESET_ID : null
        : value.activeCustomId;
    if (activeCustomId !== null && (typeof activeCustomId !== "string" || value.preset !== "custom" || !presets.some(preset => preset.id === activeCustomId))) {
        throw new Error("Invalid active custom audio preset");
    }
    return {
        ...parseTuning(value),
        enabled: value.enabled,
        preset: value.preset as AudioEffectsPreset,
        customPresets: presets,
        activeCustomId,
    };
}

export class AudioPresetError extends Error {
    constructor(readonly reason: "nameRequired" | "duplicateName" | "presetLimit" | "presetMissing") {
        super(reason);
    }
}

function normalizePresetName(name: string): string {
    const normalized = name.trim().replace(/\s+/g, " ");
    if (!normalized || normalized.length > MAX_PRESET_NAME_LENGTH) throw new AudioPresetError("nameRequired");
    return normalized;
}

function uniquePresetName(settings: AudioEffectsSettings, name: string, exceptId?: string) {
    const normalized = normalizePresetName(name);
    if (settings.customPresets.some(preset => preset.id !== exceptId && preset.name.toLowerCase() === normalized.toLowerCase())) {
        throw new AudioPresetError("duplicateName");
    }
    return normalized;
}

function copyTuning(tuning: AudioEffectsTuning): AudioEffectsTuning {
    return { bands: tuning.bands.map(band => ({ ...band })), preampDb: tuning.preampDb };
}

export function createUserPreset(settings: AudioEffectsSettings, id: string, name: string): AudioEffectsSettings {
    if (settings.customPresets.length >= MAX_CUSTOM_PRESETS) throw new AudioPresetError("presetLimit");
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || settings.customPresets.some(preset => preset.id === id)) throw new Error("Invalid preset ID");
    const preset = { ...copyTuning(settings), id, name: uniquePresetName(settings, name) };
    return { ...settings, preset: "custom", activeCustomId: id, customPresets: [...settings.customPresets, preset] };
}

export function applyUserPreset(settings: AudioEffectsSettings, id: string): AudioEffectsSettings {
    const preset = settings.customPresets.find(entry => entry.id === id);
    if (!preset) throw new AudioPresetError("presetMissing");
    return { ...settings, ...copyTuning(preset), preset: "custom", activeCustomId: id };
}

export function saveUserPreset(settings: AudioEffectsSettings, id: string): AudioEffectsSettings {
    if (!settings.customPresets.some(entry => entry.id === id)) throw new AudioPresetError("presetMissing");
    return {
        ...settings, preset: "custom", activeCustomId: id,
        customPresets: settings.customPresets.map(entry => entry.id === id ? { ...entry, ...copyTuning(settings) } : entry),
    };
}

export function renameUserPreset(settings: AudioEffectsSettings, id: string, name: string): AudioEffectsSettings {
    if (!settings.customPresets.some(entry => entry.id === id)) throw new AudioPresetError("presetMissing");
    const normalized = uniquePresetName(settings, name, id);
    return { ...settings, customPresets: settings.customPresets.map(entry => entry.id === id ? { ...entry, name: normalized } : entry) };
}

export function deleteUserPreset(settings: AudioEffectsSettings, id: string): AudioEffectsSettings {
    return { ...settings, activeCustomId: settings.activeCustomId === id ? null : settings.activeCustomId, customPresets: settings.customPresets.filter(entry => entry.id !== id) };
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
    const frequencies = state.frequencies.length ? state.frequencies : FREQUENCIES;
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
    if (!state || !Number.isSafeInteger(state.version) || state.version < 0 ||
        !["waiting", "ready", "unsupported", "error"].includes(state.status) ||
        typeof state.active !== "boolean" ||
        !Array.isArray(state.frequencies) || state.frequencies.length > 32 ||
        !state.frequencies.every(frequency => Number.isFinite(frequency) && frequency > 0) ||
        !Number.isFinite(state.minimumGain) || !Number.isFinite(state.maximumGain) ||
        state.minimumGain > 0 || state.maximumGain < 0 || state.minimumGain >= state.maximumGain ||
        typeof state.supportsPreamp !== "boolean" || typeof state.supportsLimiter !== "boolean") {
        throw new Error("Invalid audio effects state");
    }
    return { ...state, settings: parseAudioEffectsSettings(state.settings), loaded: true };
}

export function formatFrequency(frequencyHz: number): string {
    return frequencyHz >= 1000 ? `${+(frequencyHz / 1000).toFixed(1)} kHz` : `${+frequencyHz.toFixed(1)} Hz`;
}

export function formatGain(gainDb: number): string {
    const rounded = Math.round(gainDb * 10) / 10;
    return `${rounded > 0 ? "+" : ""}${rounded} dB`;
}
