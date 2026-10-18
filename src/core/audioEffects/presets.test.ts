import {
    applyUserPreset, createUserPreset, defaultSettings, deleteUserPreset, LEGACY_CUSTOM_PRESET_ID,
    MAX_CUSTOM_PRESETS, parseAudioEffectsSettings, presetBands, renameUserPreset, saveUserPreset,
} from "./model";

describe("named sound presets", () => {
    it("creates several independent tunings, applies one and updates only that saved preset", () => {
        const first = createUserPreset({ ...defaultSettings(), bands: presetBands("bass") }, "commute", "  Commute  ");
        const second = createUserPreset({ ...first, bands: presetBands("vocal"), preampDb: -3 }, "vocals", "Night vocals");
        expect(first.customPresets).toHaveLength(1);
        expect(second.customPresets.map(preset => preset.name)).toEqual(["Commute", "Night vocals"]);
        const applied = applyUserPreset(second, "commute");
        expect(applied.bands).toEqual(presetBands("bass"));
        expect(applied.bands).not.toBe(applied.customPresets[0].bands);
        const saved = saveUserPreset({ ...applied, preampDb: -2 }, "commute");
        expect(saved.customPresets.map(preset => preset.preampDb)).toEqual([-2, -3]);
        expect(second.customPresets[0].preampDb).toBe(0);
    });

    it("normalizes names, rejects duplicates and bounds names and the collection", () => {
        const first = createUserPreset(defaultSettings(), "one", "  Night   vocals ");
        expect(first.customPresets[0].name).toBe("Night vocals");
        expect(() => createUserPreset(first, "two", "night VOCALS")).toThrow("duplicateName");
        expect(() => createUserPreset(first, "two", " \n ")).toThrow("nameRequired");
        expect(() => createUserPreset(first, "two", "x".repeat(41))).toThrow("nameRequired");
        expect(createUserPreset(first, "two", "x".repeat(40)).customPresets).toHaveLength(2);
        let settings = defaultSettings();
        for (let index = 0; index < MAX_CUSTOM_PRESETS; index += 1) settings = createUserPreset(settings, `preset-${index}`, `Preset ${index}`);
        expect(() => createUserPreset(settings, "overflow", "Extra")).toThrow("presetLimit");
    });

    it("renames without changing tuning and deletes without changing the current sound", () => {
        const initial = createUserPreset(createUserPreset(defaultSettings(), "one", "One"), "two", "Two");
        const renamed = renameUserPreset(initial, "one", "  Commute ");
        expect(renamed.customPresets[0].name).toBe("Commute");
        expect(renamed.customPresets[0].bands).toBe(initial.customPresets[0].bands);
        expect(() => renameUserPreset(renamed, "one", "two")).toThrow("duplicateName");
        const deleted = deleteUserPreset(initial, "two");
        expect(deleted.activeCustomId).toBeNull();
        expect(deleted.bands).toBe(initial.bands);
        expect(deleted.customPresets.map(preset => preset.id)).toEqual(["one"]);
        expect(() => applyUserPreset(deleted, "two")).toThrow("presetMissing");
        expect(() => saveUserPreset(deleted, "two")).toThrow("presetMissing");
    });

    it("migrates the old single slot and never resurrects it after an explicit empty library", () => {
        const legacy = { enabled: true, preset: "custom", bands: presetBands("vocal"), preampDb: -3,
            savedCustom: { bands: presetBands("vocal"), preampDb: -3 } };
        const migrated = parseAudioEffectsSettings(legacy);
        expect(migrated.activeCustomId).toBe(LEGACY_CUSTOM_PRESET_ID);
        expect(migrated.customPresets).toEqual([{ ...legacy.savedCustom, id: LEGACY_CUSTOM_PRESET_ID, name: "My preset" }]);
        expect(parseAudioEffectsSettings({ ...legacy, preampDb: -4 }).activeCustomId).toBeNull();
        expect(parseAudioEffectsSettings({ ...legacy, customPresets: [], activeCustomId: null }).customPresets).toEqual([]);
    });

    it("rejects duplicate identities, invalid saved curves and dangling selected presets on import", () => {
        const valid = createUserPreset(defaultSettings(), "one", "One");
        const entry = valid.customPresets[0];
        for (const patch of [
            { customPresets: [entry, entry] },
            { customPresets: [entry, { ...entry, id: "two", name: "ONE" }] },
            { customPresets: [{ ...entry, name: "" }] },
            { customPresets: [{ ...entry, preampDb: 2 }] },
            { activeCustomId: "missing" },
            { preset: "flat" },
        ]) expect(() => parseAudioEffectsSettings({ ...valid, ...patch })).toThrow();
    });
});
