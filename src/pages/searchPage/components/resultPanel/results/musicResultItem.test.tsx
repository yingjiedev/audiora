import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import MusicResultItem from "./musicResultItem";
import MusicItem from "@/components/mediaItem/musicItem";
import TrackPlayer from "@/core/trackPlayer";
import { RequestStateCode } from "@/constants/commonConst";

let mockBehavior = "playMusic";
jest.mock("@/core/appConfig", () => ({ __esModule: true, default: { getConfig: () => mockBehavior } }));
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { play: jest.fn(), playWithReplacePlayList: jest.fn() } }));
jest.mock("@/components/mediaItem/musicItem", () => "MusicItem");
jest.mock("@/constants/commonConst", () => ({ RequestStateCode: { IDLE: 0 } }));
const song = { id: "one", platform: "plugin", title: "Song", artist: "Artist", duration: 180 } as IMusic.IMusicItem;

describe("search song row adapter", () => {
    it.each(["playMusic", "playMusicAndReplace"])("preserves the %s playback setting and reads fresh results", behavior => {
        jest.clearAllMocks(); mockBehavior = behavior;
        const ref = { current: { state: RequestStateCode.IDLE, data: [song] } };
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<MusicResultItem item={song} index={0} query="Song" pluginSearchResultRef={ref} />);
        });
        const row = renderer.root.findByType(MusicItem);
        expect(row.props.highlightText).toBe("Song");
        expect(row.props.actions).toEqual(["favorite", "addNext", "more"]);
        const second = { ...song, id: "two" };
        ref.current.data = [song, second];
        act(() => row.props.onItemPress(song));
        if (behavior === "playMusic") {
            expect(TrackPlayer.play).toHaveBeenCalledWith(song);
            expect(TrackPlayer.playWithReplacePlayList).not.toHaveBeenCalled();
        } else {
            expect(TrackPlayer.playWithReplacePlayList).toHaveBeenCalledWith(song, [song, second]);
            expect(TrackPlayer.play).not.toHaveBeenCalled();
        }
        act(() => renderer.unmount());
    });
});
