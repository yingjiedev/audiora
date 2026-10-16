import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Keyboard } from "react-native";
import { getDefaultStore } from "jotai";
import { addHistory } from "../common/historySearch";
import { PageStatus, pageStatusAtom, queryAtom } from "../store/atoms";
import NavBar from "./navBar";

const mockSearch = jest.fn(async () => {});
jest.mock("../hooks/useSearch", () => () => mockSearch);
jest.mock("../common/historySearch", () => ({ addHistory: jest.fn(async () => {}) }));
jest.mock("@/core/router", () => ({ useParams: () => ({ pluginHash: "source-a" }) }));
jest.mock("@/core/pluginManager", () => ({
    __esModule: true,
    default: { getByHash: () => ({ hash: "source-a" }) },
    usePluginDisplayNameResolver: () => () => "My source alias",
}));
jest.mock("@/hooks/useColors", () => () => ({ appBarText: "navy" }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string, args?: { name: string }) => args ? `${key}:${args.name}` : key }) }));
jest.mock("@/components/base/appBar", () => "MockAppBar");
jest.mock("@/components/base/searchField", () => "MockSearchField");
jest.mock("@/components/base/pageSection", () => ({ PageAction: "MockAction" }));

describe("search submission from the navigation bar", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    beforeEach(() => {
        jest.clearAllMocks();
        getDefaultStore().set(queryAtom, "  A song  ");
        getDefaultStore().set(pageStatusAtom, PageStatus.EDITING);
        jest.spyOn(Keyboard, "dismiss").mockImplementation(() => {});
        (addHistory as jest.Mock).mockResolvedValue(undefined);
    });
    afterEach(() => {
        act(() => renderer.unmount());
        jest.restoreAllMocks();
    });

    it.each(["button", "keyboard"])("trims and submits from %s while dismissing the keyboard", async trigger => {
        act(() => {
            renderer = TestRenderer.create(<NavBar />);
        });
        const action = renderer.root.findByType("MockAppBar" as any).props.actionComponent.props;
        const field = renderer.root.findByType("MockSearchField" as any);
        expect(action.variant).toBe("text");
        expect(action.textColor).toBe("navy");
        expect(field.props.placeholder).toBe("musicLibrary.searchSourcePlaceholder:My source alias");
        await act(async () => {
            await (trigger === "button" ? action.onPress : field.props.onSubmitEditing)();
        });
        expect(mockSearch).toHaveBeenCalledWith("A song", 1);
        expect(addHistory).toHaveBeenCalledWith("A song");
        expect(getDefaultStore().get(queryAtom)).toBe("A song");
        expect(getDefaultStore().get(pageStatusAtom)).toBe(PageStatus.SEARCHING);
        expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    });

    it("ignores blank submissions and preserves search even if history cannot be written", async () => {
        getDefaultStore().set(queryAtom, "   ");
        act(() => {
            renderer = TestRenderer.create(<NavBar />);
        });
        expect(renderer.root.findByType("MockAppBar" as any).props.actionComponent.props.disabled).toBe(true);
        await act(async () => {
            await renderer.root.findByType("MockSearchField" as any).props.onSubmitEditing();
        });
        expect(mockSearch).not.toHaveBeenCalled();
        act(() => getDefaultStore().set(queryAtom, "Song"));
        (addHistory as jest.Mock).mockRejectedValueOnce(new Error("storage unavailable"));
        await act(async () => {
            await renderer.root.findByType("MockSearchField" as any).props.onSubmitEditing();
        });
        expect(mockSearch).toHaveBeenCalledWith("Song", 1);
    });
});
