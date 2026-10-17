import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import GroupedMusicList from "./groupedMusicList";
import MusicItem from "@/components/mediaItem/musicItem";
import { FlashList } from "@shopify/flash-list";
import { RequestStateCode } from "@/constants/commonConst";
import { groupTracks } from "@/utils/trackGroup";
import { trackSourceKey } from "@/utils/trackGroup";
import { showPanel } from "@/components/panels/usePanel";

let mockCurrent: IMusic.IMusicItem | null = null;
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@shopify/flash-list", () => {
    const R = require("react");
    return { FlashList: jest.fn(props => R.createElement("FlashList", props,
        props.ListHeaderComponent,
        props.data.map((item, index) => R.createElement(R.Fragment, { key: item.key }, props.renderItem({ item, index }))),
    )) };
});
jest.mock("@/components/mediaItem/musicItem", () => "MusicItem");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/listEmpty", () => "ListEmpty");
jest.mock("@/components/base/listFooter", () => "ListFooter");
jest.mock("@/core/trackPlayer", () => ({ useCurrentMusic: () => mockCurrent }));
jest.mock("@/core/pluginManager", () => ({ usePluginDisplayNameResolver: () => (name: string) => name }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/constants/commonConst", () => ({ RequestStateCode: { FINISHED: 8, PARTLY_DONE: 4, PENDING_REST_PAGE: 3 } }));

const a = { id: "one", platform: "A", title: "Song", artist: "Artist", duration: 180, album: "Album", artwork: "", aid: "plugin-key" } as IMusic.IMusicItem;
const b = { ...a, id: "two", platform: "B" };
const other = { ...a, id: "other", title: "Other" };

describe("grouped song rows", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    const onPlay = jest.fn();
    const onLoadMore = jest.fn();
    function render(items = [a, b, other], state = RequestStateCode.FINISHED) {
        act(() => {
            renderer = TestRenderer.create(<GroupedMusicList groups={groupTracks(items)} state={state} onPlay={onPlay} onLoadMore={onLoadMore} />);
        });
    }
    beforeEach(() => {
        jest.clearAllMocks(); mockCurrent = null;
    });
    afterEach(() => act(() => renderer?.unmount()));
    function openSources() {
        act(() => renderer.root.findAllByType(MusicItem)[0].props.source.onPress());
        return (showPanel as jest.Mock).mock.calls.at(-1)[1];
    }
    it("switches every row action and the whole playback queue to the selected original source", () => {
        render();
        const panel = openSources();
        act(() => panel.onSelect(trackSourceKey(b)));
        expect(onPlay).not.toHaveBeenCalled();
        const rows = renderer.root.findAllByType(MusicItem);
        expect(rows[0].props.musicItem).toBe(b);
        expect(rows[0].props.actions).toEqual(["favorite", "addNext", "more"]);
        act(() => rows[0].props.onItemPress());
        expect(onPlay).toHaveBeenCalledWith(b, [b, other]);
        expect(rows[0].props.musicItem.aid).toBe("plugin-key");
    });
    it("falls back safely when the selected favorite source is removed", () => {
        render();
        const panel = openSources();
        act(() => panel.onSelect(trackSourceKey(b)));
        act(() => renderer.update(<GroupedMusicList groups={groupTracks([a, other])} state={RequestStateCode.FINISHED} onPlay={onPlay} />));
        expect(renderer.root.findAllByType(MusicItem)[0].props.musicItem).toBe(a);
        expect(a.platform).toBe("A");
    });
    it("only loads more when a source has another page", () => {
        render([], RequestStateCode.PENDING_REST_PAGE);
        act(() => renderer.root.findByType(FlashList).props.onEndReached());
        expect(onLoadMore).not.toHaveBeenCalled();
        act(() => renderer.update(<GroupedMusicList groups={[]} state={RequestStateCode.PARTLY_DONE} onPlay={onPlay} onLoadMore={onLoadMore} />));
        act(() => renderer.root.findByType(FlashList).props.onEndReached());
        expect(onLoadMore).toHaveBeenCalledTimes(1);
    });
    it("reuses an untouched row while its stable play handler uses the newly appended queue", () => {
        const groups = groupTracks([a, other]);
        act(() => {
            renderer = TestRenderer.create(<GroupedMusicList groups={groups} state={RequestStateCode.FINISHED} onPlay={onPlay} />);
        });
        const firstPress = renderer.root.findAllByType(MusicItem)[0].props.onItemPress;
        const extra = { ...a, id: "extra", title: "Extra" };
        act(() => renderer.update(<GroupedMusicList groups={[...groups, ...groupTracks([extra])]} state={RequestStateCode.FINISHED} onPlay={onPlay} />));
        expect(renderer.root.findAllByType(MusicItem)[0].props.onItemPress).toBe(firstPress);
        act(() => firstPress());
        expect(onPlay).toHaveBeenCalledWith(a, [a, other, extra]);
    });
    it("restores a saved preferred source and supplies favorite management to the picker", () => {
        const actions = { link: jest.fn(), split: jest.fn(), removeSource: jest.fn(async () => {}), prefer: jest.fn(async () => {}) };
        const group = { key: "saved", groupId: "g", preferredKey: trackSourceKey(b), candidates: [a, b] };
        act(() => {
            renderer = TestRenderer.create(<GroupedMusicList groups={[group]} state={RequestStateCode.FINISHED} onPlay={onPlay} favoriteActions={actions} />);
        });
        expect(renderer.root.findByType(MusicItem).props.musicItem).toBe(b);
        const panel = openSources();
        expect(panel.group).toBe(group);
        expect(panel.favoriteActions).toBe(actions);
        expect(panel.selected).toBe(b);
        act(() => panel.onSelect(trackSourceKey(a)));
        expect(actions.prefer).toHaveBeenCalledWith(a);
        expect(openSources().selected).toBe(a);
        expect(actions.link).not.toHaveBeenCalled();
    });
    it("shows the actual playback source while actions still use the selected candidate", () => {
        mockCurrent = b;
        render();
        const rows = renderer.root.findAllByType(MusicItem);
        expect(rows[0].props.source).toMatchObject({ name: "B", count: 2, playing: true });
        expect(rows[0].props.musicItem).toBe(a);
        expect(rows[1].props.source).toMatchObject({ name: "A", count: 1, playing: false });
        expect(rows[1].props.source.onPress).toBeUndefined();
        expect(renderer.root.findAllByProps({ accessibilityRole: "radio" })).toHaveLength(0);
    });
    it("rejects source choices from an obsolete picker after results change or unmount", () => {
        render();
        const panel = openSources();
        act(() => renderer.update(<GroupedMusicList groups={groupTracks([a, other])} state={RequestStateCode.FINISHED} onPlay={onPlay} />));
        act(() => panel.onSelect(trackSourceKey(b)));
        expect(renderer.root.findAllByType(MusicItem)[0].props.musicItem).toBe(a);
        act(() => renderer.unmount());
        expect(() => panel.onSelect(trackSourceKey(a))).not.toThrow();
        expect(onPlay).not.toHaveBeenCalled();
    });
});
