export {};
const mockCallbacks = new Map<string, (event: any) => void>();
const mockPlayer = { addEventListener: jest.fn((event, callback) => mockCallbacks.set(event, callback)), getActiveTrack: jest.fn(), getPlaybackState: jest.fn() };
const mockTracker = { changeTrack: jest.fn(), setPlaying: jest.fn(), progress: jest.fn() };
const mockFlush = jest.fn();
jest.mock("react-native-track-player", () => ({
    __esModule: true, default: mockPlayer,
    Event: { PlaybackActiveTrackChanged: "track", PlaybackState: "state", PlaybackProgressUpdated: "progress" },
    State: { Playing: "playing", Paused: "paused" },
}));
jest.mock("@/core/listeningStats", () => ({ listeningTracker: mockTracker, flushListeningStats: mockFlush }));
const song = { id: "one", platform: "local", title: "One", url: "file:///music/song.mp3" };

describe("background native statistics recorder", () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockCallbacks.clear();
        mockPlayer.getActiveTrack.mockResolvedValue(undefined);
        mockPlayer.getPlaybackState.mockResolvedValue({ state: "paused" });
    });

    it("installs once, observes the real native track, and ignores fake queue progress", () => {
        const { setupListeningStatsRecorder } = require("./listeningStatsRecorder");
        setupListeningStatsRecorder();
        setupListeningStatsRecorder();
        expect(mockPlayer.addEventListener).toHaveBeenCalledTimes(3);
        mockCallbacks.get("track")!({ track: song });
        mockCallbacks.get("state")!({ state: "playing" });
        mockCallbacks.get("progress")!({ track: 0, position: 1 });
        expect(mockTracker.progress).toHaveBeenCalledWith(song, 1);
        mockCallbacks.get("progress")!({ track: 1, position: 2 });
        expect(mockTracker.progress).toHaveBeenCalledTimes(1);
        mockCallbacks.get("track")!({ track: { ...song, url: "audiora://fake-audio" } });
        expect(mockTracker.changeTrack).toHaveBeenLastCalledWith(undefined);
        mockCallbacks.get("state")!({ state: "paused" });
        expect(mockTracker.setPlaying).toHaveBeenLastCalledWith(false);
        expect(mockFlush).toHaveBeenCalled();
    });

    it("restores an already playing track and prevents async startup from overwriting newer events", async () => {
        mockPlayer.getActiveTrack.mockResolvedValue(song);
        mockPlayer.getPlaybackState.mockResolvedValue({ state: "playing" });
        require("./listeningStatsRecorder").setupListeningStatsRecorder();
        await Promise.resolve();
        await Promise.resolve();
        expect(mockTracker.changeTrack).toHaveBeenCalledWith(song);
        expect(mockTracker.setPlaying).toHaveBeenCalledWith(true);
        jest.resetModules();
        mockTracker.changeTrack.mockClear();
        require("./listeningStatsRecorder").setupListeningStatsRecorder();
        const newSong = { ...song, id: "two" };
        mockCallbacks.get("track")!({ track: newSong });
        await Promise.resolve();
        await Promise.resolve();
        expect(mockTracker.changeTrack).toHaveBeenCalledTimes(1);
        expect(mockTracker.changeTrack).toHaveBeenCalledWith(newSong);
    });
});
