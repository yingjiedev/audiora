import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import MusicList from ".";
import MusicItem from "@/components/mediaItem/musicItem";
import TrackPlayer from "@/core/trackPlayer";
import { FlashList } from "@shopify/flash-list";
import { RequestStateCode } from "@/constants/commonConst";

jest.mock("@shopify/flash-list", () => {
    const ReactMock = require("react");
    return { FlashList: jest.fn(props => ReactMock.createElement("FlashList", props, props.data.map((item: IMusic.IMusicItem, index: number) => ReactMock.createElement(ReactMock.Fragment, { key: item.id }, props.renderItem({ item, index }))))) };
});
jest.mock("@/components/mediaItem/musicItem", () => "MusicItem");
jest.mock("@/components/base/listEmpty", () => "ListEmpty");
jest.mock("@/components/base/listFooter", () => "ListFooter");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { playWithReplacePlayList: jest.fn() } }));
jest.mock("@react-navigation/native", () => ({ useRoute: () => ({ name: "local-sheet-detail" }) }));
jest.mock("@/constants/commonConst", () => ({ RequestStateCode: { IDLE: 0, PARTLY_DONE: 1, PENDING_FIRST_PAGE: 2 } }));
jest.mock("@/hooks/useColors", () => () => ({ text: "black" }));
jest.mock("@/utils/mediaUtils", () => ({ isSameMediaItem: (a: IMusic.IMusicItem, b: IMusic.IMusicItem) => !!b && a.id === b.id && a.platform === b.platform }));

const song = { id: "one", platform: "plugin", title: "Song", artist: "Artist", duration: 180 } as IMusic.IMusicItem;
const sheet = { id: "favorite", title: "Favorites", platform: "local" } as IMusic.IMusicSheetItem;

describe("shared song list", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    beforeEach(() => jest.clearAllMocks());
    afterEach(() => act(() => renderer?.unmount()));
    function render(props: Partial<React.ComponentProps<typeof MusicList>> = {}) {
        act(() => {
            renderer = TestRenderer.create(<MusicList musicList={[song]} musicSheet={sheet} state={RequestStateCode.IDLE} {...props} />);
        });
    }
    it("forwards scene-specific presentation through the same song row and retains playback context", () => {
        render({ showIndex: true, actions: ["more"] });
        const row = renderer.root.findByType(MusicItem);
        expect(row.props.index).toBe(1);
        expect(row.props.actions).toEqual(["more"]);
        expect(row.props.musicSheet).toBe(sheet);
        act(() => row.props.onItemPress(song));
        expect(TrackPlayer.playWithReplacePlayList).toHaveBeenCalledWith(song, [song], { sheet, routeName: "local-sheet-detail" });
    });
    it("preserves page-specific playback overrides", () => {
        const onItemPress = jest.fn(); render({ onItemPress });
        act(() => renderer.root.findByType(MusicItem).props.onItemPress(song));
        expect(onItemPress).toHaveBeenCalledWith(song, [song]);
        expect(TrackPlayer.playWithReplacePlayList).not.toHaveBeenCalled();
    });
    it("keeps empty and pending lists safe and only requests pagination in allowed states", () => {
        const onLoadMore = jest.fn(); render({ musicList: undefined, state: RequestStateCode.PENDING_FIRST_PAGE, onLoadMore });
        expect(renderer.root.findAllByType(MusicItem)).toHaveLength(0);
        act(() => renderer.root.findByType(FlashList).props.onEndReached());
        expect(onLoadMore).not.toHaveBeenCalled();
        act(() => renderer.update(<MusicList state={RequestStateCode.PARTLY_DONE} onLoadMore={onLoadMore} />));
        act(() => renderer.root.findByType(FlashList).props.onEndReached());
        expect(onLoadMore).toHaveBeenCalledTimes(1);
    });
});
