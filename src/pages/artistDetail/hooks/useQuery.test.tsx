/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { getDefaultStore } from "jotai";
import { RequestStateCode } from "@/constants/commonConst";
import { initQueryResult, queryResultAtom } from "../store/atoms";
import useQueryArtist from "./useQuery";

const mockRequest = jest.fn();
jest.mock("@/core/pluginManager", () => ({ __esModule: true, default: { getByHash: () => ({ methods: { getArtistWorks: mockRequest } }) } }));
jest.mock("@/utils/motion", () => ({ motionDuration: jest.fn(), motionEasing: {} }));
jest.mock("@/utils/mediaExtra", () => ({}));
jest.mock("@/utils/log", () => ({ errorLog: jest.fn() }));
const artist = { id: "artist", platform: "A", name: "Artist" } as IArtist.IArtistItem;
const song = { id: "one", platform: "A", title: "Song", artist: "Artist" } as IMusic.IMusicItem;
const store = getDefaultStore();

describe("artist pagination shared with the editor", () => {
    let query!: ReturnType<typeof useQueryArtist>;
    let renderer: TestRenderer.ReactTestRenderer;
    function Harness() {
        query = useQueryArtist("a");
        return null;
    }
    beforeEach(() => {
        mockRequest.mockReset();
        store.set(queryResultAtom, initQueryResult);
        act(() => {
            renderer = TestRenderer.create(<Harness />);
        });
    });
    afterEach(() => act(() => renderer.unmount()));

    it("retains songs after failure and retries the same page", async () => {
        mockRequest.mockResolvedValueOnce({ data: [song], isEnd: false });
        await act(async () => {
            await query(artist);
        });
        mockRequest.mockRejectedValueOnce(new Error("offline"));
        await act(async () => {
            await query(artist);
        });
        expect(store.get(queryResultAtom).music).toMatchObject({ page: 1, data: [song], state: RequestStateCode.ERROR });
        mockRequest.mockResolvedValueOnce({ data: [song, { ...song, id: "two" }], isEnd: true });
        await act(async () => {
            await query(artist);
        });
        expect(mockRequest).toHaveBeenLastCalledWith(artist, 2, "music");
        expect(store.get(queryResultAtom).music.data).toHaveLength(2);
    });

    it("ignores a late response after the artist page resets", async () => {
        let finish!: (value: any) => void;
        mockRequest.mockImplementationOnce(() => new Promise(resolve => {
            finish = resolve;
        }));
        let pending!: Promise<void>;
        act(() => {
            pending = query(artist);
        });
        store.set(queryResultAtom, initQueryResult);
        mockRequest.mockResolvedValueOnce({ data: [{ ...song, id: "new" }], isEnd: true });
        await act(async () => {
            await query({ ...artist, id: "new-artist" });
        });
        await act(async () => {
            finish({ data: [song], isEnd: true }); await pending;
        });
        expect(store.get(queryResultAtom).music.data?.[0].id).toBe("new");
    });
});
