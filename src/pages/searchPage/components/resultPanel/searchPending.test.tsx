import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { ActivityIndicator } from "react-native";
import SearchPending from "./searchPending";
import ThemeText from "@/components/base/themeText";

let mockReducedMotion = false;
jest.mock("@/hooks/useMotion", () => () => ({ reduceMotion: mockReducedMotion }));
jest.mock("@/hooks/useColors", () => () => ({ primaryText: "primary" }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: key => key }) }));
jest.mock("@/components/base/themeText", () => "ThemeText");

describe("search waiting feedback", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    beforeEach(() => {
        jest.useFakeTimers(); mockReducedMotion = false;
    });
    afterEach(() => {
        act(() => renderer?.unmount());
        expect(jest.getTimerCount()).toBe(0);
        jest.useRealTimers();
    });
    function render(active = true, hasResults = false, session = 1) {
        act(() => {
            renderer = TestRenderer.create(<SearchPending active={active} hasResults={hasResults} session={session} />);
        });
    }
    it("avoids flashing for quick requests and stops all animation on completion", () => {
        render();
        expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(0);
        act(() => renderer.update(<SearchPending active={false} hasResults={false} session={1} />));
        act(() => jest.advanceTimersByTime(5000));
        expect(renderer.toJSON()).toBeNull();
    });
    it("shows native progress after a short delay and offers a truthful slow-source hint", () => {
        render(true, true);
        act(() => jest.advanceTimersByTime(200));
        expect(renderer.root.findAllByType(ActivityIndicator).length).toBeGreaterThan(0);
        expect(renderer.root.findByType(ThemeText).props.children).toBe("aggregate.searchingMore");
        act(() => jest.advanceTimersByTime(3800));
        expect(renderer.root.findByType(ThemeText).props.children).toBe("aggregate.slowSources");
    });
    it("keeps text feedback without animation when reduced motion is enabled", () => {
        mockReducedMotion = true; render();
        act(() => jest.advanceTimersByTime(200));
        expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(0);
        expect(renderer.root.findByType(ThemeText).props.children).toBe("aggregate.searching");
    });
    it("resets the slow hint and timers for the next query", () => {
        render(); act(() => jest.advanceTimersByTime(4000));
        act(() => renderer.update(<SearchPending active hasResults={false} session={2} />));
        expect(renderer.root.findAllByType(ThemeText)).toHaveLength(0);
        act(() => jest.advanceTimersByTime(200));
        expect(renderer.root.findByType(ThemeText).props.children).toBe("aggregate.searching");
    });
});
