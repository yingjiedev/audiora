import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { getDefaultStore } from "jotai";
import { RequestStateCode } from "@/constants/commonConst";
import { pluginsTopListAtom } from "@/pages/topList/store/atoms";
import type { Plugin } from "@/core/pluginManager";
import type { DiscoveryMusic } from "../common/searchDiscovery";
import { loadChartDiscovery } from "../common/topListDiscovery";
import useDiscoveryCharts from "./useDiscoveryCharts";

let mockSourceHash: string | undefined;
let mockPlugins: Plugin[] = [];
let mockDisabled = new Set<string>();
jest.mock("@/core/pluginManager", () => ({
    __esModule: true,
    default: { isPluginEnabled: (plugin: Plugin) => !mockDisabled.has(plugin.hash) },
    useSortedPlugins: () => mockPlugins,
}));
jest.mock("@/core/router", () => ({ useParams: () => ({ pluginHash: mockSourceHash }) }));
jest.mock("../common/topListDiscovery", () => ({ loadChartDiscovery: jest.fn() }));
jest.mock("@/constants/commonConst", () => ({ RequestStateCode: { FINISHED: 2 } }));

const plugin = (hash: string, methods = ["search", "getTopLists", "getTopListDetail"]) => ({ hash, supportedMethods: new Set(methods) }) as Plugin;

describe("search chart source scope", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    let current: DiscoveryMusic[];
    function Harness() {
        current = useDiscoveryCharts();
        return null;
    }
    beforeEach(() => {
        jest.clearAllMocks();
        mockSourceHash = undefined;
        mockDisabled = new Set();
        mockPlugins = [plugin("one"), plugin("two"), plugin("three")];
        getDefaultStore().set(pluginsTopListAtom, {});
        (loadChartDiscovery as jest.Mock).mockResolvedValue([]);
    });
    afterEach(() => {
        act(() => renderer.unmount());
    });

    it("only loads enabled, searchable sources with both chart methods and reuses known groups", async () => {
        mockDisabled.add("one");
        mockPlugins = [mockPlugins[0], plugin("missing-detail", ["search", "getTopLists"]), plugin("no-search", ["getTopLists", "getTopListDetail"]), mockPlugins[1], mockPlugins[2]];
        const groups = [{ title: "Cached", data: [] }];
        getDefaultStore().set(pluginsTopListAtom, { two: { state: RequestStateCode.FINISHED, data: groups } });
        await act(async () => {
            renderer = TestRenderer.create(<Harness />);
        });
        expect(loadChartDiscovery).toHaveBeenCalledWith([mockPlugins[3], mockPlugins[4]], { two: groups });
    });

    it("keeps a source-specific search within that source and does not fall back if it is missing", async () => {
        mockSourceHash = "two";
        await act(async () => {
            renderer = TestRenderer.create(<Harness />);
        });
        expect(loadChartDiscovery).toHaveBeenLastCalledWith([mockPlugins[1]], {});
        mockSourceHash = "missing";
        await act(async () => {
            renderer.update(<Harness />);
        });
        expect(loadChartDiscovery).toHaveBeenLastCalledWith([], {});
    });

    it("hides the old source immediately and ignores its late result", async () => {
        let resolveOld: (value: DiscoveryMusic[]) => void;
        (loadChartDiscovery as jest.Mock).mockImplementationOnce(() => new Promise(resolve => {
            resolveOld = resolve;
        }));
        mockSourceHash = "one";
        await act(async () => {
            renderer = TestRenderer.create(<Harness />);
        });
        mockSourceHash = "two";
        (loadChartDiscovery as jest.Mock).mockResolvedValueOnce([{ title: "New", artist: "Artist" }]);
        await act(async () => {
            renderer.update(<Harness />);
        });
        expect(current!).toEqual([{ title: "New", artist: "Artist" }]);
        await act(async () => {
 resolveOld!([{ title: "Old", artist: "Artist" }]);
        });
        expect(current!).toEqual([{ title: "New", artist: "Artist" }]);
    });

    it("falls back to no chart entries if loading fails", async () => {
        (loadChartDiscovery as jest.Mock).mockRejectedValueOnce(new Error("offline"));
        await act(async () => {
            renderer = TestRenderer.create(<Harness />);
        });
        expect(current!).toEqual([]);
    });
});
