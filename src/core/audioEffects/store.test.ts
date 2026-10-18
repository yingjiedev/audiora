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
