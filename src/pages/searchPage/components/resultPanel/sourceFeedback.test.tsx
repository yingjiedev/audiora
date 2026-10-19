/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { getDefaultStore } from "jotai";
import { Modal, StyleSheet, View } from "react-native";
import SourceFeedback, { SourceIssue } from "./sourceFeedback";
import ThemeText from "@/components/base/themeText";
import { PageAction } from "@/components/base/pageSection";
import { showPanel } from "@/components/panels/usePanel";
import PluginManager from "@/core/pluginManager";
import { RequestStateCode } from "@/constants/commonConst";
import { searchResultsAtom, searchSessionAtom } from "../../store/atoms";
import { lightColors } from "@/constants/colorPalette";
import { resolveThemeColors } from "@/utils/themeColors";

const mockSearch = jest.fn();
const mockNavigate = jest.fn();
let mockWindow = { width: 390, height: 844, scale: 1, fontScale: 1 };
let mockMeasure: ((callback: (...values: number[]) => void) => void) | undefined;
const mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
const issueActions = { search: mockSearch, onManage: () => mockNavigate("setting", { type: "plugin" }) };
const mockPlugins = Array.from({ length: 24 }, (_, i) => ({ hash: String(i), name: `Source ${i}`, instance: { platform: `Source ${i}`, userVariables: [{ key: "url" }] } }));
jest.mock("../../hooks/useSearch", () => () => mockSearch);
jest.mock("@/core/pluginManager", () => ({
    __esModule: true,
    default: { getByHash: hash => mockPlugins.find(plugin => plugin.hash === hash), getUserVariables: () => ({}), setUserVariables: jest.fn() },
    useSearchablePlugins: () => mockPlugins,
    usePluginDisplayNameResolver: () => plugin => plugin.name,
}));
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({ __esModule: true, default: () => mockWindow }));
jest.mock("react-native/Libraries/Components/View/View", () => {
    const R = require("react");
    return { __esModule: true, default: R.forwardRef((props, ref) => {
        R.useImperativeHandle(ref, () => ({ measureInWindow: callback => {
            if (props.collapsable === false && mockMeasure) mockMeasure(callback);
            else callback(props.collapsable === false ? 300 : 0, props.collapsable === false ? 100 : 0, 78, 44);
        } }));
        return R.createElement("SourceView", props, props.children);
    }) };
});
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }) }));
jest.mock("react-native/Libraries/Components/ScrollView/ScrollView", () => {
    const R = require("react");
    return { __esModule: true, default: props => R.createElement("ScrollView", props, props.children) };
});
jest.mock("@/components/base/pageSection", () => ({ PageAction: "PageAction" }));
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/core/router", () => ({ useNavigate: () => mockNavigate }));
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
    function renderStatus(results: Record<string, any>, plugins = mockPlugins) {
        act(() => {
            store.set(searchResultsAtom, { music: results, album: {}, artist: {}, sheet: {}, lyric: {} });
            renderer = TestRenderer.create(<SourceFeedback plugins={plugins} type="music" />);
        });
    }
    function openDetails() {
        act(() => renderer.root.findAll(node => typeof node.props.onPress === "function").find(node => node.props.accessibilityState?.expanded === false)!.props.onPress());
    }
    beforeEach(() => {
        jest.clearAllMocks();
        mockWindow = { width: 390, height: 844, scale: 1, fontScale: 1 };
        mockMeasure = undefined;
        store.set(searchSessionAtom, 1);
        store.set(searchResultsAtom, { music: {}, album: {}, artist: {}, sheet: {}, lyric: {} });
    });
    afterEach(() => act(() => renderer?.unmount()));
    it("shows only a count trigger and keeps all details and bulk retry in a native overlay", () => {
        const results = Object.fromEntries(mockPlugins.map((plugin, i) => [plugin.hash, i < 8 ? error : empty]));
        renderStatus(results);
        const text = renderer.root.findAllByType(ThemeText).map(node => node.props.children);
        expect(text.flat()).toEqual([16, "/", 24]);
        expect(renderer.root.findAllByType(PageAction)).toHaveLength(0);
        openDetails();
        expect(renderer.root.findByType(Modal).props).toMatchObject({ visible: true, transparent: true, animationType: "none" });
        const popup = renderer.root.findAllByType(View).find(node => node.props.accessibilityViewIsModal)!;
        expect(StyleSheet.flatten(popup.props.style).position).toBe("absolute");
        const popupText = popup.findAllByType(ThemeText).map(node => node.props.children);
        expect(popupText).toContain("aggregate.all");
        expect(popupText).not.toContainEqual(expect.stringContaining("aggregate.sourceSummary"));
        expect(popupText).not.toContain("aggregate.allSources");
        expect(popupText.filter(value => typeof value === "string" && value.startsWith("Source "))).toHaveLength(24);
        const retry = renderer.root.findAll(node => typeof node.props.onPress === "function").find(node => node.props.accessibilityLabel === "aggregate.retryIncomplete")!;
        expect(StyleSheet.flatten(retry.props.style({ pressed: false })).minHeight).toBeGreaterThanOrEqual(44);
        act(() => retry.props.onPress());
        expect(mockSearch).toHaveBeenCalledWith(undefined, undefined, "music", undefined, "retry");
    });
    it("counts successful empty responses, keeps waiting distinct and disables bulk retry during work", () => {
        const results = { "0": empty, "1": error, "2": { ...empty, state: RequestStateCode.PENDING_FIRST_PAGE, phase: "queued" } };
        renderStatus(results, mockPlugins.slice(0, 3));
        const trigger = renderer.root.findAll(node => typeof node.props.onPress === "function").find(node => node.props.accessibilityState?.expanded === false)!;
        expect(trigger.props.accessibilityLabel).toContain("aggregate.sourceSummary:{\"count\":1,\"total\":3}");
        expect(trigger.props.accessibilityLabel).toContain("aggregate.pendingWithIssues:{\"count\":1,\"failed\":1}");
        openDetails();
        const retry = renderer.root.findAll(node => typeof node.props.onPress === "function").find(node => node.props.accessibilityLabel === "aggregate.retryIncomplete")!;
        expect(retry.props.disabled).toBe(true);
        act(() => retry.props.onPress());
        expect(mockSearch).not.toHaveBeenCalled();
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
        renderStatus({ "0": error }, mockPlugins.slice(0, 1));
        openDetails();
        expect(renderer.root.findAllByType(ThemeText).map(node => node.props.children)).toContain("aggregate.error.network");
        act(() => store.set(searchResultsAtom, { music: { "0": empty as any }, album: {}, artist: {}, sheet: {}, lyric: {} }));
        expect(renderer.root.findAllByType(ThemeText).map(node => node.props.children)).toContain("aggregate.sourceEmpty");
        act(() => store.set(searchSessionAtom, 2));
        expect(renderer.root.findByType(Modal).props.visible).toBe(false);
    });
    it("keeps failure-first ordering stable across retries and drops stale plugin snapshots", () => {
        renderStatus({ "0": empty, "1": error }, mockPlugins.slice(0, 2));
        openDetails();
        const names = () => renderer.root.findAllByType(ThemeText).map(node => node.props.children).filter(value => typeof value === "string" && value.startsWith("Source "));
        expect(names()).toEqual(["Source 1", "Source 0"]);
        act(() => store.set(searchResultsAtom, { music: { "0": error as any, "1": empty as any }, album: {}, artist: {}, sheet: {}, lyric: {} }));
        expect(names()).toEqual(["Source 1", "Source 0"]);
        act(() => renderer.update(<SourceFeedback plugins={mockPlugins.slice(0, 1)} type="music" />));
        expect(renderer.root.findByType(Modal).props.visible).toBe(false);
    });
    it("closes on outside press and Android back without starting search or playback", () => {
        renderStatus({ "0": error }, mockPlugins.slice(0, 1));
        openDetails();
        act(() => renderer.root.findAll(node => typeof node.props.onPress === "function").find(node => node.props.accessibilityLabel === "common.cancel")!.props.onPress());
        expect(renderer.root.findByType(Modal).props.visible).toBe(false);
        openDetails();
        act(() => renderer.root.findByType(Modal).props.onRequestClose());
        expect(renderer.root.findByType(Modal).props.visible).toBe(false);
        expect(mockSearch).not.toHaveBeenCalled();
    });
    it("does not offer bulk retries for configuration-only issues", () => {
        renderStatus({ "0": { ...error, error: { kind: "configuration", retryable: false } } }, mockPlugins.slice(0, 1));
        openDetails();
        expect(renderer.root.findAll(node => typeof node.props.onPress === "function").find(node => node.props.accessibilityLabel === "aggregate.retryIncomplete")!.props.disabled).toBe(true);
        expect(button("aggregate.configureSource")).toBeDefined();
    });
    it("waits for native dismissal before presenting configuration and runs that action once", () => {
        renderStatus({ "0": { ...error, error: { kind: "configuration", retryable: false } } }, mockPlugins.slice(0, 1));
        openDetails();
        act(() => button("aggregate.configureSource").props.onPress());
        expect(renderer.root.findByType(Modal).props.visible).toBe(false);
        expect(showPanel).not.toHaveBeenCalled();
        act(() => renderer.root.findByType(Modal).props.onDismiss());
        act(() => renderer.root.findByType(Modal).props.onDismiss());
        expect(showPanel).toHaveBeenCalledTimes(1);
        expect(showPanel).toHaveBeenCalledWith("SetUserVariables", expect.objectContaining({ title: "Source 0" }));
    });
    it("rejects delayed measurements from an old query and closes stale geometry on rotation", () => {
        renderStatus({ "0": error }, mockPlugins.slice(0, 1));
        let measured!: (...values: number[]) => void;
        mockMeasure = callback => {
            measured = callback;
        };
        openDetails();
        act(() => store.set(searchSessionAtom, 2));
        act(() => measured(300, 100, 78, 44));
        expect(renderer.root.findByType(Modal).props.visible).toBe(false);
        mockMeasure = undefined;
        openDetails();
        expect(renderer.root.findByType(Modal).props.visible).toBe(true);
        mockWindow = { width: 844, height: 390, scale: 1, fontScale: 1 };
        act(() => renderer.update(<SourceFeedback plugins={mockPlugins.slice(0, 1)} type="music" />));
        expect(renderer.root.findByType(Modal).props.visible).toBe(false);
    });
});
