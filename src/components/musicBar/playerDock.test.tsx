import React from "react";
import { BackHandler, Keyboard } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import MusicSheet from "@/core/musicSheet";
import TrackPlayer from "@/core/trackPlayer";
import { showPanel } from "@/components/panels/usePanel";
import SeekBar from "@/pages/musicDetail/components/bottom/seekBar";
import MusicInfo from "./musicInfo";
import PlayerDock from "./playerDock";

const mockSong = { id: "song", platform: "test", title: "A long song title", artist: "Artist", artwork: "cover.jpg" };
let mockMusic: typeof mockSong | null = mockSong;
let mockPaused = true;
let mockFavorite = false;
let mockDark = false;
const mockNavigate = jest.fn();
const mockKeyboardListeners: Record<string, () => void> = {};
let mockBackPress: (() => boolean) | undefined;

jest.mock("@react-navigation/native", () => ({ useTheme: () => ({ dark: mockDark }) }));
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/fastImage", () => "FastImage");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/roundActionButton", () => "RoundActionButton");
jest.mock("./musicInfo", () => "MusicInfo");
jest.mock("@/pages/musicDetail/components/bottom/seekBar", () => "SeekBar");
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: 1, playerVinyl: 2 } }));
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/core/router", () => ({ ROUTE_PATH: { MUSIC_DETAIL: "music-detail" }, useNavigate: () => mockNavigate }));
jest.mock("@/core/trackPlayer", () => ({
    __esModule: true,
    default: { play: jest.fn(), pause: jest.fn(), skipToPrevious: jest.fn(), skipToNext: jest.fn() },
    useCurrentMusic: () => mockMusic,
    useMusicState: () => mockPaused,
}));
jest.mock("@/core/musicSheet", () => ({
    __esModule: true,
    default: { defaultSheet: { id: "favorites" }, addMusic: jest.fn(), removeMusic: jest.fn() },
    useFavorite: () => mockFavorite,
}));
jest.mock("@/hooks/useColors", () => () => ({
    primary: "#3867F4", text: "#10172D", textSecondary: "#485574", musicBar: "#FFFFFF",
    musicBarText: "#10172D", surfaceElevated: "#212E4E", tabBar: "#131C31", card: "#FFFFFF",
    danger: "#FF4F7B", shadow: "#2D4A78",
}));
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value / 2 }));
jest.mock("@/utils/trackUtils", () => ({ musicIsPaused: (state: boolean) => state }));
jest.mock("@/utils/artwork", () => ({ resolveArtwork: (item: typeof mockSong | null) => item?.artwork }));
jest.mock("@/utils/mediaExtra", () => ({ useMediaExtraProperty: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 12, left: 0, right: 0 }) }));

function render(collapseKey = "home") {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<PlayerDock collapseKey={collapseKey} bottomNavigation={<React.Fragment>Navigation</React.Fragment>} />);
    });
    return renderer!;
}

function expand(renderer: TestRenderer.ReactTestRenderer) {
    act(() => renderer.root.findByType(MusicInfo).props.onPress());
}

function press(renderer: TestRenderer.ReactTestRenderer, label: string) {
    const button = renderer.root.findAllByProps({ accessibilityLabel: label }).find(node => typeof node.props.onPress === "function");
    expect(button).toBeDefined();
    act(() => button!.props.onPress());
}

describe("PlayerDock", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockMusic = mockSong;
        mockPaused = true;
        mockFavorite = false;
        mockDark = false;
        mockBackPress = undefined;
        jest.spyOn(Keyboard, "addListener").mockImplementation((event, callback) => {
            mockKeyboardListeners[event] = callback as () => void;
            return { remove: jest.fn() } as unknown as ReturnType<typeof Keyboard.addListener>;
        });
        jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, callback) => {
            mockBackPress = callback as () => boolean;
            return { remove: jest.fn() };
        });
    });

    afterEach(() => jest.restoreAllMocks());

    it("expands from the song row and collapses without leaving the home shell", () => {
        const renderer = render();
        expect(renderer.root.findAllByProps({ testID: "player-dock-vinyl" })).toHaveLength(0);
        expand(renderer);
        expect(renderer.root.findAllByProps({ testID: "player-dock-vinyl" }).length).toBeGreaterThan(0);
        expect(renderer.root.findAllByType(MusicInfo)).toHaveLength(0);
        press(renderer, "musicBar.a11y.collapse");
        expect(renderer.root.findAllByType(MusicInfo)).toHaveLength(1);
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("keeps playback, queue and transport actions connected to the existing player", () => {
        const renderer = render();
        press(renderer, "musicDetail.a11y.play");
        expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
        press(renderer, "musicBar.a11y.playlist");
        expect(showPanel).toHaveBeenCalledWith("PlayList");
        expand(renderer);
        press(renderer, "musicDetail.a11y.skipToPrevious");
        press(renderer, "musicDetail.a11y.skipToNext");
        expect(TrackPlayer.skipToPrevious).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.skipToNext).toHaveBeenCalledTimes(1);
        expect(renderer.root.findByType(SeekBar).props.variant).toBe("surface");
    });

    it("pauses an active track and removes a favorite through the shared APIs", () => {
        mockPaused = false;
        mockFavorite = true;
        const renderer = render();
        press(renderer, "musicDetail.a11y.pause");
        expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
        expand(renderer);
        press(renderer, "musicDetail.a11y.unfavorite");
        expect(MusicSheet.removeMusic).toHaveBeenCalledWith("favorites", mockSong);
    });

    it("adds a favorite and keeps a full-player entry in the expanded metadata", () => {
        const renderer = render();
        expand(renderer);
        press(renderer, "musicDetail.a11y.favorite");
        expect(MusicSheet.addMusic).toHaveBeenCalledWith("favorites", mockSong);
        press(renderer, "musicBar.a11y.openDetail");
        expect(mockNavigate).toHaveBeenCalledWith("music-detail");
        expect(renderer.root.findAllByType(MusicInfo)).toHaveLength(1);
    });

    it("closes on Android Back and when the selected destination changes", () => {
        const renderer = render();
        expand(renderer);
        act(() => expect(mockBackPress?.()).toBe(true));
        expect(renderer.root.findAllByType(MusicInfo)).toHaveLength(1);
        expand(renderer);
        act(() => renderer.update(<PlayerDock collapseKey="library" bottomNavigation={<React.Fragment>Navigation</React.Fragment>} />));
        expect(renderer.root.findAllByType(MusicInfo)).toHaveLength(1);
    });

    it("returns to compact mode after the current track is cleared", () => {
        const renderer = render();
        expand(renderer);
        mockMusic = null;
        act(() => renderer.update(<PlayerDock collapseKey="home" bottomNavigation={null} />));
        mockMusic = mockSong;
        act(() => renderer.update(<PlayerDock collapseKey="home" bottomNavigation={null} />));
        expect(renderer.root.findAllByType(MusicInfo)).toHaveLength(1);
    });

    it("keeps navigation available without a song and hides the player while typing", () => {
        mockMusic = null;
        const empty = render();
        expect(empty.root.findAllByType(MusicInfo)).toHaveLength(0);
        expect(empty.root.findAllByProps({ testID: "player-dock-surface" }).length).toBeGreaterThan(0);
        mockMusic = mockSong;
        const renderer = render();
        expand(renderer);
        act(() => mockKeyboardListeners.keyboardDidShow());
        expect(renderer.root.findAllByProps({ testID: "player-dock-vinyl" })).toHaveLength(0);
        expect(renderer.root.findAllByType(MusicInfo)).toHaveLength(0);
        act(() => mockKeyboardListeners.keyboardDidHide());
        expect(renderer.root.findAllByType(MusicInfo)).toHaveLength(1);
    });
});
