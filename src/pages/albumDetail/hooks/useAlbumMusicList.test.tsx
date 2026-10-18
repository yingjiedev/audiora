/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import React from "react";
import { InteractionManager } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { RequestStateCode } from "@/constants/commonConst";
import useAlbumDetail from "./useAlbumMusicList";
import usePluginSheetMusicList from "@/pages/pluginSheetDetail/hooks/usePluginSheetMusicList";
import useTopListDetail from "@/pages/topListDetail/hooks/useTopListDetail";

const mockRequest = jest.fn();
jest.mock("@/core/pluginManager", () => ({ __esModule: true, default: {
    getByMedia: () => ({ methods: { getAlbumInfo: mockRequest, getMusicSheetInfo: mockRequest } }),
    getByHash: () => ({ methods: { getTopListDetail: mockRequest } }),
} }));
jest.mock("@/utils/motion", () => ({ motionDuration: jest.fn(), motionEasing: {} }));

const item = { id: "collection", platform: "A", title: "Collection" };
const first = { id: "one", platform: "A", title: "First", artist: "Artist" } as IMusic.IMusicItem;
const second = { ...first, id: "two" };

function useTopCollection(collection: any) {
    const [detail, state, loadMore] = useTopListDetail(collection, "a");
    return [state, detail, detail?.musicList ?? [], loadMore] as const;
}

describe.each([useAlbumDetail, usePluginSheetMusicList, useTopCollection])("remote collection pagination", useCollection => {
    let renderer: TestRenderer.ReactTestRenderer;
    let result: readonly [RequestStateCode, unknown, IMusic.IMusicItem[], () => Promise<void>];
    function Harness() {
        result = useCollection(item as any);
        return null;
    }
    beforeEach(() => {
        mockRequest.mockReset();
        jest.spyOn(InteractionManager, "runAfterInteractions").mockImplementation(callback => {
            if (typeof callback === "function") {
                callback();
            }
            return { cancel: jest.fn(), then: jest.fn(), done: jest.fn() } as any;
        });
    });
    afterEach(() => {
        act(() => renderer?.unmount());
        jest.restoreAllMocks();
    });

    it("loads one initial page, keeps the first page, and retries the same failed next page", async () => {
        mockRequest.mockResolvedValueOnce({ musicList: [first], isEnd: false });
        await act(async () => {
            renderer = TestRenderer.create(<Harness />);
        });
        expect(mockRequest).toHaveBeenCalledTimes(1);
        expect(result[2]).toEqual([first]);
        mockRequest.mockRejectedValueOnce(new Error("offline"));
        await act(async () => {
            await result[3]();
        });
        expect(result[0]).toBe(RequestStateCode.ERROR);
        expect(result[2]).toEqual([first]);
        mockRequest.mockResolvedValueOnce({ musicList: [second], isEnd: true });
        await act(async () => {
            await result[3]();
        });
        expect(mockRequest).toHaveBeenLastCalledWith(item, 2);
        expect(result[2]).toEqual([first, second]);
        await act(async () => {
            await result[3]();
        });
        expect(mockRequest).toHaveBeenCalledTimes(3);
    });

    if (useCollection === usePluginSheetMusicList) {
        it("keeps imported collection snapshots without requesting the plugin", async () => {
            function ImportedHarness() {
                result = usePluginSheetMusicList({ ...item, isImported: true, musicList: [first] } as any);
                return null;
            }
            await act(async () => {
                renderer = TestRenderer.create(<ImportedHarness />);
            });
            expect(mockRequest).not.toHaveBeenCalled();
            expect(result[0]).toBe(RequestStateCode.FINISHED);
            expect(result[2]).toEqual([first]);
        });
    }
});
