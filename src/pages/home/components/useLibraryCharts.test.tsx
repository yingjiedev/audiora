/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { getDefaultStore } from "jotai";
import { RequestStateCode } from "@/constants/commonConst";
import { pluginsTopListAtom } from "@/pages/topList/store/atoms";
import type { Plugin } from "@/core/pluginManager";
import useLibraryCharts from "./useLibraryCharts";

jest.mock("@/core/pluginManager", () => ({ __esModule: true, default: { isPluginEnabled: () => true } }));
jest.mock("@/utils/motion", () => ({ motionDuration: () => 160, motionEasing: {} }));

const sheets = Array.from({ length: 6 }, (_, index) => ({ id: String(index), platform: "source", title: `Chart ${index}` }));
const songs = Array.from({ length: 8 }, (_, index) => ({ id: String(index), platform: "source", title: `Song ${index}`, artist: "Artist", album: "Album", artwork: "", duration: 180 }));
const store = getDefaultStore();
let hashSequence = 0;
function source(methods: Record<string, any> = {}) {
    return {
        hash: `source-${++hashSequence}`, name: "Source", supportedMethods: new Set(["getTopLists", "getTopListDetail"]),
        methods: { getTopLists: jest.fn(async () => [{ title: "Charts", data: sheets }]), getTopListDetail: jest.fn(async () => ({ musicList: songs })), ...methods },
    } as unknown as Plugin;
}

describe("library charts requests and scope", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    let result: ReturnType<typeof useLibraryCharts>;
    const Capture = ({ plugin, index = 0 }: { plugin?: Plugin; index?: number }) => {
        result = useLibraryCharts(plugin, index);
        return null;
    };
    const flush = async () => act(async () => {
        await new Promise(resolve => setImmediate(resolve));
    });
    async function render(plugin?: Plugin, index = 0) {
        act(() => {
            renderer = TestRenderer.create(React.createElement(Capture, { plugin, index }));
        });
        await flush();
    }
    beforeEach(() => store.set(pluginsTopListAtom, {}));
    afterEach(() => act(() => renderer?.unmount()));

    it("loads only the current card and neighbour and caps unique previews at five real songs", async () => {
        const plugin = source({ getTopListDetail: jest.fn(async () => ({ musicList: [songs[0], ...songs], topListItem: { title: "Updated chart" } })) });
        await render(plugin);
        expect(plugin.methods.getTopLists).toHaveBeenCalledTimes(1);
        expect(plugin.methods.getTopListDetail).toHaveBeenCalledTimes(2);
        expect(result!.getPreview(sheets[0])).toEqual({ state: "ready", musicList: songs.slice(0, 5), sheet: { ...sheets[0], title: "Updated chart" } });
        act(() => renderer.update(React.createElement(Capture, { plugin, index: 1 })));
        await flush();
        expect(plugin.methods.getTopListDetail).toHaveBeenCalledTimes(3);
        expect(plugin.methods.getTopListDetail).toHaveBeenLastCalledWith(sheets[2], 1);
        act(() => renderer.update(React.createElement(Capture, { plugin, index: 0 })));
        await flush();
        expect(plugin.methods.getTopListDetail).toHaveBeenCalledTimes(3);
    });

    it("reuses the shared catalog cache and removes duplicate charts", async () => {
        const plugin = source();
        store.set(pluginsTopListAtom, { [plugin.hash]: { state: RequestStateCode.FINISHED, data: [{ title: "A", data: [sheets[0], sheets[0], sheets[1]] }] } });
        await render(plugin);
        expect(plugin.methods.getTopLists).not.toHaveBeenCalled();
        expect(result!.charts).toEqual(sheets.slice(0, 2));
    });

    it("shows a catalog failure and retries without a request loop", async () => {
        const getTopLists = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([{ title: "Charts", data: sheets }]);
        const plugin = source({ getTopLists });
        await render(plugin);
        expect(result!.hasError).toBe(true);
        expect(getTopLists).toHaveBeenCalledTimes(1);
        await act(async () => {
            await result!.retryCatalog();
        });
        await flush();
        expect(result!.charts).toHaveLength(6);
        expect(getTopLists).toHaveBeenCalledTimes(2);
    });

    it("keeps empty catalogs honest and refreshable", async () => {
        const plugin = source({ getTopLists: jest.fn(async () => []) });
        await render(plugin);
        expect(result!.loading).toBe(false);
        expect(result!.charts).toEqual([]);
        expect(plugin.methods.getTopListDetail).not.toHaveBeenCalled();
        await act(async () => {
            await result!.retryCatalog();
        });
        expect(plugin.methods.getTopLists).toHaveBeenCalledTimes(2);
    });

    it("retries only the failed detail and does not invent playable songs", async () => {
        const plugin = source({ getTopListDetail: jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ musicList: [] }) });
        await render(plugin);
        expect(result!.getPreview(sheets[0])?.state).toBe("error");
        await act(async () => {
            await result!.retryPreview(sheets[0]);
        });
        expect(result!.getPreview(sheets[0])).toEqual({ state: "ready", musicList: [], sheet: sheets[0] });
        expect(plugin.methods.getTopListDetail).toHaveBeenCalledTimes(3);
    });

    it("ignores stale source replies in the visible preview and restores its scoped cache", async () => {
        let resolveDetail: (value: any) => void = () => {};
        const first = source({ getTopListDetail: jest.fn(() => new Promise(resolve => {
            resolveDetail = resolve;
        })) });
        store.set(pluginsTopListAtom, { [first.hash]: { state: RequestStateCode.FINISHED, data: [{ title: "Charts", data: [sheets[0]] }] } });
        await render(first);
        const second = source({ getTopListDetail: jest.fn(async () => ({ musicList: [songs[7]] })) });
        act(() => renderer.update(React.createElement(Capture, { plugin: second })));
        await flush();
        await act(async () => {
            resolveDetail({ musicList: [songs[0]] });
        });
        expect(result!.getPreview(sheets[0])?.musicList).toEqual([songs[7]]);
        act(() => renderer.update(React.createElement(Capture, { plugin: first })));
        await flush();
        expect(result!.getPreview(sheets[0])?.musicList).toEqual([songs[0]]);
        expect(first.methods.getTopListDetail).toHaveBeenCalledTimes(1);
    });

    it("handles missing capabilities and removal without querying unsupported methods", async () => {
        const plugin = source(); plugin.supportedMethods.clear();
        await render(plugin);
        expect(result!.hasCatalog).toBe(false);
        expect(result!.charts).toEqual([]);
        expect(plugin.methods.getTopLists).not.toHaveBeenCalled();
        plugin.supportedMethods.add("getTopLists");
        const catalogOnly = { ...plugin } as Plugin;
        act(() => renderer.update(React.createElement(Capture, { plugin: catalogOnly })));
        await flush();
        expect(result!.charts).toHaveLength(6);
        expect(result!.hasDetails).toBe(false);
        expect(plugin.methods.getTopListDetail).not.toHaveBeenCalled();
        act(() => renderer.update(React.createElement(Capture, {})));
        expect(result!.charts).toEqual([]);
        expect(result!.loading).toBe(false);
    });

    it("does not publish component updates after unmount", async () => {
        let finish: (value: any) => void = () => {};
        const plugin = source({ getTopListDetail: jest.fn(() => new Promise(resolve => {
            finish = resolve;
        })) });
        store.set(pluginsTopListAtom, { [plugin.hash]: { state: RequestStateCode.FINISHED, data: [{ title: "Charts", data: [sheets[0]] }] } });
        await render(plugin);
        act(() => renderer.unmount());
        await act(async () => {
            finish({ musicList: songs });
        });
        expect(plugin.methods.getTopListDetail).toHaveBeenCalledTimes(1);
    });
});
