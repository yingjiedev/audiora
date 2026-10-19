export {};
const mockNativeEvents = new Map<string, (event: any) => void>();
const mockDeviceEvents = new Map<string, (event: any) => void>();
const mockTrackEvents = new Map<string, (event: any) => void>();
const mockBridge = {
    updatePlayback: jest.fn().mockResolvedValue(undefined),
    updateColors: jest.fn().mockResolvedValue(undefined),
    setReady: jest.fn().mockResolvedValue(undefined),
};
const mockPlatform = { OS: "android" };
const mockModules: { MusicWidget?: typeof mockBridge } = { MusicWidget: mockBridge };
const mockNative = {
    addEventListener: jest.fn((name, handler) => mockNativeEvents.set(name, handler)),
    getPlaybackState: jest.fn(),
    getPlayWhenReady: jest.fn(),
};
const song = { title: "晴天", artist: "周杰伦", artwork: "https://example.com/cover.jpg" };
const mockTrack = {
    currentMusic: song as typeof song | null,
    on: jest.fn((name, handler) => mockTrackEvents.set(name, handler)),
    play: jest.fn(), pause: jest.fn(), skipToPrevious: jest.fn(), skipToNext: jest.fn(),
};
const mockOpenPlayer = jest.fn();
const mockErrorLog = jest.fn();
const mockStartShiYin = jest.fn();
const mockToast = jest.fn();
jest.mock("@/core/i18n", () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock("./widgetShiYin", () => ({ startWidgetShiYin: (...args: any[]) => mockStartShiYin(...args) }));
jest.mock("react-native", () => ({
    Platform: mockPlatform, NativeModules: mockModules,
    DeviceEventEmitter: { addListener: jest.fn((name, handler) => mockDeviceEvents.set(name, handler)) },
    ToastAndroid: { show: (...args: any[]) => mockToast(...args), LONG: 1 },
}));
jest.mock("react-native-track-player", () => ({
    __esModule: true, default: mockNative,
    Event: { PlaybackState: "state", PlaybackActiveTrackChanged: "track" },
    State: { None: "none", Paused: "paused", Playing: "playing", Buffering: "buffering", Loading: "loading" },
}));
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: mockTrack }));
jest.mock("@/core.defination/trackPlayer", () => ({ TrackPlayerEvents: { CurrentMusicChanged: "current" } }));
jest.mock("@/core/playerOverlay", () => ({ openPlayer: mockOpenPlayer }));
jest.mock("@/utils/artwork", () => ({ resolveArtwork: (music: typeof song | null) => music?.artwork }));
jest.mock("@/utils/log", () => ({ errorLog: mockErrorLog }));
const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockNativeEvents.clear(); mockDeviceEvents.clear(); mockTrackEvents.clear();
    mockPlatform.OS = "android";
    mockModules.MusicWidget = mockBridge;
    mockTrack.currentMusic = song;
    mockNative.getPlaybackState.mockResolvedValue({ state: "paused" });
    mockNative.getPlayWhenReady.mockResolvedValue(false);
    mockStartShiYin.mockResolvedValue(undefined);
    for (const fn of [mockTrack.play, mockTrack.pause, mockTrack.skipToNext, mockTrack.skipToPrevious]) fn.mockResolvedValue(undefined);
});

it("installs once after restoration and updates metadata, loading, playing and empty states", async () => {
    const { setupMusicWidget } = require("./musicWidget");
    setupMusicWidget(); setupMusicWidget();
    await flush();
    expect(mockBridge.setReady).toHaveBeenCalledTimes(1);
    expect(mockBridge.updatePlayback).toHaveBeenLastCalledWith({ ...song, hasTrack: true, playing: false, loading: false, discovering: false });
    mockNativeEvents.get("state")!({ state: "playing" });
    expect(mockBridge.updatePlayback).toHaveBeenLastCalledWith(expect.objectContaining({ playing: true }));
    mockNativeEvents.get("state")!({ state: "buffering" });
    expect(mockBridge.updatePlayback).toHaveBeenLastCalledWith(expect.objectContaining({ playing: false, loading: true }));
    mockTrack.currentMusic = { ...song, title: "夜曲", artwork: "file:///cover.jpg" };
    mockTrackEvents.get("current")!(mockTrack.currentMusic);
    expect(mockBridge.updatePlayback).toHaveBeenLastCalledWith(expect.objectContaining({ title: "夜曲", artwork: "file:///cover.jpg", loading: false }));
    mockTrack.currentMusic = { ...song, artwork: "content://covers/edited" };
    mockNativeEvents.get("track")!({ track: mockTrack.currentMusic });
    expect(mockBridge.updatePlayback).toHaveBeenLastCalledWith(expect.objectContaining({ artwork: "content://covers/edited" }));
    mockTrack.currentMusic = null;
    mockTrackEvents.get("current")!(null);
    expect(mockBridge.updatePlayback).toHaveBeenLastCalledWith({ title: "", artist: "", artwork: "", hasTrack: false, playing: false, loading: false, discovering: false });
});

it("does not overwrite a newer playback event with an older asynchronous snapshot", async () => {
    let resolve!: (value: unknown) => void;
    mockNative.getPlaybackState.mockReturnValue(new Promise(done => {
        resolve = done;
    }));
    require("./musicWidget").setupMusicWidget();
    mockNativeEvents.get("state")!({ state: "playing" });
    resolve({ state: "paused" });
    await flush();
    expect(mockBridge.updatePlayback).toHaveBeenCalledTimes(1);
    expect(mockBridge.updatePlayback).toHaveBeenLastCalledWith(expect.objectContaining({ playing: true }));
});

it("publishes a safe paused snapshot when initial native state is unavailable", async () => {
    mockNative.getPlaybackState.mockRejectedValue(new Error("service unavailable"));
    require("./musicWidget").setupMusicWidget();
    await flush();
    expect(mockBridge.updatePlayback).toHaveBeenLastCalledWith(expect.objectContaining({ playing: false }));
});

it("routes desktop controls through the business player and pauses while buffering", async () => {
    const { setupMusicWidget, runMusicWidgetAction } = require("./musicWidget");
    setupMusicWidget();
    await mockDeviceEvents.get("audiora-widget-action")!("next");
    await runMusicWidgetAction("previous");
    expect(mockTrack.skipToNext).toHaveBeenCalledTimes(1);
    expect(mockTrack.skipToPrevious).toHaveBeenCalledTimes(1);
    mockNative.getPlayWhenReady.mockResolvedValue(true);
    await runMusicWidgetAction("toggle");
    expect(mockTrack.pause).toHaveBeenCalledTimes(1);
    mockNative.getPlayWhenReady.mockResolvedValue(false);
    await runMusicWidgetAction("toggle");
    expect(mockTrack.play).toHaveBeenCalledTimes(1);
});

it("serializes rapid clicks and keeps accepting controls after a failed action", async () => {
    const { runMusicWidgetAction } = require("./musicWidget");
    let reject!: (error: Error) => void;
    mockTrack.skipToNext.mockReturnValueOnce(new Promise((_done, fail) => {
        reject = fail;
    }));
    const first = runMusicWidgetAction("next");
    const second = runMusicWidgetAction("previous");
    await flush();
    expect(mockTrack.skipToPrevious).not.toHaveBeenCalled();
    reject(new Error("source unavailable"));
    await Promise.all([first, second]);
    expect(mockErrorLog).toHaveBeenCalledTimes(1);
    expect(mockTrack.skipToPrevious).toHaveBeenCalledTimes(1);
});

it("ignores unsupported actions and empty queues", async () => {
    const { runMusicWidgetAction } = require("./musicWidget");
    await runMusicWidgetAction("delete");
    mockTrack.currentMusic = null;
    await runMusicWidgetAction("toggle");
    await runMusicWidgetAction("next");
    expect(mockTrack.play).not.toHaveBeenCalled();
    expect(mockTrack.skipToNext).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith("toast.widgetQueueEmpty", 1);
});

it("handles a cold-start action once, opens the player repeatedly, and rejects unrelated links", async () => {
    const { handleMusicWidgetLink } = require("./musicWidget");
    for (const url of ["invalid", "https://app/widget?action=next", "audiora://install/plugin.js", "audiora://app/other?action=next"]) {
        expect(await handleMusicWidgetLink(url)).toBe(false);
    }
    const url = "audiora://app/widget?action=next&request=123";
    expect(await handleMusicWidgetLink(url)).toBe(true);
    await handleMusicWidgetLink(url);
    expect(mockTrack.skipToNext).toHaveBeenCalledTimes(1);
    await handleMusicWidgetLink("audiora://app/widget?action=open");
    await handleMusicWidgetLink("audiora://app/widget?action=open");
    expect(mockOpenPlayer).toHaveBeenCalledTimes(2);
});

it.each(["ios", "web"])("leaves %s untouched and tolerates an unavailable native module", platform => {
    mockPlatform.OS = platform;
    const { setupMusicWidget, syncMusicWidgetColors } = require("./musicWidget");
    setupMusicWidget(); syncMusicWidgetColors({});
    mockPlatform.OS = "android";
    delete mockModules.MusicWidget;
    setupMusicWidget(); syncMusicWidgetColors({});
    expect(mockBridge.setReady).not.toHaveBeenCalled();
    expect(mockBridge.updateColors).not.toHaveBeenCalled();
});

it("sends only resolved semantic colors to the native widget", () => {
    const appearances = { light: { surface: "light surface" }, dark: { surface: "dark surface" } };
    require("./musicWidget").syncMusicWidgetColors({ widgetAppearances: appearances });
    expect(mockBridge.updateColors).toHaveBeenCalledWith(appearances);
});

it("starts discovery with an empty queue, coalesces repeated taps, and clears loading after failure", async () => {
    const { runMusicWidgetAction } = require("./musicWidget");
    mockTrack.currentMusic = null;
    let reject!: (error: Error) => void;
    mockStartShiYin.mockReturnValueOnce(new Promise((_done, fail) => {
        reject = fail;
    }));
    const first = runMusicWidgetAction("shiyin");
    const second = runMusicWidgetAction("shiyin");
    await flush();
    expect(mockStartShiYin).toHaveBeenCalledTimes(1);
    expect(mockBridge.updatePlayback).toHaveBeenLastCalledWith(expect.objectContaining({ discovering: true }));
    reject(new Error("offline"));
    await Promise.all([first, second]);
    expect(mockBridge.updatePlayback).toHaveBeenLastCalledWith(expect.objectContaining({ discovering: false }));
    await runMusicWidgetAction("shiyin");
    expect(mockStartShiYin).toHaveBeenCalledTimes(2);
});

it("consumes each discovery deep link once after cold-start restoration", async () => {
    const { handleMusicWidgetLink } = require("./musicWidget");
    await handleMusicWidgetLink("audiora://app/widget?action=shiyin&request=1");
    await handleMusicWidgetLink("audiora://app/widget?action=shiyin&request=1");
    await handleMusicWidgetLink("audiora://app/widget?action=shiyin&request=2");
    expect(mockStartShiYin).toHaveBeenCalledTimes(2);
});

it("discards controls whose native service lease expired while queued", async () => {
    const { runMusicWidgetAction } = require("./musicWidget");
    await runMusicWidgetAction("next", async () => false);
    await runMusicWidgetAction("shiyin", async () => false);
    expect(mockTrack.skipToNext).not.toHaveBeenCalled();
    expect(mockStartShiYin).not.toHaveBeenCalled();
    expect(mockBridge.updatePlayback).toHaveBeenLastCalledWith(expect.objectContaining({ discovering: false }));
    await runMusicWidgetAction("next", async () => true);
    expect(mockTrack.skipToNext).toHaveBeenCalledTimes(1);
});
