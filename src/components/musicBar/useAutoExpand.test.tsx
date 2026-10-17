import React from "react";
import { AppState, Keyboard } from "react-native";
import NativeTrackPlayer, { Event, State, Track } from "react-native-track-player";
import TestRenderer, { act } from "react-test-renderer";
import { TrackPlayerEvents } from "@/core.defination/trackPlayer";
import TrackPlayer from "@/core/trackPlayer";
import useAutoExpand from "./useAutoExpand";

const mockSong = { id: "song", platform: "test", title: "Song" };
let mockMusic: typeof mockSong | null = mockSong;
let mockFocused = true;
let mockPlayerOpen = false;
let mockPanel: string | null = null;
let mockDialog: string | null = null;
const mockNavigation = { isFocused: () => mockFocused };
const mockNativeListeners = new Map<string, (event: any) => void>();
const mockNativeRemovers: jest.Mock[] = [];
let mockMusicChanged: ((music: typeof mockSong | null) => void) | undefined;

jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));
jest.mock("@/core/playerOverlay", () => ({ isPlayerOpen: () => mockPlayerOpen }));
jest.mock("@/components/panels/usePanel", () => ({ panelInfoStore: { getValue: () => ({ name: mockPanel }) } }));
jest.mock("@/components/dialogs/useDialog", () => ({ getCurrentDialog: () => ({ name: mockDialog }) }));
jest.mock("@/utils/mediaUtils", () => ({
    getMediaUniqueKey: (item: typeof mockSong) => `${item.platform}@${item.id}`,
}));
jest.mock("@/core/trackPlayer", () => ({
    __esModule: true,
    default: {
        get currentMusic() {
            return mockMusic;
        },
        on: jest.fn((_event: string, callback: typeof mockMusicChanged) => {
            mockMusicChanged = callback;
        }),
        off: jest.fn(),
    },
}));
jest.mock("react-native-track-player", () => ({
    __esModule: true,
    State: { Playing: "playing", Paused: "paused", Loading: "loading", Buffering: "buffering", Error: "error" },
    Event: { PlaybackState: "playback-state", PlaybackActiveTrackChanged: "playback-active-track-changed" },
    default: {
        getActiveTrack: jest.fn(),
        getPlaybackState: jest.fn(),
        addEventListener: jest.fn((event: string, callback: (value: any) => void) => {
            mockNativeListeners.set(event, callback);
            const remove = jest.fn(() => mockNativeListeners.delete(event));
            mockNativeRemovers.push(remove);
            return { remove };
        }),
    },
}));

function Harness({ onExpand }: { onExpand: () => void }) {
    useAutoExpand(onExpand);
    return null;
}

async function render() {
    const onExpand = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
        renderer = TestRenderer.create(<Harness onExpand={onExpand} />);
    });
    return { renderer: renderer!, onExpand };
}

function select(music: typeof mockSong | null) {
    act(() => {
        mockMusic = music;
        mockMusicChanged?.(music);
    });
}

function active(music = mockMusic, url = "file:///music.mp3") {
    act(() => mockNativeListeners.get(Event.PlaybackActiveTrackChanged)?.({
        track: music ? { ...music, url } : undefined,
    }));
}

function playback(state = State.Playing) {
    act(() => mockNativeListeners.get(Event.PlaybackState)?.({ state }));
}

describe("automatic dock expansion", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockNativeListeners.clear();
        mockNativeRemovers.length = 0;
        mockMusic = mockSong;
        mockMusicChanged = undefined;
        mockFocused = true;
        mockPlayerOpen = false;
        mockPanel = null;
        mockDialog = null;
        AppState.currentState = "active";
        jest.spyOn(Keyboard, "isVisible").mockReturnValue(false);
        (NativeTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ ...mockSong, url: "file:///music.mp3" });
        (NativeTrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: State.Paused });
    });

    afterEach(() => jest.restoreAllMocks());

    it("expands on the first playback and preserves a manual collapse across pause, resume and metadata updates", async () => {
        const { onExpand } = await render();
        playback();
        expect(onExpand).toHaveBeenCalledTimes(1);
        playback(State.Paused);
        playback(State.Buffering);
        select({ ...mockSong, title: "Updated metadata" });
        active();
        playback();
        expect(onExpand).toHaveBeenCalledTimes(1);
    });

    it("waits for the selected song's real source and successful playback, ignoring stale playing state", async () => {
        const { onExpand } = await render();
        playback();
        onExpand.mockClear();
        select({ ...mockSong, id: "next" });
        playback();
        expect(onExpand).not.toHaveBeenCalled();
        active(mockMusic, "audiora://proposed-audio");
        expect(onExpand).not.toHaveBeenCalled();
        playback(State.Loading);
        active();
        playback(State.Error);
        expect(onExpand).not.toHaveBeenCalled();
        playback();
        expect(onExpand).toHaveBeenCalledTimes(1);
    });

    it("expands once again for a different song or platform, including revisiting a previous song", async () => {
        const { onExpand } = await render();
        playback();
        for (const song of [{ ...mockSong, id: "next" }, { ...mockSong, platform: "other" }, mockSong]) {
            select(song);
            playback(State.Loading);
            active();
            playback();
        }
        expect(onExpand).toHaveBeenCalledTimes(4);
    });

    it.each(["route", "player", "keyboard", "background", "panel", "dialog"])(
        "consumes a first playback hidden by %s and does not reopen the card when the dock returns",
        async reason => {
            const { onExpand } = await render();
            mockFocused = reason !== "route";
            mockPlayerOpen = reason === "player";
            (Keyboard.isVisible as jest.Mock).mockReturnValue(reason === "keyboard");
            AppState.currentState = reason === "background" ? "background" : "active";
            mockPanel = reason === "panel" ? "PlayList" : null;
            mockDialog = reason === "dialog" ? "Dialog" : null;
            playback();
            expect(onExpand).not.toHaveBeenCalled();
            mockFocused = true;
            mockPlayerOpen = false;
            (Keyboard.isVisible as jest.Mock).mockReturnValue(false);
            AppState.currentState = "active";
            mockPanel = null;
            mockDialog = null;
            playback(State.Paused);
            playback();
            expect(onExpand).not.toHaveBeenCalled();
            select({ ...mockSong, id: "next" });
            playback(State.Loading);
            active();
            playback();
            expect(onExpand).toHaveBeenCalledTimes(1);
        },
    );

    it("does not expand an already-playing restored song on mount or resume", async () => {
        (NativeTrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: State.Playing });
        const { onExpand } = await render();
        expect(onExpand).not.toHaveBeenCalled();
        playback(State.Paused);
        playback();
        expect(onExpand).not.toHaveBeenCalled();
    });

    it("ignores empty music and resets the first-play record when the queue is cleared", async () => {
        const { onExpand } = await render();
        select(null);
        active();
        playback();
        expect(onExpand).not.toHaveBeenCalled();
        select(mockSong);
        playback(State.Loading);
        active();
        playback();
        expect(onExpand).toHaveBeenCalledTimes(1);
    });

    it("recovers from querying a native player that has not been set up", async () => {
        (NativeTrackPlayer.getActiveTrack as jest.Mock).mockRejectedValue(new Error("Not set up"));
        const { onExpand } = await render();
        active();
        playback();
        expect(onExpand).toHaveBeenCalledTimes(1);
    });

    it("does not overwrite newer native events with an initial async snapshot or act after unmount", async () => {
        let resolveTrack: (track: Track | undefined) => void;
        (NativeTrackPlayer.getActiveTrack as jest.Mock).mockReturnValue(new Promise(resolve => {
            resolveTrack = resolve;
        }));
        const { renderer, onExpand } = await render();
        select({ ...mockSong, id: "next" });
        playback(State.Loading);
        active();
        playback();
        expect(onExpand).toHaveBeenCalledTimes(1);
        await act(async () => resolveTrack!({ ...mockSong, url: "file:///old.mp3" }));
        select(mockSong);
        playback(State.Paused);
        playback();
        expect(onExpand).toHaveBeenCalledTimes(1);
        active();
        expect(onExpand).toHaveBeenCalledTimes(2);
        select({ ...mockSong, id: "third" });
        playback(State.Loading);
        active();
        const lateState = mockNativeListeners.get(Event.PlaybackState)!;
        act(() => renderer.unmount());
        expect(TrackPlayer.off).toHaveBeenCalledWith(TrackPlayerEvents.CurrentMusicChanged, mockMusicChanged);
        expect(mockNativeRemovers.every(remove => remove.mock.calls.length === 1)).toBe(true);
        act(() => lateState({ state: State.Playing }));
        expect(onExpand).toHaveBeenCalledTimes(2);
    });

    it("ignores an initial native query that completes after unmount", async () => {
        let resolveTrack: (track: Track | undefined) => void;
        (NativeTrackPlayer.getActiveTrack as jest.Mock).mockReturnValue(new Promise(resolve => {
            resolveTrack = resolve;
        }));
        const { renderer, onExpand } = await render();
        select({ ...mockSong, id: "next" });
        playback();
        act(() => renderer.unmount());
        await act(async () => resolveTrack!({ ...mockMusic!, url: "file:///next.mp3" }));
        expect(onExpand).not.toHaveBeenCalled();
    });
});
