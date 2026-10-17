/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { getDefaultStore } from "jotai";
import AggregateResults from "./aggregateResults";
import GroupedMusicList from "@/components/musicList/groupedMusicList";
import { PageAction } from "@/components/base/pageSection";
import { pageStatusAtom, PageStatus, queryAtom } from "../../store/atoms";
import { resetSearch } from "../../store/searchController";
import TrackPlayer from "@/core/trackPlayer";
import SearchPending from "./searchPending";

const song = { id: "1", platform: "A", title: "Song", artist: "Artist", duration: 200 } as IMusic.IMusicItem;
const mockA = { hash: "a", name: "A", instance: { platform: "A" }, methods: { search: jest.fn() } };
const mockB = { hash: "b", name: "B", instance: { platform: "B" }, methods: { search: jest.fn() } };
let mockSource: string | undefined;
let mockBehavior = "playMusicAndReplace";
jest.mock("@/core/pluginManager", () => ({
    __esModule: true,
    default: { getSearchablePlugins: () => [mockA, mockB], getSortedSearchablePlugins: () => [mockA, mockB] },
    useSearchablePlugins: () => [mockA, mockB],
    usePluginDisplayNameResolver: () => (plugin: { name: string }) => plugin.name,
}));
jest.mock("@/core/router", () => ({ useParams: () => ({ pluginHash: mockSource }), useNavigate: () => jest.fn() }));
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
        jest.clearAllMocks(); mockSource = undefined; mockBehavior = "playMusicAndReplace";
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
            renderer = TestRenderer.create(<AggregateResults />);
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
        await act(async () => renderer.root.findAllByType(PageAction).find(button => button.props.title === "aggregate.retryIncomplete")!.props.onPress());
        expect(mockA.methods.search).toHaveBeenCalledTimes(1);
        expect(mockB.methods.search).toHaveBeenCalledTimes(2);
        expect(renderer.root.findAllByType(PageAction).find(button => button.props.title === "aggregate.retryIncomplete")!.props.disabled).toBe(true);
        expect(renderer.root.findByType(GroupedMusicList).props.groups[0].candidates).toHaveLength(2);
    });
    it("maintains the source scope even when rendering an aggregate view", async () => {
        mockSource = "a"; await render();
        expect(mockB.methods.search).not.toHaveBeenCalled();
        expect(renderer.root.findByType(GroupedMusicList).props.groups[0].candidates).toEqual([song]);
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
