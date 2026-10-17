/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { getDefaultStore } from "jotai";
import SourceFeedback, { SourceIssue } from "./sourceFeedback";
import ThemeText from "@/components/base/themeText";
import { PageAction } from "@/components/base/pageSection";
import { showDialog, hideDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import PluginManager from "@/core/pluginManager";
import { RequestStateCode } from "@/constants/commonConst";
import { searchResultsAtom, searchSessionAtom } from "../../store/atoms";

const mockSearch = jest.fn();
const mockNavigate = jest.fn();
let mockRouteAvailable = true;
const issueActions = { search: mockSearch, onManage: () => mockNavigate("setting", { type: "plugin" }) };
const mockPlugins = Array.from({ length: 24 }, (_, i) => ({ hash: String(i), name: `Source ${i}`, instance: { platform: `Source ${i}`, userVariables: [{ key: "url" }] } }));
jest.mock("../../hooks/useSearch", () => () => {
    if (!mockRouteAvailable) throw new Error("No screen route in a global dialog");
    return mockSearch;
});
jest.mock("@/core/pluginManager", () => ({
    __esModule: true,
    default: { getByHash: hash => mockPlugins.find(plugin => plugin.hash === hash), getUserVariables: () => ({}), setUserVariables: jest.fn() },
    useSearchablePlugins: () => mockPlugins,
    usePluginDisplayNameResolver: () => plugin => plugin.name,
}));
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/pageSection", () => ({ PageAction: "PageAction" }));
jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: jest.fn(), hideDialog: jest.fn() }));
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/core/router", () => ({ useNavigate: () => {
    if (!mockRouteAvailable) throw new Error("No screen navigation in a global dialog");
    return mockNavigate;
} }));
jest.mock("@/utils/motion", () => ({ motionDuration: () => 0, motionEasing: {} }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key, args) => args ? `${key}:${JSON.stringify(args)}` : key }) }));

describe("source feedback", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    const store = getDefaultStore();
    const empty = { state: RequestStateCode.FINISHED, data: [], phase: "finished" } as const;
    const error = { state: RequestStateCode.ERROR, data: [], phase: "error", error: { kind: "network", retryable: true } } as const;
    function button(title: string) {
        return renderer.root.findAllByType(PageAction).find(node => node.props.title === title)!;
    }
    beforeEach(() => {
        jest.clearAllMocks();
        mockRouteAvailable = true;
        store.set(searchSessionAtom, 1);
        store.set(searchResultsAtom, { music: {}, album: {}, artist: {}, sheet: {}, lyric: {} });
    });
    afterEach(() => act(() => renderer?.unmount()));
    it("keeps eight source failures out of the song list header and bulk retries only on demand", () => {
        const results = Object.fromEntries(mockPlugins.map((plugin, i) => [plugin.hash, i < 8 ? error : empty]));
        act(() => {
            renderer = TestRenderer.create(<SourceFeedback plugins={mockPlugins} results={results as any} type="music" session={1} />);
        });
        const text = renderer.root.findAllByType(ThemeText).map(node => node.props.children);
        expect(text).toContain("aggregate.sourceSummary:{\"count\":16,\"total\":24}");
        expect(text).toContain("aggregate.issueCount:{\"count\":8}");
        expect(text.some(value => value.includes("Source "))).toBe(false);
        expect(renderer.root.findAllByType(PageAction)).toHaveLength(2);
        act(() => button("aggregate.retryIncomplete").props.onPress());
        expect(mockSearch).toHaveBeenCalledWith(undefined, undefined, "music", undefined, "retry");
        act(() => button("aggregate.sourceDetails").props.onPress());
        expect(showDialog).toHaveBeenCalledWith("SimpleDialog", expect.objectContaining({ title: "aggregate.sourceDetails" }));
    });
    it("counts successful empty responses, keeps waiting distinct and disables bulk retry during work", () => {
        const results = { "0": empty, "1": error, "2": { ...empty, state: RequestStateCode.PENDING_FIRST_PAGE, phase: "queued" } };
        act(() => {
            renderer = TestRenderer.create(<SourceFeedback plugins={mockPlugins.slice(0, 3)} results={results as any} type="music" session={1} />);
        });
        expect(renderer.root.findAllByType(ThemeText).map(node => node.props.children)).toEqual([
            "aggregate.sourceSummary:{\"count\":1,\"total\":3}", "aggregate.pendingWithIssues:{\"count\":1,\"failed\":1}",
        ]);
        expect(button("aggregate.retryIncomplete").props.disabled).toBe(true);
    });
    it("offers continuation for a source never searched without reporting a network failure", () => {
        act(() => {
            renderer = TestRenderer.create(<SourceIssue {...issueActions} pluginHash="0" result={{ ...error, phase: "deferred", error: undefined } as any} type="music" />);
        });
        expect(renderer.root.findByType(ThemeText).props.children).toBe("aggregate.sourceDeferred");
        act(() => button("aggregate.continueSource").props.onPress());
        expect(mockSearch).toHaveBeenCalledWith(undefined, undefined, "music", "0", "retry");
    });
    it("opens required source settings and searches that source after saving", () => {
        act(() => {
            renderer = TestRenderer.create(<SourceIssue {...issueActions} pluginHash="0" result={{ ...error, error: { kind: "configuration", retryable: false } } as any} type="music" />);
        });
        expect(button("aggregate.retry")).toBeUndefined();
        act(() => button("aggregate.configureSource").props.onPress());
        const payload = (showPanel as jest.Mock).mock.calls[0][1];
        const close = jest.fn();
        act(() => payload.onOk({ url: "https://example.test" }, close));
        expect(PluginManager.setUserVariables).toHaveBeenCalledWith(mockPlugins[0], { url: "https://example.test" });
        expect(close).toHaveBeenCalledTimes(1);
        expect(mockSearch).toHaveBeenCalledWith(undefined, undefined, "music", "0", "retry");
    });
    it("routes permanent interface failures to plugin management instead of blind retries", () => {
        act(() => {
            renderer = TestRenderer.create(<SourceIssue {...issueActions} pluginHash="0" result={{ ...error, error: { kind: "unavailable", status: 404, retryable: false } } as any} type="music" />);
        });
        expect(button("aggregate.retry")).toBeUndefined();
        act(() => button("aggregate.manageSources").props.onPress());
        expect(mockNavigate).toHaveBeenCalledWith("setting", { type: "plugin" });
        expect(mockSearch).not.toHaveBeenCalled();
    });
    it("updates open source details live and closes them when the query session changes", () => {
        act(() => {
            renderer = TestRenderer.create(<SourceFeedback plugins={mockPlugins.slice(0, 1)} results={{ "0": error } as any} type="music" session={1} />);
        });
        act(() => button("aggregate.sourceDetails").props.onPress());
        const content = (showDialog as jest.Mock).mock.calls[0][1].content;
        mockRouteAvailable = false;
        act(() => {
            store.set(searchResultsAtom, { music: { "0": error as any }, album: {}, artist: {}, sheet: {}, lyric: {} });
            renderer.update(content);
        });
        expect(renderer.root.findAllByType(ThemeText).map(node => node.props.children)).toContain("aggregate.error.network");
        act(() => store.set(searchResultsAtom, { music: { "0": empty as any }, album: {}, artist: {}, sheet: {}, lyric: {} }));
        expect(renderer.root.findAllByType(ThemeText).map(node => node.props.children)).toContain("aggregate.sourceEmpty");
        act(() => store.set(searchSessionAtom, 2));
        expect(hideDialog).toHaveBeenCalledTimes(1);
    });
});
