/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { getDefaultStore } from "jotai";
import { initSearchResults, pageStatusAtom, PageStatus, searchResultsAtom } from "../store/atoms";
import useSearch from "./useSearch";

let mockSource: string | undefined;
const mockA = { hash: "a", name: "A", instance: { platform: "A" }, methods: { search: jest.fn(async () => ({ data: [], isEnd: true })) } };
const mockB = { hash: "b", name: "B", instance: { platform: "B" }, methods: { search: jest.fn(async () => ({ data: [], isEnd: true })) } };
let mockPlugins = [mockA, mockB];
jest.mock("@/core/router", () => ({ useParams: () => mockSource ? { pluginHash: mockSource } : undefined }));
jest.mock("@/core/pluginManager", () => ({ __esModule: true, default: { getSearchablePlugins: () => mockPlugins } }));
jest.mock("@/utils/log", () => ({ devLog: jest.fn(), errorLog: jest.fn(), trace: jest.fn() }));
jest.mock("@/constants/commonConst", () => ({ RequestStateCode: { IDLE: 0, PENDING_FIRST_PAGE: 2, PENDING_REST_PAGE: 3, PARTLY_DONE: 4, FINISHED: 8, ERROR: 128 } }));

describe("library search source scope", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    let search: ReturnType<typeof useSearch>;
    function Harness() {
        search = useSearch(); return null;
    }
    beforeEach(() => {
        jest.clearAllMocks(); mockSource = undefined; mockPlugins = [mockA, mockB];
        getDefaultStore().set(searchResultsAtom, initSearchResults);
        getDefaultStore().set(pageStatusAtom, PageStatus.SEARCHING);
    });
    afterEach(() => act(() => renderer?.unmount()));
    function render() {
        act(() => {
            renderer = TestRenderer.create(<Harness />);
        });
    }
    async function submit(hash?: string) {
        await act(async () => {
            await search("song", 1, "music", hash); await Promise.resolve();
        });
    }

    it("uses all enabled searchable sources for the ordinary search entry", async () => {
        render(); await submit();
        expect(mockA.methods.search).toHaveBeenCalledWith("song", 1, "music");
        expect(mockB.methods.search).toHaveBeenCalledWith("song", 1, "music");
    });
    it("keeps typed and history searches scoped to the selected library source", async () => {
        mockSource = "a"; render(); await submit();
        expect(mockA.methods.search).toHaveBeenCalledTimes(1);
        expect(mockB.methods.search).not.toHaveBeenCalled();
        expect(Object.keys(getDefaultStore().get(searchResultsAtom).music)).toEqual(["a"]);
    });
    it("does not fall back to every source if the selected source is removed or disabled", async () => {
        mockSource = "a"; mockPlugins = [mockB]; render(); await submit();
        expect(mockA.methods.search).not.toHaveBeenCalled();
        expect(mockB.methods.search).not.toHaveBeenCalled();
        expect(getDefaultStore().get(pageStatusAtom)).toBe(PageStatus.NO_PLUGIN);
    });
    it("honors explicit result-page pagination scope", async () => {
        mockSource = "a"; render(); await submit("b");
        expect(mockA.methods.search).not.toHaveBeenCalled();
        expect(mockB.methods.search).toHaveBeenCalledTimes(1);
    });
    it("refreshes the scope when navigation reuses the search page for another source", async () => {
        mockSource = "a"; render();
        mockSource = "b"; act(() => renderer.update(<Harness />)); await submit();
        expect(mockA.methods.search).not.toHaveBeenCalled();
        expect(mockB.methods.search).toHaveBeenCalledTimes(1);
    });
    it("ignores a previous source's late response after scope changes", async () => {
        let finish!: (value: { data: never[]; isEnd: boolean }) => void;
        mockA.methods.search.mockImplementationOnce(() => new Promise(resolve => {
            finish = resolve;
        }));
        mockSource = "a"; render(); await submit();
        mockSource = "b";
        act(() => {
            getDefaultStore().set(searchResultsAtom, initSearchResults); renderer.update(<Harness />);
        });
        await submit();
        await act(async () => {
            finish({ data: [], isEnd: true }); await Promise.resolve();
        });
        expect(Object.keys(getDefaultStore().get(searchResultsAtom).music)).toEqual(["b"]);
    });
    it("leaves a retryable error result when the selected source fails", async () => {
        mockA.methods.search.mockRejectedValueOnce(new Error("Offline"));
        mockSource = "a"; render(); await submit();
        expect(getDefaultStore().get(searchResultsAtom).music.a.state).toBe(128);
        expect(mockB.methods.search).not.toHaveBeenCalled();
    });
});
