import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import SheetMusicList from "./sheetMusicList";
import GroupedMusicList from "@/components/musicList/groupedMusicList";
import MusicList from "@/components/musicList";
import PillTabBar from "@/components/base/pillTabBar";
import Header from "./header";
import TrackPlayer from "@/core/trackPlayer";

const song = { id: "1", platform: "A", title: "Song", artist: "Artist", duration: 200 } as IMusic.IMusicItem;
const mockList = [song, { ...song, platform: "B" }];
let mockId = "favorite";
jest.mock("@/core/router", () => ({ useParams: () => ({ id: mockId }) }));
jest.mock("@react-navigation/native", () => ({ useRoute: () => ({ name: "local-sheet-detail" }) }));
jest.mock("@/core/musicSheet", () => ({ useSheetItem: () => ({ id: mockId, musicList: mockList }) }));
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, useCurrentMusic: () => null, default: { playWithReplacePlayList: jest.fn() } }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("./header", () => "Header");
jest.mock("@/components/base/pillTabBar", () => "PillTabBar");
jest.mock("@/components/base/horizontalSafeAreaView", () => "SafeArea");
jest.mock("@/components/musicList/groupedMusicList", () => {
    const R = require("react");
    return props => R.createElement("GroupedMusicList", props, props.renderHeader?.([song]));
});
jest.mock("@/components/musicList", () => {
    const R = require("react");
    return props => R.createElement("MusicList", props, props.Header);
});
jest.mock("@/constants/commonConst", () => ({ RequestStateCode: { IDLE: 0, FINISHED: 8 } }));

describe("favorite view integration", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    beforeEach(() => {
        mockId = "favorite"; jest.clearAllMocks();
    });
    afterEach(() => act(() => renderer?.unmount()));
    function render() {
        act(() => {
            renderer = TestRenderer.create(<SheetMusicList />);
        });
    }
    it("offers grouped playback and a reversible view of every saved source", () => {
        render();
        const list = renderer.root.findByType(GroupedMusicList);
        expect(list.props.groups).toHaveLength(1);
        expect(renderer.root.findByType(Header).props.groupCount).toBe(1);
        act(() => list.props.onPlay(song, [song]));
        expect(TrackPlayer.playWithReplacePlayList).toHaveBeenCalledWith(song, [song], { sheet: { id: "favorite", musicList: mockList }, routeName: "local-sheet-detail" });
        act(() => renderer.root.findByType(PillTabBar).props.onIndexChange(1));
        expect(renderer.root.findByType(MusicList).props.musicList).toBe(mockList);
        expect(mockList).toHaveLength(2);
    });
    it("retains the original list for ordinary local playlists", () => {
        mockId = "ordinary"; render();
        expect(renderer.root.findAllByType(GroupedMusicList)).toHaveLength(0);
        expect(renderer.root.findAllByType(PillTabBar)).toHaveLength(0);
        expect(renderer.root.findByType(MusicList).props.musicList).toBe(mockList);
    });
});

jest.mock("@/components/musicList/useFavoriteGroupActions", () => () => ({ state: { version: 1, groups: [], separatedKeys: [] }, actions: {} }));
