/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import player from "./index";
import NativePlayer from "react-native-track-player";

const mockListeners: Record<string, (event: any) => Promise<void>> = {};
let mockTracks: any[] = [];
let mockRetry = true;
let mockEnabled = ["A", "B", "C"];
const a = { id: "1", platform: "A", title: "Song A", artist: "Artist", album: "Album A", artwork: "cover-a", duration: 200 };
const b = { ...a, platform: "B", title: "Song B", artwork: "cover-b", aid: 42 };
const c = { ...a, platform: "C", title: "Song C", artwork: "cover-c" };
const mockSources = [a, b, c];
const mockHistory = { addMusic: jest.fn() };
const mockPlugins = Object.fromEntries(["A", "B", "C"].map(name => [name, {
    name, hash: name, instance: { qualityMode: "extended", supportedQualities: ["320k"] },
    methods: { getMediaSource: jest.fn(), getMusicInfo: jest.fn(async () => null), search: jest.fn(async () => ({ data: [] })) },
}]));
const mockManager = {
    getByName: (name: string) => mockPlugins[name],
    getByMedia: (item: ICommon.IMediaBase) => mockPlugins[item.platform],
    getEnabledPlugins: () => mockEnabled.map(name => mockPlugins[name]),
    getSearchablePlugins: () => [],
};
const mockConfig = { getConfig: (key: string) => ({ "basic.tryChangeSourceWhenPlayFail": mockRetry, "basic.autoStopWhenError": true, "basic.defaultPlayQuality": "320k" }[key]) };

jest.mock("react-native-track-player", () => ({
    __esModule: true,
    default: {
        reset: jest.fn(async () => {
            mockTracks = [];
        }),
        getTrack: jest.fn(async () => mockTracks[0]), getActiveTrack: jest.fn(async () => mockTracks[0]),
        getActiveTrackIndex: jest.fn(async () => 0), getPlaybackState: jest.fn(async () => ({ state: "playing" })),
        setQueue: jest.fn(async tracks => {
            mockTracks = tracks;
        }),
        play: jest.fn(async () => {}), pause: jest.fn(async () => {}), seekTo: jest.fn(async () => {}),
        getProgress: jest.fn(async () => ({ position: 73, duration: 200 })),
        getRate: jest.fn(), setRate: jest.fn(), updateMetadataForTrack: jest.fn(),
        addEventListener: jest.fn((name, listener) => {
            mockListeners[name] = listener;
        }),
    },
    Event: { PlaybackError: "error", PlaybackActiveTrackChanged: "changed" },
    State: { Playing: "playing", Paused: "paused", Stopped: "stopped" },
}));
jest.mock("@/core/musicSheet", () => ({ __esModule: true, default: { favorites: {
    groupFor: () => ({ id: "linked" }), linkedSources: () => mockSources,
} } }));
jest.mock("@/core/localMusicSheet", () => ({ __esModule: true, default: { isLocalMusic: () => null } }));
jest.mock("@/components/dialogs/useDialog", () => ({ getCurrentDialog: () => null, showDialog: jest.fn() }));
jest.mock("@/utils/log", () => ({ appendStartupBreadcrumb: jest.fn(async () => {}), devLog: jest.fn(), trace: jest.fn(), errorLog: jest.fn() }));
jest.mock("@/utils/persistStatus", () => ({ __esModule: true, default: { get: () => undefined, set: jest.fn() } }));
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { warn: jest.fn() } }));
jest.mock("@/core/i18n", () => ({ __esModule: true, default: { t: (key: string) => key, getLanguage: () => ({ languageData: {} }) } }));
jest.mock("@/utils/network", () => ({ __esModule: true, default: { isCellular: false } }));
jest.mock("@/utils/mediaUtils", () => ({ isSameMediaItem: (x, y) => !!x && !!y && x.id === y.id && x.platform === y.platform }));
jest.mock("@/utils/artwork", () => ({ resolveArtwork: item => item.artwork }));
jest.mock("@/utils/fileUtils", () => ({ resolveImportedAssetOrPath: value => value }));
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: "default" } }));
jest.mock("@/utils/trackUtils", () => ({ musicIsPaused: () => false }));
jest.mock("@/utils/delay", () => ({ __esModule: true, default: async () => {} }));
jest.mock("@/utils/localQuality", () => ({ mapLocalQuality: () => "320k", resolveLocalAudioMeta: () => ({}) }));
jest.mock("./localPlayback", () => ({ getLocalPlaybackSource: () => null }));
jest.mock("./mediaSourceAdapter", () => ({ adaptMediaSourceForPlayback: async source => source, canReuseMediaSourceForPlayback: () => false }));
jest.mock("@/core/sheetPlaybackHistory", () => ({ recordSheetPlayback: jest.fn() }));
jest.mock("@/service/mflac/songKey", () => ({ EncryptedSourceError: class extends Error {}, QmcKeyError: class extends Error {} }));
jest.mock("@/constants/commonConst", () => ({ internalFakeSoundKey: "fake", timeStampSymbol: Symbol.for("time-stamp"), sortIndexSymbol: Symbol.for("sort-index") }));

const flush = async () => {
    for (let i = 0; i < 30; i += 1) await Promise.resolve();
};

describe("linked source integration with the actual player", () => {
    beforeEach(async () => {
        jest.useFakeTimers(); jest.clearAllMocks(); mockRetry = true; mockEnabled = ["A", "B", "C"];
        player.injectDependencies(mockConfig as any, mockHistory as any, mockManager as any);
        await player.clearPlayList(); await player.setupTrackPlayer();
        mockPlugins.A.methods.getMediaSource.mockResolvedValue(null);
        mockPlugins.B.methods.getMediaSource.mockResolvedValue({ url: "https://example.test/b" });
        mockPlugins.C.methods.getMediaSource.mockResolvedValue({ url: "https://example.test/c" });
    });
    afterEach(async () => {
        await player.clearPlayList(); jest.runOnlyPendingTimers(); await flush(); jest.useRealTimers();
    });
    it("uses the linked original's metadata, queue identity and history when the first source fails", async () => {
        await player.play(a);
        expect(player.currentMusic?.platform).toBe("B");
        expect(player.currentMusic?.artwork).toBe("cover-b");
        expect(player.playList.map(item => item.platform)).toEqual(["B"]);
        expect(mockTracks[0]).toMatchObject({ platform: "B", aid: 42, url: "https://example.test/b" });
        expect(mockHistory.addMusic).toHaveBeenCalledWith(b);
        expect(mockPlugins.A.methods.getMediaSource).toHaveBeenCalledTimes(1);
        expect(mockPlugins.B.methods.getMediaSource).toHaveBeenCalledTimes(1);
    });
    it("respects the existing switch and skips disabled sources", async () => {
        mockRetry = false; await player.play(a);
        expect(mockPlugins.B.methods.getMediaSource).not.toHaveBeenCalled();
        mockRetry = true; mockEnabled = ["A", "C"];
        await player.play(a);
        expect(player.currentMusic?.platform).toBe("C");
        expect(mockPlugins.B.methods.getMediaSource).not.toHaveBeenCalled();
    });
    it("continues to a new linked member on native playback error and restores progress", async () => {
        mockPlugins.A.methods.getMediaSource.mockResolvedValueOnce({ url: "https://example.test/a" });
        await player.play(a);
        await mockListeners.error({ message: "network stream failed", code: "network" });
        expect(player.currentMusic?.platform).toBe("B");
        expect(NativePlayer.seekTo).toHaveBeenCalledWith(73);
        await mockListeners.error({ message: "network stream failed", code: "network" });
        expect(player.currentMusic?.platform).toBe("C");
        expect(mockPlugins.A.methods.getMediaSource).toHaveBeenCalledTimes(1);
        expect(mockPlugins.B.methods.getMediaSource).toHaveBeenCalledTimes(1);
        expect(mockPlugins.C.methods.getMediaSource).toHaveBeenCalledTimes(1);
    });
    it("does not apply a linked response after the user selects another song", async () => {
        let finish!: (source: { url: string }) => void;
        mockPlugins.B.methods.getMediaSource.mockImplementationOnce(() => new Promise(yes => {
            finish = yes;
        }));
        const pending = player.play(a); await flush();
        await player.play(c);
        finish({ url: "https://example.test/late-b" }); await pending;
        expect(player.currentMusic?.platform).toBe("C");
        expect(mockTracks[0].url).toBe("https://example.test/c");
    });
    it("keeps an explicit pause made while a native recovery was waiting", async () => {
        mockPlugins.A.methods.getMediaSource.mockResolvedValueOnce({ url: "https://example.test/a" });
        await player.play(a);
        let finish!: (source: { url: string }) => void;
        mockPlugins.B.methods.getMediaSource.mockImplementationOnce(() => new Promise(yes => {
            finish = yes;
        }));
        const pending = mockListeners.error({ message: "network stream failed", code: "network" });
        await flush(); await player.pause(); finish({ url: "https://example.test/b" }); await pending;
        expect(player.currentMusic?.platform).toBe("B");
        expect(NativePlayer.play).toHaveBeenCalledTimes(1);
    });
    it("keeps an explicit pause while initially resolving a linked source", async () => {
        let finish!: (source: { url: string }) => void;
        mockPlugins.B.methods.getMediaSource.mockImplementationOnce(() => new Promise(yes => {
            finish = yes;
        }));
        const pending = player.play(a);
        await flush(); await player.pause(); finish({ url: "https://example.test/b" }); await pending;
        expect(player.currentMusic?.platform).toBe("B");
        expect(mockTracks[0].url).toBe("https://example.test/b");
        expect(NativePlayer.play).not.toHaveBeenCalled();
    });
    it("recovers conservatively when reading the failed native playback state rejects", async () => {
        mockPlugins.A.methods.getMediaSource.mockResolvedValueOnce({ url: "https://example.test/a" });
        await player.play(a);
        (NativePlayer.getPlaybackState as jest.Mock).mockRejectedValueOnce(new Error("native state unavailable"));
        await expect(mockListeners.error({ message: "network stream failed", code: "network" })).resolves.toBeUndefined();
        expect(player.currentMusic?.platform).toBe("B");
        expect(NativePlayer.seekTo).toHaveBeenCalledWith(73);
        expect(NativePlayer.play).toHaveBeenCalledTimes(1);
    });
    it("keeps a pause made while the native linked queue is being installed", async () => {
        const setQueue = NativePlayer.setQueue as jest.Mock;
        const normalSetQueue = setQueue.getMockImplementation()!;
        let finish!: () => void;
        setQueue.mockImplementationOnce(normalSetQueue).mockImplementationOnce(tracks => new Promise<void>(yes => {
            mockTracks = tracks; finish = yes;
        }));
        const pending = player.play(a);
        await flush(); await player.pause(); finish(); await pending;
        expect(player.currentMusic?.platform).toBe("B");
        expect(NativePlayer.play).not.toHaveBeenCalled();
    });
    it("advances to another group member if applying a recovered native source fails", async () => {
        mockPlugins.A.methods.getMediaSource.mockResolvedValueOnce({ url: "https://example.test/a" });
        await player.play(a);
        (NativePlayer.setQueue as jest.Mock).mockRejectedValueOnce(new Error("native setup failed"));
        await mockListeners.error({ message: "network stream failed", code: "network" });
        expect(player.currentMusic?.platform).toBe("C");
        expect(mockTracks[0].url).toBe("https://example.test/c");
        expect(mockHistory.addMusic.mock.calls.map(call => call[0].platform)).toEqual(["A", "C"]);
    });
});
