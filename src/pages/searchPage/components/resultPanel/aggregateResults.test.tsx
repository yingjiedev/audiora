/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { getDefaultStore } from "jotai";
import AggregateResults from "./aggregateResults";
import GroupedMusicList from "@/components/musicList/groupedMusicList";
import { pageStatusAtom, PageStatus, queryAtom } from "../../store/atoms";
import { resetSearch } from "../../store/searchController";
import TrackPlayer from "@/core/trackPlayer";
import SearchPending from "./searchPending";
import type { SearchSelectionEntry } from "./useSearchSelection";
import { SearchRequestError } from "@/core/searchError";
import { RequestStateCode } from "@/constants/commonConst";

const song = { id: "1", platform: "A", title: "Song", artist: "Artist", duration: 200 } as IMusic.IMusicItem;
const mockA = { hash: "a", name: "A", instance: { platform: "A" }, methods: { search: jest.fn() } };
const mockB = { hash: "b", name: "B", instance: { platform: "B" }, methods: { search: jest.fn() } };
let mockSource: string | undefined;
let mockBehavior = "playMusicAndReplace";
let selectionEntry: SearchSelectionEntry | undefined;
const onSelectionChange = (entry?: SearchSelectionEntry) => {
    selectionEntry = entry; 
};
const mockNavigate = jest.fn();
jest.mock("@/core/pluginManager", () => ({
    __esModule: true,
    default: { getSearchablePlugins: () => [mockA, mockB], getSortedSearchablePlugins: () => [mockA, mockB] },
    useSearchablePlugins: () => [mockA, mockB],
    usePluginDisplayNameResolver: () => (plugin: { name: string }) => plugin.name,
}));
jest.mock("@/core/router", () => ({ ROUTE_PATH: { MUSIC_LIST_EDITOR: "music-list-editor" }, useParams: () => ({ pluginHash: mockSource }), useNavigate: () => mockNavigate }));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ setOptions: jest.fn() }) }));
jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: jest.fn(), hideDialog: jest.fn() }));
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/core/appConfig", () => ({ __esModule: true, default: { getConfig: () => mockBehavior } }));
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { play: jest.fn(), playWithReplacePlayList: jest.fn() } }));
jest.mock("@/components/musicList/groupedMusicList", () => {
    const R = require("react");
    return props => R.createElement("GroupedMusicList", props, props.renderHeader?.([]));
});
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/pageSection", () => ({ PageAction: "PageAction", PageState: "PageState" }));
jest.mock("./searchPending", () => "SearchPending");
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/constants/commonConst", () => ({ RequestStateCode: { IDLE: 0, PENDING_FIRST_PAGE: 2, PENDING_REST_PAGE: 3, PARTLY_DONE: 4, FINISHED: 8, ERROR: 128 } }));

describe("aggregate search view integration", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    beforeEach(() => {
        jest.clearAllMocks(); mockSource = undefined; mockBehavior = "playMusicAndReplace"; selectionEntry = undefined;
        resetSearch();
        getDefaultStore().set(queryAtom, "song");
        getDefaultStore().set(pageStatusAtom, PageStatus.SEARCHING);
        mockA.methods.search.mockResolvedValue({ data: [song], isEnd: false });
        mockB.methods.search.mockResolvedValue({ data: [{ ...song, platform: "B" }], isEnd: true });
    });
    afterEach(() => act(() => {
        renderer?.unmount(); resetSearch();
    }));
    async function render() {
        await act(async () => {
            renderer = TestRenderer.create(<AggregateResults onSelectionChange={onSelectionChange} />);
        });
    }
    it("groups sources without duplicate first-page calls and retains actual playback objects", async () => {
        await render();
        const props = renderer.root.findByType(GroupedMusicList).props;
        expect(props.groups).toHaveLength(1);
        expect(props.groups[0].candidates).toHaveLength(2);
        expect(mockA.methods.search).toHaveBeenCalledTimes(1);
        expect(mockB.methods.search).toHaveBeenCalledTimes(1);
        const selected = props.groups[0].candidates[1];
        act(() => props.onPlay(selected, [selected]));
        expect(TrackPlayer.playWithReplacePlayList).toHaveBeenCalledWith(selected, [selected]);
        mockBehavior = "playMusic";
        act(() => props.onPlay(song, [song]));
        expect(TrackPlayer.play).toHaveBeenCalledWith(song);
    });
    it("keeps partial results and only retries the failed source", async () => {
        mockB.methods.search.mockRejectedValueOnce(new Error("offline"));
        await render();
        expect(renderer.root.findByType(GroupedMusicList).props.groups[0].candidates).toEqual([song]);
        act(() => selectionEntry!.editor.start());
        await act(async () => renderer.root.findByType(GroupedMusicList).props.onRetry());
        expect(mockA.methods.search).toHaveBeenCalledTimes(1);
        expect(mockB.methods.search).toHaveBeenCalledTimes(2);
        expect(renderer.root.findByType(GroupedMusicList).props.groups[0].candidates).toHaveLength(2);
    });
    it("maintains the source scope even when rendering an aggregate view", async () => {
        mockSource = "a"; await render();
        expect(mockB.methods.search).not.toHaveBeenCalled();
        expect(renderer.root.findByType(GroupedMusicList).props.groups[0].candidates).toEqual([song]);
    });
    it("preserves configuration failures without leaving the inline list stuck loading", async () => {
        mockA.methods.search.mockResolvedValue({ data: [song], isEnd: true });
        mockB.methods.search.mockRejectedValueOnce(new SearchRequestError({ kind: "configuration", retryable: false }));
        await render();
        act(() => selectionEntry!.editor.start());
        await act(async () => {
            await renderer.root.findByType(GroupedMusicList).props.onRetry();
        });
        expect(renderer.root.findByType(GroupedMusicList).props.state).toBe(RequestStateCode.FINISHED);
        expect(renderer.root.findByType(GroupedMusicList).props.selection).toBeDefined();
        expect(mockB.methods.search).toHaveBeenCalledTimes(1);
    });
    it("selects all original sources in the mounted list and preserves checks while paging unfinished sources", async () => {
        await render();
        const originalList = renderer.root.findByType(GroupedMusicList);
        expect(originalList.props.renderHeader).toBeUndefined();
        expect(selectionEntry?.count).toBe(2);
        act(() => selectionEntry!.editor.start());
        const editing = renderer.root.findByType(GroupedMusicList).props;
        act(() => editing.selection.onToggleGroup(editing.groups[0].candidates));
        expect(renderer.root.findByType(GroupedMusicList).props.selection.selectedKeys.size).toBe(2);
        expect(mockNavigate).not.toHaveBeenCalled();
        const nextSong = { ...song, id: "next", title: "Next song" };
        mockA.methods.search.mockResolvedValueOnce({ data: [nextSong], isEnd: true });
        await act(async () => {
            await renderer.root.findByType(GroupedMusicList).props.onLoadMore();
        });
        expect(mockA.methods.search).toHaveBeenLastCalledWith("song", 2, "music");
        expect(mockB.methods.search).toHaveBeenCalledTimes(1);
        const currentList = renderer.root.findByType(GroupedMusicList);
        expect(currentList).toBe(originalList);
        expect(currentList.props.groups.flatMap((group: any) => group.candidates)).toEqual(expect.arrayContaining([song, nextSong, { ...song, platform: "B" }]));
        expect(currentList.props.selection.selectedKeys.size).toBe(2);
        expect(currentList.props.renderHeader).toBeUndefined();
        expect(selectionEntry?.count).toBe(3);
        expect(TrackPlayer.play).not.toHaveBeenCalled();
    });
    it("keeps early results usable during a slow source and stops waiting when only pagination remains", async () => {
        let finish!: (value: { data: IMusic.IMusicItem[]; isEnd: boolean }) => void;
        mockB.methods.search.mockImplementationOnce(() => new Promise(resolve => {
            finish = resolve;
        }));
        await render();
        const early = renderer.root.findByType(GroupedMusicList).props;
        expect(early.groups[0].candidates).toEqual([song]);
        expect(early.footerComponent.type).toBe(SearchPending);
        act(() => early.onPlay(song, [song]));
        expect(TrackPlayer.playWithReplacePlayList).toHaveBeenCalledWith(song, [song]);
        await act(async () => finish({ data: [], isEnd: true }));
        const ready = renderer.root.findByType(GroupedMusicList).props;
        expect(ready.footerComponent.type).not.toBe(SearchPending);
        expect(ready.emptyComponent.props.title).toBe("common.emptyList");
    });
});

jest.mock("@/components/musicList/useFavoriteGroupActions", () => () => ({ state: { version: 1, groups: [], separatedKeys: [] }, actions: {} }));
