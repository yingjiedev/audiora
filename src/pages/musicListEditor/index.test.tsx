/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { getDefaultStore } from "jotai";
import MusicListEditor from ".";
import MusicItem from "@/components/mediaItem/musicItem";
import { PageAction } from "@/components/base/pageSection";
import SortableFlatList from "@/components/base/SortableFlatList";
import { MusicListSource, registerMusicListSource, releaseMusicListSource } from "@/core/musicListSource";
import { RequestStateCode } from "@/constants/commonConst";
import { editingMusicListAtom } from "./store/atom";
import MusicSheet from "@/core/musicSheet";
import TrackPlayer from "@/core/trackPlayer";

let mockParams: any;
jest.mock("@/core/router", () => ({ useParams: () => mockParams }));
jest.mock("@/hooks/useEnterTransitionEnd", () => () => true);
jest.mock("@/hooks/useColors", () => () => ({ appBar: "black", appBarText: "white" }));
jest.mock("@/utils/motion", () => ({ motionDuration: jest.fn(), motionEasing: {} }));
jest.mock("@/utils/mediaExtra", () => ({}));
jest.mock("@/utils/toast", () => ({ success: jest.fn(), warn: jest.fn() }));
jest.mock("@/core/i18n", () => {
    const i18n = { t: (key: string, args?: any) => `${key}${args?.count ?? ""}` };
    return { __esModule: true, default: i18n, useI18N: () => i18n };
});
jest.mock("@/core/localMusicSheet", () => ({ __esModule: true, default: { updateMusicList: jest.fn() } }));
jest.mock("@/core/musicHistory", () => ({ __esModule: true, default: { setHistory: jest.fn() } }));
jest.mock("@/core/musicSheet", () => ({ __esModule: true, default: { manualSort: jest.fn() } }));
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { addNext: jest.fn() } }));
jest.mock("@/core/downloader", () => ({ __esModule: true, default: { download: jest.fn() } }));
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/components/base/appBar", () => "AppBar");
jest.mock("@/components/base/statusBar", () => "StatusBar");
jest.mock("@/components/base/verticalSafeAreaView", () => "VerticalSafeAreaView");
jest.mock("@/components/base/horizontalSafeAreaView", () => "HorizontalSafeAreaView");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/textButton", () => "TextButton");
jest.mock("@/components/base/pageSection", () => ({ PageAction: "PageAction" }));
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/checkbox", () => "Checkbox");
jest.mock("@/components/base/empty", () => "Empty");
jest.mock("@/components/base/listEmpty", () => "ListEmpty");
jest.mock("@/components/base/listFooter", () => "ListFooter");
jest.mock("@/components/base/SortableFlatList", () => "SortableFlatList");
jest.mock("@/components/mediaItem/musicItem", () => ({ __esModule: true, default: "MusicItem", MUSIC_ITEM_HEIGHT: 60 }));
jest.mock("@shopify/flash-list", () => {
    const ReactMock = require("react");
    return { FlashList: (props: any) => ReactMock.createElement("FlashList", props,
        props.data.map((item: any, index: number) => ReactMock.createElement(ReactMock.Fragment, { key: index }, props.renderItem({ item, index }))),
        props.ListFooterComponent,
    ) };
});

const song = { id: "one", platform: "A", title: "Song", artist: "Artist" } as IMusic.IMusicItem;
const store = getDefaultStore();

describe("music list editor paging and local editing", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    let sourceId: string | undefined;
    beforeEach(() => {
        jest.clearAllMocks();
    });
    afterEach(() => {
        act(() => renderer?.unmount());
        if (sourceId) {
            releaseMusicListSource(sourceId);
            sourceId = undefined;
        }
    });

    it("retains selected songs across paging, leaves new songs unchecked, and hides local write actions", async () => {
        const second = { ...song, id: "two" };
        const source = new MusicListSource({ musicList: [song], state: RequestStateCode.PARTLY_DONE }, async () => {
            source.update({ musicList: [song, second], state: RequestStateCode.FINISHED });
        });
        sourceId = registerMusicListSource(source);
        mockParams = { musicList: [song], musicSheet: { id: "unsafe-remote-id" }, sourceId };
        act(() => {
            renderer = TestRenderer.create(<MusicListEditor />);
        });
        expect(renderer.root.findAllByType(SortableFlatList)).toHaveLength(0);
        expect(renderer.root.findAllByType(PageAction).some(button => button.props.title === "common.save")).toBe(false);
        expect(renderer.root.findAllByProps({ title: "common.delete" })).toHaveLength(0);
        const nextPlay = () => renderer.root.findAllByProps({ title: "musicListEditor.addToNextPlay" })[0];
        expect(nextPlay().props.disabled).toBe(true);
        act(() => renderer.root.findByType(MusicItem).props.onItemPress(song));
        await act(async () => {
            await source.loadMore();
        });
        expect(store.get(editingMusicListAtom).map(item => item.checked)).toEqual([true, false]);
        expect(renderer.root.findAllByType(MusicItem)).toHaveLength(2);
        act(() => renderer.root.findAllByType(PageAction).find(button => button.props.title === "common.selectAll")!.props.onPress());
        expect(store.get(editingMusicListAtom).every(item => item.checked)).toBe(true);
        await act(async () => {
            await nextPlay().props.onPress();
        });
        expect(TrackPlayer.addNext).toHaveBeenCalledWith([song, second]);
        expect(store.get(editingMusicListAtom).every(item => !item.checked)).toBe(true);
    });

    it("keeps the local full-list sort and save workflow", async () => {
        const second = { ...song, id: "two" };
        mockParams = { musicList: [song, second], musicSheet: { id: "favorite" } };
        act(() => {
            renderer = TestRenderer.create(<MusicListEditor />);
        });
        const sorted = store.get(editingMusicListAtom).slice().reverse();
        act(() => renderer.root.findByType(SortableFlatList).props.onSortEnd(sorted));
        await act(async () => {
            await renderer.root.findAllByType(PageAction).find(button => button.props.title === "common.save")!.props.onPress();
        });
        expect(MusicSheet.manualSort).toHaveBeenCalledWith("favorite", [second, song]);
    });
});
