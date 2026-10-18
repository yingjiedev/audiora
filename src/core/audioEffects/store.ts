import { AudioEffectsSettings, AudioEffectsState, initialState, parseAudioEffectsSettings, parseNativeState } from "./model";

export interface AudioEffectsBridge {
    getState(): Promise<string>;
    setSettings(settings: string, persist: boolean): Promise<string>;
}

export interface AudioEffectsArchive {
    read(): unknown;
    write(settings: AudioEffectsSettings): void;
}

/** Serializes writes, coalesces slider moves, and keeps delayed native replies from undoing a newer gesture. */
export class AudioEffectsStore {
    private state: AudioEffectsState;
    private listeners = new Set<() => void>();
    private revision = 0;
    private writing = false;
    private idleListeners = new Set<() => void>();
    private pending: { settings: AudioEffectsSettings; persist: boolean; complete: ((success: boolean) => void)[] } | null = null;

    constructor(private bridge?: AudioEffectsBridge, private archive?: AudioEffectsArchive) {
        this.state = initialState(!!bridge);
    }

    getSnapshot = () => this.state;

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    private publish(state: AudioEffectsState) {
        this.state = state;
        this.listeners.forEach(listener => listener());
    }

    private fail() {
        this.publish({ ...this.state, status: "error", active: false });
    }

    receive = (raw: string, preserveSettings = this.writing) => {
        try {
            const next = parseNativeState(raw);
            if (next.version < this.state.version) {
                return true;
            }
            this.publish({ ...next, settings: preserveSettings ? this.state.settings : next.settings });
            return true;
        } catch {
            this.fail();
            return false;
        }
    };

    refresh = async () => {
        if (!this.bridge) {
            return false;
        }
        const revision = this.revision;
        try {
            const raw = await this.bridge.getState();
            return this.receive(raw, this.writing || revision !== this.revision);
        } catch {
            this.fail();
            return false;
        }
    };

    /** Read preferences even when the settings screen has never been opened. */
    backupSettings = async (): Promise<AudioEffectsSettings | undefined> => {
        if (!this.bridge) {
            const archived = this.archive?.read();
            return archived === undefined ? undefined : parseAudioEffectsSettings(archived);
        }
        if (this.writing) {
            await new Promise<void>(resolve => this.idleListeners.add(resolve));
        }
        if (!await this.refresh()) {
            throw new Error("Unable to read audio effects settings");
        }
        return parseAudioEffectsSettings(this.state.settings);
    };

    restoreSettings = async (value: AudioEffectsSettings) => {
        const settings = parseAudioEffectsSettings(value);
        // iOS can still restore the shared playlist/plugin envelope.
        if (!this.bridge) {
            this.archive?.write(settings);
            return;
        }
        if (!this.state.loaded && !await this.refresh()) {
            throw new Error("Unable to load audio effects settings");
        }
        if (!await this.update(settings)) {
            throw new Error("Unable to restore audio effects settings");
        }
    };

    update = (settings: AudioEffectsSettings, persist = true) => {
        if (!this.bridge || !this.state.loaded) {
            return Promise.resolve(false);
        }
        this.revision += 1;
        const previous = this.pending;
        const completion = new Promise<boolean>(resolve => {
            this.pending = { settings, persist: persist || !!previous?.persist, complete: [...(previous?.complete ?? []), resolve] };
        });
        this.publish({ ...this.state, settings });
        this.flush();
        return completion;
    };

    private async flush() {
        if (this.writing || !this.bridge) {
            return;
        }
        this.writing = true;
        try {
            while (this.pending) {
                const next = this.pending;
                this.pending = null;
                const revision = this.revision;
                try {
                    const raw = await this.bridge.setSettings(JSON.stringify(next.settings), next.persist);
                    const success = this.receive(raw, revision !== this.revision);
                    next.complete.forEach(complete => complete(success));
                } catch {
                    this.fail();
                    next.complete.forEach(complete => complete(false));
                }
            }
        } finally {
            this.writing = false;
            this.idleListeners.forEach(resolve => resolve());
            this.idleListeners.clear();
        }
    }
}
