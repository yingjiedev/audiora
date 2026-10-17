/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import type { State, Track } from "react-native-track-player";

jest.mock("react-native-background-timer", () => ({
    setTimeout: (callback: () => void, milliseconds: number) => setTimeout(callback, milliseconds),
}));
jest.mock("jotai", () => {
    const { atom, createStore } = jest.requireActual("jotai/vanilla");
    const store = createStore();
    return { atom, getDefaultStore: () => store, useAtomValue: jest.fn() };
});
jest.mock("react-native-track-player", () => ({
    __esModule: true,
    Event: {
        PlaybackState: "playback-state",
        PlaybackError: "playback-error",
        PlaybackQueueEnded: "playback-queue-ended",
        PlaybackActiveTrackChanged: "playback-active-track-changed",
    },
    State: {
        Playing: "playing",
        Paused: "paused",
        Stopped: "stopped",
        Loading: "loading",
        Buffering: "buffering",
        Error: "error",
        Ended: "ended",
    },
    default: {
        addEventListener: jest.fn(),
        setQueue: jest.fn(),
        getTrack: jest.fn(),
        getActiveTrack: jest.fn(),
        getActiveTrackIndex: jest.fn(),
        getPlaybackState: jest.fn(),
        getProgress: jest.fn(async () => ({ position: 0, duration: 180 })),
        play: jest.fn(),
        pause: jest.fn(),
        skip: jest.fn(),
        reset: jest.fn(),
        seekTo: jest.fn(),
        updateMetadataForTrack: jest.fn(),
    },
}));
jest.mock("@/components/dialogs/useDialog", () => ({
    getCurrentDialog: jest.fn(),
    showDialog: jest.fn(),
}));
jest.mock("@/constants/commonConst", () => ({
    internalFakeSoundKey: "fake-key",
    sortIndexSymbol: Symbol("sort"),
    timeStampSymbol: Symbol("timestamp"),
}));
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: "cover" } }));
jest.mock("@/utils/log", () => ({
    appendStartupBreadcrumb: jest.fn(),
    errorLog: jest.fn(),
    trace: jest.fn(),
    devLog: jest.fn(),
}));
jest.mock("@/utils/toast", () => ({ warn: jest.fn() }));
jest.mock("@/utils/qualities", () => ({
    getQualityText: () => ({}),
    getPluginQualityScope: () => ["320k"],
    getQualityOrder: () => ["320k"],
    getSmartQuality: () => "320k",
    pickSupportedQuality: () => "320k",
}));
jest.mock("@/core/i18n", () => ({
    t: (key: string) => key,
    getLanguage: () => ({ languageData: {} }),
}));
jest.mock("@/utils/network", () => ({ isCellular: false }));
jest.mock("@/utils/persistStatus", () => ({ get: jest.fn(), set: jest.fn() }));
jest.mock("@/utils/mediaExtra", () => ({ getMediaExtraProperty: jest.fn() }));
jest.mock("@/utils/localQuality", () => ({
    mapLocalQuality: () => "320k",
    resolveLocalAudioMeta: jest.fn(),
}));
jest.mock("@/utils/fileUtils", () => ({ resolveImportedAssetOrPath: (value: unknown) => value }));
jest.mock("@/utils/artwork", () => ({ resolveArtwork: () => "cover" }));
jest.mock("../localMusicSheet", () => ({ isLocalMusic: () => false }));
jest.mock("@/core/musicSheet", () => ({ favorites: { groupFor: () => null } }));
jest.mock("./localPlayback", () => ({ getLocalPlaybackSource: () => null }));
jest.mock("@/service/mflac/songKey", () => ({
    QmcKeyError: class extends Error {},
    EncryptedSourceError: class extends Error {},
}));
jest.mock("./mediaSourceAdapter", () => ({
    adaptMediaSourceForPlayback: jest.fn(async source => source),
    canReuseMediaSourceForPlayback: () => true,
}));

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

async function flushPromises() {
    for (let index = 0; index < 30; index++) {
        await Promise.resolve();
    }
}

const items = Array.from({ length: 8 }, (_, index) => ({
    id: String(index),
    platform: "test",
    title: String.fromCharCode(65 + index),
    artwork: "cover",
})) as IMusic.IMusicItem[];

describe("TrackPlayer playback lifecycle", () => {
    let player: typeof import("./index").default;
    let native: jest.Mocked<typeof import("react-native-track-player").default>;
    let event: typeof import("react-native-track-player").Event;
    let state: typeof import("react-native-track-player").State;
    let queue: Track[];
    let activeIndex: number;
    let playbackState: State;
    let listeners: Map<string, (payload: any) => Promise<void>>;
    let getMediaSource: jest.Mock;
    let toast: { warn: jest.Mock };
    let adaptSource: jest.Mock;
    let autoStopWhenError: boolean;
    let sheetHistory: typeof import("@/core/sheetPlaybackHistory");

    beforeEach(async () => {
        jest.useFakeTimers();
        jest.isolateModules(() => {
            const rntp = require("react-native-track-player");
            native = rntp.default;
            event = rntp.Event;
            state = rntp.State;
            toast = require("@/utils/toast");
            adaptSource = require("./mediaSourceAdapter").adaptMediaSourceForPlayback;
            player = require("./index").default;
            sheetHistory = require("@/core/sheetPlaybackHistory");
        });
        queue = [];
        activeIndex = 0;
        playbackState = state.Paused;
        autoStopWhenError = false;
        listeners = new Map();
        native.addEventListener.mockImplementation((name, callback) => {
            listeners.set(name, callback as (payload: any) => Promise<void>);
            return { remove: jest.fn() } as unknown as ReturnType<typeof native.addEventListener>;
        });
        native.setQueue.mockImplementation(async tracks => {
            queue = tracks as Track[];
            activeIndex = 0;
            playbackState = state.Loading;
        });
        native.getTrack.mockImplementation(async index => queue[index]);
        native.getActiveTrack.mockImplementation(async () => queue[activeIndex]);
        native.getActiveTrackIndex.mockImplementation(async () => activeIndex);
        native.getPlaybackState.mockImplementation(async () => {
            if (playbackState === state.Error) {
                return { state: state.Error, error: { code: "test-error", message: "playback failed" } };
            }
            return { state: playbackState };
        });
        native.updateMetadataForTrack.mockImplementation(async (index, metadata) => {
            if (queue[index]) {
                queue[index] = { ...queue[index], ...metadata };
            }
        });
        native.play.mockImplementation(async () => {
            playbackState = state.Buffering;
        });
        native.pause.mockImplementation(async () => {
            playbackState = state.Paused;
        });
        native.skip.mockImplementation(async index => {
            activeIndex = index;
        });
        getMediaSource = jest.fn(async item => ({ url: `https://source/${item.id}.mp3` }));
        player.injectDependencies(
            { getConfig: (key: string) => key === "basic.defaultPlayQuality" ? "320k" : key === "basic.autoStopWhenError" && autoStopWhenError } as any,
            { addMusic: jest.fn() } as any,
            { getByName: () => ({ instance: {}, methods: { getMediaSource } }) } as any,
        );
        await player.setupTrackPlayer();
        player.addAll(items);
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    function emit(name: string, payload: any = {}) {
        return listeners.get(name)!(payload);
    }

    async function failNative() {
        playbackState = state.Error;
        const failed = emit(event.PlaybackError, {
            message: "Response code: 403",
            code: "android-io-bad-http-status",
        });
        await jest.advanceTimersByTimeAsync(500);
        await failed;
    }

    function reachFakeTrack() {
        activeIndex = 1;
        playbackState = state.Ended;
        return { index: 1, lastIndex: 0, track: queue[1] };
    }

    it("ignores a late rejection after the user selects another track", async () => {
        const source = deferred<IPlugin.IMediaSourceResult>();
        getMediaSource.mockImplementationOnce(() => source.promise);
        const oldPlay = player.play(items[0]);
        await flushPromises();
        await player.play(items[1]);

        source.reject(new Error("late source failure"));
        await jest.advanceTimersByTimeAsync(1000);
        await oldPlay;

        expect(player.currentMusic?.id).toBe(items[1].id);
        expect(getMediaSource).toHaveBeenCalledTimes(2);
    });

    it("distinguishes old requests when switching away and back to the same track", async () => {
        const source = deferred<IPlugin.IMediaSourceResult>();
        getMediaSource.mockImplementationOnce(() => source.promise);
        const oldPlay = player.play(items[0]);
        await flushPromises();
        await player.play(items[1]);
        await player.play(items[0]);

        source.reject(new Error("old A request failed"));
        await jest.advanceTimersByTimeAsync(1000);
        await oldPlay;

        expect(player.currentMusic?.id).toBe(items[0].id);
        expect(getMediaSource).toHaveBeenCalledTimes(3);
    });

    it("discards source adaptation that finishes after a newer selection", async () => {
        const source = deferred<IPlugin.IMediaSourceResult>();
        adaptSource.mockImplementationOnce(() => source.promise);
        const oldPlay = player.play(items[0]);
        await flushPromises();
        await player.play(items[1]);

        source.resolve({ url: "https://source/old-adapted.mp3" });
        await oldPlay;

        expect(queue[0].id).toBe(items[1].id);
        expect(player.currentMusic?.id).toBe(items[1].id);
    });

    it.each(["select", "pause", "clear"])("cancels a delayed failure advance after %s", async action => {
        getMediaSource.mockRejectedValueOnce(new Error("source failure"));
        const failedPlay = player.play(items[0]);
        await flushPromises();
        if (action === "select") {
            await player.play(items[1]);
        } else if (action === "pause") {
            await player.pause();
        } else {
            await player.clearPlayList();
        }

        await jest.advanceTimersByTimeAsync(1000);
        await failedPlay;

        expect(player.currentMusic?.id ?? null).toBe(action === "select" ? items[1].id : action === "pause" ? items[0].id : null);
        expect(getMediaSource).toHaveBeenCalledTimes(action === "select" ? 2 : 1);
    });

    it.each(["queue-first", "fake-first"])("advances once when end events arrive %s", async order => {
        await player.play(items[0]);
        const fake = reachFakeTrack();

        if (order === "queue-first") {
            await emit(event.PlaybackQueueEnded, { track: 1, position: 0 });
            await emit(event.PlaybackActiveTrackChanged, fake);
        } else {
            await emit(event.PlaybackActiveTrackChanged, fake);
            await jest.advanceTimersByTimeAsync(3000);
            await emit(event.PlaybackQueueEnded, { track: 1, position: 0 });
        }

        expect(player.currentMusic?.id).toBe(items[1].id);
        expect(getMediaSource).toHaveBeenCalledTimes(2);
    });

    it("keeps the sleep-timer pause when duplicate end events arrive much later", async () => {
        await player.play(items[0]);
        player.pauseAfterCurrentTrack();
        const fake = reachFakeTrack();
        await emit(event.PlaybackActiveTrackChanged, fake);

        await jest.advanceTimersByTimeAsync(10000);
        await emit(event.PlaybackQueueEnded, { track: 1, position: 0 });
        await emit(event.PlaybackActiveTrackChanged, fake);

        expect(native.pause).toHaveBeenCalledTimes(1);
        expect(native.play).toHaveBeenCalledTimes(1);
        expect(player.currentMusic?.id).toBe(items[0].id);
    });

    it("accepts consecutive valid track endings without a time window", async () => {
        await player.play(items[0]);
        await emit(event.PlaybackActiveTrackChanged, reachFakeTrack());
        await emit(event.PlaybackActiveTrackChanged, reachFakeTrack());

        expect(player.currentMusic?.id).toBe(items[2].id);
    });

    it("rearms a single-track loop with a new native queue identity", async () => {
        await player.play(items[0]);
        player.toggleRepeatMode();
        player.toggleRepeatMode();
        const firstFake = reachFakeTrack();
        await emit(event.PlaybackActiveTrackChanged, firstFake);
        const secondFake = reachFakeTrack();
        await emit(event.PlaybackActiveTrackChanged, firstFake);
        await emit(event.PlaybackActiveTrackChanged, secondFake);

        expect(player.currentMusic?.id).toBe(items[0].id);
        expect(secondFake.track.audioraQueueRevision).not.toBe(firstFake.track.audioraQueueRevision);
        expect(native.play).toHaveBeenCalledTimes(3);
    });

    it("ignores queue-ended events while a source is still being acquired", async () => {
        const source = deferred<IPlugin.IMediaSourceResult>();
        getMediaSource.mockImplementationOnce(() => source.promise);
        const playing = player.play(items[0]);
        await flushPromises();
        playbackState = state.Ended;
        await emit(event.PlaybackQueueEnded, { track: 1, position: 0 });
        source.resolve({ url: "https://source/A.mp3" });
        await playing;

        expect(player.currentMusic?.id).toBe(items[0].id);
        expect(getMediaSource).toHaveBeenCalledTimes(1);
    });

    it("stops consecutive native 403 failures even though every URL was resolved", async () => {
        await player.play(items[0]);
        for (let index = 0; index < 6; index++) {
            await failNative();
        }

        expect(player.currentMusic?.id).toBe(items[3].id);
        expect(getMediaSource).toHaveBeenCalledTimes(4);
        expect(toast.warn).toHaveBeenCalledTimes(1);
        expect(toast.warn).toHaveBeenCalledWith("toast.consecutivePlayFailStopped");
    });

    it("resets the failure budget only after the current real track reaches Playing", async () => {
        await player.play(items[0]);
        await failNative();
        await failNative();
        playbackState = state.Playing;
        await emit(event.PlaybackState, { state: state.Playing });
        for (let index = 0; index < 3; index++) {
            await failNative();
        }

        expect(player.currentMusic?.id).toBe(items[5].id);
        expect(toast.warn).not.toHaveBeenCalled();
        await failNative();
        expect(toast.warn).toHaveBeenCalledWith("toast.consecutivePlayFailStopped");
    });

    it("does not reset the budget for a stale Playing event while the new track buffers", async () => {
        await player.play(items[0]);
        await failNative();
        await failNative();
        await emit(event.PlaybackState, { state: state.Playing });
        await failNative();
        await failNative();

        expect(player.currentMusic?.id).toBe(items[3].id);
        expect(toast.warn).toHaveBeenCalledWith("toast.consecutivePlayFailStopped");
    });

    it("coalesces duplicate native errors for the same playback request", async () => {
        await player.play(items[0]);
        playbackState = state.Error;
        const error = { message: "decode failure", code: "android-parsing-container-unsupported" };
        const first = emit(event.PlaybackError, error);
        const second = emit(event.PlaybackError, error);
        await jest.advanceTimersByTimeAsync(500);
        await Promise.all([first, second]);

        expect(player.currentMusic?.id).toBe(items[1].id);
        expect(getMediaSource).toHaveBeenCalledTimes(2);
    });

    it("preserves the auto-stop preference for native failures", async () => {
        autoStopWhenError = true;
        await player.play(items[0]);
        await failNative();
        await emit(event.PlaybackQueueEnded, { track: 1, position: 0 });

        expect(player.currentMusic?.id).toBe(items[0].id);
        expect(getMediaSource).toHaveBeenCalledTimes(1);
        expect(toast.warn).not.toHaveBeenCalled();
    });

    it("ignores stale native errors when the newly selected track has no playback error", async () => {
        await player.play(items[0]);
        await player.play(items[1]);
        await emit(event.PlaybackError, { message: "old decode error", code: "android-parsing-container-unsupported" });
        await jest.advanceTimersByTimeAsync(1000);

        expect(player.currentMusic?.id).toBe(items[1].id);
        expect(getMediaSource).toHaveBeenCalledTimes(2);
    });

    it("resumes a paused track and still handles its next natural ending", async () => {
        await player.play(items[0]);
        await player.pause();
        await player.play();
        await emit(event.PlaybackActiveTrackChanged, reachFakeTrack());

        expect(player.currentMusic?.id).toBe(items[1].id);
        expect(getMediaSource).toHaveBeenCalledTimes(2);
    });

    it("retries source acquisition after the current proposed queue failed", async () => {
        autoStopWhenError = true;
        getMediaSource.mockRejectedValueOnce(new Error("source failure"));
        await player.play(items[0]);
        await player.play();

        expect(queue[0].url).toBe("https://source/0.mp3");
        expect(getMediaSource).toHaveBeenCalledTimes(2);
    });

    it("rejects an old fake-track event after manually restarting an ended queue", async () => {
        await player.play(items[0]);
        const oldFake = reachFakeTrack();
        await player.play();
        await emit(event.PlaybackActiveTrackChanged, oldFake);

        expect(player.currentMusic?.id).toBe(items[0].id);
        await emit(event.PlaybackActiveTrackChanged, reachFakeTrack());
        expect(player.currentMusic?.id).toBe(items[1].id);
    });

    it("keeps native queue identity when reordering changes the next track", async () => {
        await player.play(items[0]);
        const queueRevision = queue[1].audioraQueueRevision;
        player.reorderPlayList([items[0], items[2], items[1], ...items.slice(3)]);

        expect(queue[1].id).toBe(items[2].id);
        expect(queue[1].audioraQueueRevision).toBe(queueRevision);
        await emit(event.PlaybackActiveTrackChanged, reachFakeTrack());
        expect(player.currentMusic?.id).toBe(items[2].id);
    });

    it("records sheet playback while deduplicating a replacement playlist", async () => {
        const context = {
            sheet: { id: "sheet-1", platform: "test", title: "Sheet" },
            routeName: "plugin-sheet-detail",
        };
        await player.playWithReplacePlayList(items[0], [items[0], items[1], items[0]], context);

        expect(player.playList.map(item => item.id)).toEqual([items[0].id, items[1].id]);
        expect(sheetHistory.getSheetPlaybackHistory()).toEqual([context]);
    });
});
