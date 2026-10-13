import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import PlayList from "./index";
import Header from "./header";
import Body, { SheetBody } from "./body";
import TrackPlayer from "@/core/trackPlayer";
import musicHistory from "@/core/musicHistory";
import { showPanel, hidePanel } from "../../usePanel";
import { showDialog } from "@/components/dialogs/useDialog";
import downloader from "@/core/downloader";
import { clearSheetPlaybackHistory, ISheetPlaybackEntry } from "@/core/sheetPlaybackHistory";

const song = { id: "one", platform: "demo", title: "One", artist: "Artist" } as IMusic.IMusicItem;
const other = { ...song, id: "two", title: "Two" };
let mockQueue = [song, other];
let mockHistory = [other];
let mockSheets: ISheetPlaybackEntry[] = [];
const mockNavigate = jest.fn();

jest.mock("../../base/panelBase", () => ({ __esModule: true, default: (props: { renderBody: (loading: boolean) => React.ReactNode }) => props.renderBody(false) }));
jest.mock("./body", () => ({ __esModule: true, default: "SongBody", SheetBody: "SheetBody" }));
jest.mock("react-native-gesture-handler", () => ({ GestureHandlerRootView: "GestureRoot" }));
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/hooks/useColors", () => () => ({ text: "#10172D", textSecondary: "#777777" }));
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value / 2 }));
jest.mock("@/utils/mediaUtils", () => ({ getMediaUniqueKey: (item: IMusic.IMusicItem) => `${item.platform}@${item.id}` }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/core/trackPlayer", () => ({
    __esModule: true,
    default: { get playList() {
        return mockQueue;
    }, play: jest.fn(), remove: jest.fn(), clearPlayList: jest.fn(), reorderPlayList: jest.fn(), toggleRepeatMode: jest.fn() },
    usePlayList: () => mockQueue,
    useRepeatMode: () => "QUEUE",
}));
jest.mock("@/core/musicHistory", () => ({
    __esModule: true,
    default: { get history() {
        return mockHistory;
    }, removeMusic: jest.fn(), clearMusic: jest.fn(), setHistory: jest.fn() },
    useMusicHistory: () => mockHistory,
}));
jest.mock("@/core/sheetPlaybackHistory", () => ({ useSheetPlaybackHistory: () => mockSheets, removeSheetPlayback: jest.fn(), clearSheetPlaybackHistory: jest.fn() }));
jest.mock("@/core/router", () => ({
    ROUTE_PATH: { LOCAL_SHEET_DETAIL: "local-sheet-detail", PLUGIN_SHEET_DETAIL: "plugin-sheet-detail", ALBUM_DETAIL: "album-detail", TOP_LIST_DETAIL: "top-list-detail" },
    useNavigate: () => mockNavigate,
}));
jest.mock("@/core/playerOverlay", () => ({ closePlayer: jest.fn() }));
jest.mock("@/core/downloader", () => ({ __esModule: true, default: { download: jest.fn() } }));
jest.mock("../../usePanel", () => ({ showPanel: jest.fn(), hidePanel: jest.fn() }));
jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: jest.fn() }));

describe("playback drawer", () => {
    const renderers: TestRenderer.ReactTestRenderer[] = [];
    function render(initialTab?: "queue" | "history" | "sheets") {
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<PlayList initialTab={initialTab} />);
        });
        renderers.push(renderer);
        return renderer;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        mockQueue = [song, other];
        mockHistory = [other];
        mockSheets = [];
    });
    afterEach(() => act(() => {
        renderers.splice(0).forEach(renderer => renderer.unmount());
    }));

    it("defaults to the queue and exposes live independent counts", () => {
        const renderer = render();
        expect(renderer.root.findByType(Header).props).toMatchObject({ tab: "queue", counts: { queue: 2, history: 1, sheets: 0 } });
        expect(renderer.root.findByType(Body).props.musics).toBe(mockQueue);
        expect(renderer.root.findByProps({ testID: "playback-tab-queue" }).props.accessibilityState.selected).toBe(true);
    });

    it("opens history directly and switches lists without replacing the queue", () => {
        const renderer = render("history");
        expect(renderer.root.findByType(Body).props.musics).toBe(mockHistory);
        act(() => renderer.root.findByProps({ testID: "playback-tab-sheets" }).props.onPress());
        expect(renderer.root.findByType(SheetBody).props.entries).toBe(mockSheets);
        expect(TrackPlayer.play).not.toHaveBeenCalled();
        expect(TrackPlayer.clearPlayList).not.toHaveBeenCalled();
    });

    it.each(["queue", "history"] as const)("downloads and collects only the %s tab songs", tab => {
        const renderer = render(tab);
        const header = renderer.root.findByType(Header);
        act(() => {
            header.props.onDownload(); header.props.onAdd();
        });
        const items = tab === "queue" ? mockQueue : mockHistory;
        expect(downloader.download).toHaveBeenCalledWith(items);
        expect(showPanel).toHaveBeenCalledWith("AddToMusicSheet", { musicItem: items });
    });

    it.each(["queue", "history", "sheets"] as const)("confirms clearing %s without changing the other lists", tab => {
        mockSheets = [{ sheet: { id: "s", platform: "local" }, routeName: "local-sheet-detail" }];
        const renderer = render(tab);
        act(() => renderer.root.findByType(Header).props.onClear());
        expect(TrackPlayer.clearPlayList).not.toHaveBeenCalled();
        expect(musicHistory.clearMusic).not.toHaveBeenCalled();
        expect(clearSheetPlaybackHistory).not.toHaveBeenCalled();
        const confirm = jest.mocked(showDialog).mock.calls[0][1] as { onOk: () => void; content: string };
        expect(confirm.content).toBe(`panel.playList.clear.${tab}`);
        act(() => confirm.onOk());
        expect(TrackPlayer.clearPlayList).toHaveBeenCalledTimes(tab === "queue" ? 1 : 0);
        expect(musicHistory.clearMusic).toHaveBeenCalledTimes(tab === "history" ? 1 : 0);
        expect(clearSheetPlaybackHistory).toHaveBeenCalledTimes(tab === "sheets" ? 1 : 0);
    });

    it("plays a history song and removes its record without removing queue songs", () => {
        const renderer = render("history");
        const body = renderer.root.findByType(Body);
        act(() => {
            body.props.onPlay(other); body.props.onRemove(other);
        });
        expect(TrackPlayer.play).toHaveBeenCalledWith(other);
        expect(musicHistory.removeMusic).toHaveBeenCalledWith(other);
        expect(TrackPlayer.remove).not.toHaveBeenCalled();
    });

    it("reorders using the latest queue and ignores a removed dragged item", () => {
        const renderer = render();
        const body = renderer.root.findByType(Body);
        act(() => body.props.onMove(song, 1));
        expect(TrackPlayer.reorderPlayList).toHaveBeenCalledWith([other, song]);
        jest.mocked(TrackPlayer.reorderPlayList).mockClear();
        mockQueue = [other];
        act(() => body.props.onMove(song, 1));
        expect(TrackPlayer.reorderPlayList).not.toHaveBeenCalled();
    });

    it("persists history reordering without touching the playback queue", () => {
        mockHistory = [song, other];
        const renderer = render("history");
        act(() => renderer.root.findByType(Body).props.onMove(song, 1));
        expect(musicHistory.setHistory).toHaveBeenCalledWith([other, song]);
        expect(TrackPlayer.reorderPlayList).not.toHaveBeenCalled();
    });

    it.each(["local-sheet-detail", "plugin-sheet-detail", "album-detail", "top-list-detail"] as const)("opens the original %s collection route", routeName => {
        const entry: ISheetPlaybackEntry = { sheet: { id: "s", platform: "plugin", title: "Collection" }, routeName };
        mockSheets = [entry];
        const renderer = render("sheets");
        act(() => renderer.root.findByType(SheetBody).props.onOpen(entry));
        expect(hidePanel).toHaveBeenCalledTimes(1);
        expect(jest.requireMock("@/core/playerOverlay").closePlayer).toHaveBeenCalledTimes(1);
        const params = routeName === "local-sheet-detail" ? { id: "s" } : routeName === "album-detail" ? { albumItem: entry.sheet } : routeName === "top-list-detail" ? { topList: entry.sheet, pluginHash: "plugin" } : { sheetInfo: entry.sheet };
        expect(mockNavigate).toHaveBeenCalledWith(routeName, params);
    });

    it("disables bulk actions for an empty song list", () => {
        mockHistory = [];
        const renderer = render("history");
        const buttons = renderer.root.findAll(node => node.props.accessibilityRole === "button" && node.props.accessibilityLabel === "common.download");
        expect(buttons.length).toBeGreaterThan(0);
        expect(buttons.every(node => node.props.accessibilityState.disabled === true)).toBe(true);
    });
});
