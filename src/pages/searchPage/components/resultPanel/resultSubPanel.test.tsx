import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { TabView } from "react-native-tab-view";
import ResultSubPanel from "./resultSubPanel";
import { MusicSelectionContext } from "@/components/musicList/selectionContext";

const mockPlugins = [
    { hash: "source-1", name: "Symbol source", displayName: "ʔ" },
    { hash: "source-2", name: "Original name", displayName: "My source" },
];
jest.mock("@/core/pluginManager", () => ({
    __esModule: true,
    default: { getSortedSearchablePlugins: () => mockPlugins },
    useSearchablePlugins: () => mockPlugins,
    usePluginDisplayNameResolver: () => (plugin: { displayName: string }) => plugin.displayName,
}));
jest.mock("react-native-tab-view", () => ({
    TabView: (props: { renderTabBar: () => React.ReactNode }) => props.renderTabBar(),
    SceneMap: jest.fn(),
}));
jest.mock("./resultWrapper", () => "MockResult");
jest.mock("./aggregateResults", () => "MockAggregate");
jest.mock("./sourceFeedback", () => "MockSourceFeedback");
jest.mock("./results", () => ({ renderMap: { music: true } }));
jest.mock("@/core/router", () => ({ useParams: () => ({}) }));
jest.mock("@/hooks/useColors", () => () => ({ primary: "blue", active: "navy", text: "black", textSecondary: "gray", onPrimary: "white" }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string, args?: { source: string }) => key === "searchPage.sourceTitle" ? "Sources" : `Source: ${args?.source}` }) }));
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("react-native/Libraries/Components/ScrollView/ScrollView", () => {
    const ReactModule = require("react");
    return { __esModule: true, default: (props: any) => ReactModule.createElement("ScrollView", props, props.children) };
});

describe("Search source selection", () => {
    it("finishes inline selection before changing source and disables swipe while editing", () => {
        const finish = jest.fn();
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<MusicSelectionContext.Provider value={{ scope: "aggregate", editor: { finish } as any }}>
                <ResultSubPanel tab="music" />
            </MusicSelectionContext.Provider>);
        });
        expect(renderer!.root.findByType(TabView).props.swipeEnabled).toBe(false);
        act(() => renderer!.root.findByType(TabView).props.onIndexChange(1));
        expect(finish).toHaveBeenCalledTimes(1);
        expect(renderer!.root.findByType(TabView).props.navigationState.index).toBe(1);
        act(() => renderer!.unmount());
    });
    it("labels symbolic and renamed sources without changing identity or navigation", () => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<ResultSubPanel tab="music" />);
        });
        const findTab = (label: string) => renderer!.root.findAllByProps({ accessibilityLabel: label }).find(node => typeof node.props.onPress === "function")!;
        const tabs = [findTab("Source: ʔ"), findTab("Source: My source")];
        expect(renderer!.root.findAllByType("ThemeText" as any).map(node => node.props.children)).not.toContain("Sources");
        expect(renderer!.root.findAllByType("MockSourceFeedback" as any)).toHaveLength(1);
        expect(tabs.map(tab => tab.findByType("ThemeText" as any).props.children)).toEqual(["ʔ", "My source"]);
        expect(tabs.map(tab => tab.props.accessibilityLabel)).toEqual(["Source: ʔ", "Source: My source"]);
        expect(renderer!.root.findByType(TabView).props.navigationState.routes.map((route: { key: string }) => route.key)).toEqual(["aggregate-all", "source-1", "source-2"]);
        act(() => tabs[1].props.onPress());
        expect(renderer!.root.findByType(TabView).props.navigationState.index).toBe(2);
        expect(findTab("Source: My source").props.accessibilityState.selected).toBe(true);
        act(() => renderer!.unmount());
    });
});
