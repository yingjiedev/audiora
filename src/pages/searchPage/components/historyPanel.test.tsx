import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Keyboard, ScrollView, StyleSheet } from "react-native";
import HistoryPanel from "./historyPanel";
import { addHistory, getHistory, removeAllHistory, removeHistory } from "../common/historySearch";
import { showDialog } from "@/components/dialogs/useDialog";
import { getDefaultStore } from "jotai";
import { PageStatus, pageStatusAtom, queryAtom } from "../store/atoms";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { resolveThemeColors } from "@/utils/themeColors";
import { blendOver, contrastRatio } from "@/utils/colorContrast";

let mockHistory: string[] = [];
let mockRecent: Array<{ title: string; artist: string }> = [];
let mockFavorites: Array<{ title: string; artist: string }> = [];
let mockDimensions = { width: 412, height: 892, scale: 3, fontScale: 1 };
let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
const mockSearch = jest.fn();
jest.mock("../common/historySearch", () => ({
    getHistory: jest.fn(async () => mockHistory),
    removeAllHistory: jest.fn(async () => {}),
    addHistory: jest.fn(),
    removeHistory: jest.fn(),
}));
jest.mock("../hooks/useSearch", () => () => mockSearch);
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({ __esModule: true, default: () => mockDimensions }));
jest.mock("@/core/musicHistory", () => ({ useMusicHistory: () => mockRecent }));
jest.mock("@/core/musicSheet", () => ({ __esModule: true, default: { defaultSheet: { id: "favorite" } }, useSheetItem: () => ({ musicList: mockFavorites }) }));
jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: jest.fn() }));
jest.mock("@/components/base/loading", () => "MockLoading");
jest.mock("@/components/base/icon", () => "MockIcon");
jest.mock("@/components/base/themeText", () => "MockText");
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string, args?: { query: string }) => args ? `${key}:${args.query}` : key }) }));

describe("search landing history and discovery", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    const buttons = () => renderer.root.findAll(node => node.props.accessibilityRole === "button" && typeof node.props.style === "function");
    const button = (label: string) => buttons().find(node => node.props.accessibilityLabel === label)!;
    const texts = () => renderer.root.findAllByType("MockText" as any).map(node => node.props.children);
    const render = () => act(async () => {
        renderer = TestRenderer.create(<HistoryPanel />);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockHistory = ["Song", "Another song"];
        mockRecent = [{ title: "Recent song", artist: "Recent artist" }];
        mockFavorites = [{ title: "Favorite song", artist: "Favorite artist" }];
        mockDimensions = { width: 412, height: 892, scale: 3, fontScale: 1 };
        mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
        (getHistory as jest.Mock).mockImplementation(async () => mockHistory);
        (addHistory as jest.Mock).mockResolvedValue(undefined);
        (removeHistory as jest.Mock).mockResolvedValue(undefined);
        (removeAllHistory as jest.Mock).mockResolvedValue(undefined);
        jest.spyOn(Keyboard, "dismiss").mockImplementation(() => {});
    });
    afterEach(() => {
        if (renderer) act(() => renderer.unmount());
        jest.restoreAllMocks();
    });

    it("keeps history tags light and searchable with one tap while the keyboard is open", async () => {
        await render();
        expect(renderer.root.findByType(ScrollView).props.keyboardShouldPersistTaps).toBe("handled");
        expect(renderer.root.findAllByType("MockIcon" as any).some(node => node.props.name === "x-mark")).toBe(false);
        expect(texts()).toContain("searchPage.discovery");
        (addHistory as jest.Mock).mockRejectedValueOnce(new Error("storage unavailable"));
        act(() => button("Song").props.onPress());
        expect(mockSearch).toHaveBeenCalledWith("Song", 1);
        expect(addHistory).toHaveBeenCalledWith("Song");
        expect(Keyboard.dismiss).toHaveBeenCalled();
        expect(getDefaultStore().get(queryAtom)).toBe("Song");
        expect(getDefaultStore().get(pageStatusAtom)).toBe(PageStatus.SEARCHING);
    });

    it("supports managing and removing individual entries without starting a search", async () => {
        await render();
        act(() => button("searchPage.manageHistory").props.onPress());
        await act(async () => {
            await button("searchPage.removeHistory:Song").props.onPress();
        });
        expect(removeHistory).toHaveBeenCalledWith("Song");
        expect(button("searchPage.removeHistory:Song")).toBeUndefined();
        expect(button("searchPage.removeHistory:Another song")).toBeDefined();
        expect(mockSearch).not.toHaveBeenCalled();
        act(() => button("common.done").props.onPress());
        expect(button("Another song")).toBeDefined();
    });

    it("confirms clear and keeps discovery visible after all history is removed", async () => {
        await render();
        act(() => button("searchPage.manageHistory").props.onPress());
        act(() => button("common.clear").props.onPress());
        expect(removeAllHistory).not.toHaveBeenCalled();
        expect(showDialog).toHaveBeenCalledWith("SimpleDialog", expect.objectContaining({ content: "searchPage.clearHistoryConfirm" }));
        await act(async () => {
            await (showDialog as jest.Mock).mock.calls[0][1].onOk();
        });
        expect(removeAllHistory).toHaveBeenCalledTimes(1);
        expect(texts()).toContain("searchPage.historyEmpty");
        expect(texts()).toContain("Recent song");
        expect(button("searchPage.manageHistory")).toBeUndefined();
    });

    it("retains entries after storage failures and prevents duplicate pending deletions", async () => {
        await render();
        act(() => button("searchPage.manageHistory").props.onPress());
        let fail: (error: Error) => void;
        (removeHistory as jest.Mock).mockImplementationOnce(() => new Promise((_, reject) => {
            fail = reject;
        }));
        let request: Promise<void>;
        act(() => {
            const remove = button("searchPage.removeHistory:Song").props.onPress;
            request = remove();
            remove();
        });
        expect(removeHistory).toHaveBeenCalledTimes(1);
        expect(button("common.done").props.disabled).toBe(true);
        await act(async () => {
            fail!(new Error("storage unavailable"));
            await request!;
        });
        expect(texts()).toContain("searchPage.historyError");
        expect(button("searchPage.removeHistory:Song")).toBeDefined();
        await act(async () => {
            await button("searchPage.removeHistory:Song").props.onPress();
        });
        expect(button("searchPage.removeHistory:Song")).toBeUndefined();
    });

    it("retries failed history reads without blocking discovery", async () => {
        (getHistory as jest.Mock).mockRejectedValueOnce(new Error("read unavailable"));
        await render();
        expect(texts()).toContain("searchPage.historyError");
        expect(texts()).toContain("Favorite song");
        await act(async () => {
            await button("searchPage.retryHistory").props.onPress();
        });
        expect(button("Song")).toBeDefined();
    });

    it("cycles suggestions and searches their exact keyword", async () => {
        mockRecent = Array.from({ length: 6 }, (_, index) => ({ title: `Song ${index}`, artist: `Artist ${index}` }));
        await render();
        expect(texts()).toContain("Song 0");
        act(() => button("searchPage.refreshDiscovery").props.onPress());
        expect(texts()).not.toContain("Song 0");
        const suggestion = buttons().find(node => node.props.accessibilityLabel?.startsWith("Song 3，"))!;
        act(() => suggestion.props.onPress());
        expect(mockSearch).toHaveBeenCalledWith("Song 3", 1);
    });

    it.each([{ width: 320, fontScale: 1 }, { width: 412, fontScale: 1.5 }])("uses a single column for narrow screens or larger text: %j", async dimensions => {
        mockDimensions = { ...mockDimensions, ...dimensions };
        await render();
        const suggestion = buttons().find(node => node.props.accessibilityLabel?.startsWith("Recent song，"))!;
        const style = StyleSheet.flatten(suggestion.props.style({ pressed: false }));
        expect(style.width).toBe("100%");
        expect(style.minHeight).toBeGreaterThanOrEqual(44);
    });

    it("shows inline empty hints for a new listener without fabricated trends", async () => {
        mockHistory = [];
        mockRecent = [];
        mockFavorites = [];
        await render();
        expect(texts()).toContain("searchPage.historyEmpty");
        expect(texts()).toContain("searchPage.discoveryEmpty");
        expect(buttons()).toHaveLength(0);
    });

    it.each([lightColors, darkColors, { ...lightColors, primary: "#824717", card: "rgba(254,241,218,0.8)", text: "#432718" }])("keeps tag and caption colors legible on the active theme", async preset => {
        mockColors = resolveThemeColors({ ...preset, background: preset.pageBackground }, preset === darkColors);
        await render();
        const tagStyle = StyleSheet.flatten(button("Song").findByProps({ pointerEvents: "none" }).props.style);
        expect(tagStyle.backgroundColor).toBe(mockColors.card);
        expect(tagStyle.borderWidth).toBeUndefined();
        const page = blendOver(mockColors.pageBackground!, preset === darkColors ? darkColors.pageBackground : lightColors.pageBackground);
        const card = blendOver(tagStyle.backgroundColor, page);
        expect(contrastRatio(blendOver(mockColors.text, card), card)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(blendOver(mockColors.textSecondary, page), page)).toBeGreaterThanOrEqual(4.5);
    });
});
