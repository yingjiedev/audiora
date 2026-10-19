import { AudioEffectsSettings, initialState, presetBands } from "./model";
import { AudioEffectsStore } from "./store";

function snapshot(settings = initialState(true).settings, version = 1) {
    return JSON.stringify({ ...initialState(true), settings, version, status: "ready", frequencies: [60, 230, 910, 3600, 14000] });
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(complete => {
        resolve = complete;
    });
    return { promise, resolve };
}

describe("AudioEffectsStore", () => {
    it("backs up native preferences before the screen is opened and surfaces read failures", async () => {
        const settings = { ...initialState(true).settings, enabled: true, preampDb: -4 };
        const bridge = { getState: jest.fn().mockResolvedValue(snapshot(settings)), setSettings: jest.fn() };
        const store = new AudioEffectsStore(bridge);
        expect(await store.backupSettings()).toEqual(settings);
        expect(bridge.setSettings).not.toHaveBeenCalled();
        bridge.getState.mockRejectedValue(new Error("unavailable"));
        await expect(store.backupSettings()).rejects.toThrow("Unable to read");
    });

    it("waits for queued slider persistence before exporting the tuning", async () => {
        const write = deferred<string>();
        const bridge = { getState: jest.fn().mockResolvedValue(snapshot()), setSettings: jest.fn().mockReturnValue(write.promise) };
        const store = new AudioEffectsStore(bridge);
        await store.refresh();
        const settings = { ...store.getSnapshot().settings, preampDb: -3 };
        const update = store.update(settings);
        const backup = store.backupSettings();
        expect(bridge.getState).toHaveBeenCalledTimes(1);
        bridge.getState.mockResolvedValue(snapshot(settings, 2));
        write.resolve(snapshot(settings, 2));
        await update;
        expect(await backup).toEqual(settings);
    });

    it("restores and persists without a player session and reports native write failures", async () => {
        const settings = { ...initialState(true).settings, enabled: true, preampDb: -4 };
        const bridge = { getState: jest.fn().mockResolvedValue(snapshot()), setSettings: jest.fn().mockResolvedValue(snapshot(settings, 2)) };
        const store = new AudioEffectsStore(bridge);
        await store.restoreSettings(settings);
        expect(JSON.parse(bridge.setSettings.mock.calls[0][0])).toEqual(settings);
        expect(bridge.setSettings.mock.calls[0][1]).toBe(true);
        bridge.setSettings.mockRejectedValue(new Error("disk failure"));
        await expect(store.restoreSettings(settings)).rejects.toThrow("Unable to restore");
    });

    it("preserves portable sound settings on platforms without an audio bridge", async () => {
        const settings = { ...initialState(true).settings, enabled: true };
        const archive = { read: jest.fn().mockReturnValue(settings), write: jest.fn() };
        const store = new AudioEffectsStore(undefined, archive);
        await store.restoreSettings(settings);
        expect(archive.write).toHaveBeenCalledWith(settings);
        expect(await store.backupSettings()).toEqual(settings);
        expect(store.getSnapshot().active).toBe(false);
        expect(store.getSnapshot().status).toBe("unsupported");
        await expect(new AudioEffectsStore().backupSettings()).resolves.toBeUndefined();
    });
    it("does not overwrite native preferences before initial load or call absent native modules", async () => {
        const bridge = { getState: jest.fn(), setSettings: jest.fn() };
        const store = new AudioEffectsStore(bridge);
        expect(await store.update({ ...store.getSnapshot().settings, enabled: true })).toBe(false);
        expect(bridge.setSettings).not.toHaveBeenCalled();
        const unsupported = new AudioEffectsStore();
        await unsupported.refresh();
        expect(await unsupported.update(unsupported.getSnapshot().settings)).toBe(false);
        expect(unsupported.getSnapshot().status).toBe("unsupported");
    });

    it("restores native settings and recovers after a failed read", async () => {
        const restored = { ...initialState(true).settings, enabled: true, preset: "bass" as const, bands: presetBands("bass") };
        const bridge = { getState: jest.fn().mockRejectedValueOnce(new Error("unavailable")).mockResolvedValue(snapshot(restored)), setSettings: jest.fn() };
        const store = new AudioEffectsStore(bridge);
        await store.refresh();
        expect(store.getSnapshot()).toMatchObject({ loaded: false, status: "error", active: false });
        await store.refresh();
        expect(store.getSnapshot()).toMatchObject({ loaded: true, settings: restored });
    });

    it("coalesces live changes, persists the final value, and ignores delayed native echoes", async () => {
        const first = deferred<string>();
        const second = deferred<string>();
        const bridge = {
            getState: jest.fn().mockResolvedValue(snapshot()),
            setSettings: jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),
        };
        const store = new AudioEffectsStore(bridge);
        await store.refresh();
        const settings = store.getSnapshot().settings;
        const live = { ...settings, preampDb: -1 };
        const final = { ...settings, preampDb: -3 };
        const writes = [store.update(live, false), store.update({ ...settings, preampDb: -2 }, false), store.update(final, true)];
        expect(bridge.setSettings).toHaveBeenCalledTimes(1);
        store.receive(snapshot(settings, 2));
        expect(store.getSnapshot().settings.preampDb).toBe(-3);
        first.resolve(snapshot(live, 2));
        await writes[0];
        expect(bridge.setSettings).toHaveBeenCalledTimes(2);
        expect(bridge.setSettings).toHaveBeenLastCalledWith(JSON.stringify(final), true);
        second.resolve(snapshot(final, 3));
        expect(await Promise.all(writes)).toEqual([true, true, true]);
        store.receive(snapshot(settings, 2));
        expect(store.getSnapshot().settings.preampDb).toBe(-3);
    });

    it("keeps a late refresh from undoing a newer edit", async () => {
        const stale = deferred<string>();
        const write = deferred<string>();
        const bridge = { getState: jest.fn().mockReturnValue(stale.promise), setSettings: jest.fn().mockReturnValue(write.promise) };
        const store = new AudioEffectsStore(bridge);
        store.receive(snapshot());
        const refresh = store.refresh();
        const next: AudioEffectsSettings = { ...store.getSnapshot().settings, enabled: true };
        const update = store.update(next);
        stale.resolve(snapshot());
        await refresh;
        expect(store.getSnapshot().settings.enabled).toBe(true);
        write.resolve(snapshot(next, 2));
        await update;
    });

    it("reports failed writes without claiming active effects and allows retry", async () => {
        const bridge = { getState: jest.fn().mockResolvedValue(snapshot()), setSettings: jest.fn().mockRejectedValueOnce(new Error("lost service")) };
        const store = new AudioEffectsStore(bridge);
        await store.refresh();
        const next = { ...store.getSnapshot().settings, enabled: true };
        expect(await store.update(next)).toBe(false);
        expect(store.getSnapshot()).toMatchObject({ active: false, status: "error" });
        bridge.setSettings.mockResolvedValue(snapshot(next, 2));
        expect(await store.update(next)).toBe(true);
        expect(store.getSnapshot().status).toBe("ready");
    });
});
