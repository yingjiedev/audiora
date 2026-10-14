import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { ScrollView, StyleSheet, View } from "react-native";
import HistoryPanel from "./historyPanel";

let mockHistory: string[] = [];
const mockSearch = jest.fn();
jest.mock("../common/historySearch", () => ({
    getHistory: async () => mockHistory,
    removeAllHistory: async () => {
        mockHistory = [];
    },
    addHistory: jest.fn(),
    removeHistory: jest.fn(),
}));
jest.mock("../hooks/useSearch", () => () => mockSearch);
jest.mock("jotai", () => ({ ...jest.requireActual("jotai"), useSetAtom: () => jest.fn() }));
jest.mock("@/components/base/chip", () => "MockChip");
jest.mock("@/components/base/textButton", () => "MockButton");
jest.mock("@/components/base/loading", () => "MockLoading");
jest.mock("@/components/base/icon", () => "MockIcon");
jest.mock("@/components/base/themeText", () => "MockText");
jest.mock("@/hooks/useColors", () => () => ({ tonalSurface: "white", onTonal: "navy" }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));

describe("Search history layout and actions", () => {
    it("centers an empty history across the remaining area and hides clear", async () => {
        mockHistory = [];
        let renderer: TestRenderer.ReactTestRenderer;
        await act(async () => {
            renderer = TestRenderer.create(<HistoryPanel />);
        });
        const contentStyle = StyleSheet.flatten(renderer!.root.findByType(ScrollView).props.contentContainerStyle);
        expect(contentStyle).toMatchObject({ flexGrow: 1, justifyContent: "center", alignItems: "center" });
        expect(contentStyle.flexDirection).not.toBe("row");
        expect(renderer!.root.findAllByType("MockButton" as any)).toHaveLength(0);
        const emptyState = renderer!.root.findAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.minHeight);
        expect(StyleSheet.flatten(emptyState!.props.style).width).toBe("100%");
        act(() => renderer!.unmount());
    });

    it("keeps history chips searchable and switches to the centered state after clearing", async () => {
        mockHistory = ["Song", "Another song"];
        let renderer: TestRenderer.ReactTestRenderer;
        await act(async () => {
            renderer = TestRenderer.create(<HistoryPanel />);
        });
        const chips = renderer!.root.findAllByType("MockChip" as any);
        expect(chips).toHaveLength(2);
        act(() => chips[0].props.onPress());
        expect(mockSearch).toHaveBeenCalledWith("Song", 1);
        await act(async () => {
            await renderer!.root.findByType("MockButton" as any).props.onPress();
        });
        expect(renderer!.root.findAllByType("MockChip" as any)).toHaveLength(0);
        expect(StyleSheet.flatten(renderer!.root.findByType(ScrollView).props.contentContainerStyle).flexGrow).toBe(1);
        act(() => renderer!.unmount());
    });
});
