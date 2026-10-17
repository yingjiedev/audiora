import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";
import TrackGroupSources from "./trackGroupSources";
import { hidePanel } from "../usePanel";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import { PageAction } from "@/components/base/pageSection";
import { groupTracks, trackSourceKey } from "@/utils/trackGroup";
import { lightColors, darkColors } from "@/constants/colorPalette";
import { resolveThemeColors } from "@/utils/themeColors";
import { contrastRatio } from "@/utils/colorContrast";
import Toast from "@/utils/toast";

let mockCurrent: IMusic.IMusicItem | null = null;
let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("@/core/trackPlayer", () => ({ useCurrentMusic: () => mockCurrent }));
jest.mock("@/core/pluginManager", () => ({ usePluginDisplayNameResolver: () => (name: string) => name }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("../base/panelBase", () => ({ renderBody }: { renderBody: () => React.ReactNode }) => renderBody());
jest.mock("../usePanel", () => ({ hidePanel: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 12 }) }));
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/pageSection", () => ({ PageAction: "PageAction" }));
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { warn: jest.fn() } }));

const a = { id: "one", platform: "A", title: "Song", artist: "Artist", duration: 180, album: "Album" } as IMusic.IMusicItem;
const b = { ...a, id: "two", platform: "B" };
const group = groupTracks([a, b])[0];

describe("aggregate source picker", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    const onSelect = jest.fn();
    function render(props: Partial<React.ComponentProps<typeof TrackGroupSources>> = {}) {
        act(() => {
            renderer = TestRenderer.create(<TrackGroupSources group={group} selected={a} onSelect={onSelect} {...props} />);
        });
    }
    const choices = () => renderer.root.findAllByProps({ accessibilityRole: "radio" }).filter(node => typeof node.props.onPress === "function");
    beforeEach(() => {
        jest.clearAllMocks(); mockCurrent = null;
        mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
    });
    afterEach(() => act(() => renderer?.unmount()));

    it("distinguishes the selected candidate from live playback and commits one selection", () => {
        mockCurrent = b;
        render();
        expect(choices().map(node => node.props.accessibilityState.checked)).toEqual([true, false]);
        expect(choices()[1].props.accessibilityLabel).toContain("aggregate.sourcePlaying");
        expect(choices()[0].props.accessibilityLabel).toContain("aggregate.sourceSelected");
        expect(choices()[0].props.accessibilityLabel).not.toContain("aggregate.sourcePlaying");
        expect(renderer.root.findAllByType(Icon).filter(node => node.props.name === "check-circle")).toHaveLength(1);
        act(() => {
            choices()[1].props.onPress(); choices()[1].props.onPress();
        });
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith(trackSourceKey(b));
        expect(hidePanel).toHaveBeenCalledTimes(1);
    });
    it("does not identify a different song as playing and follows player changes while open", () => {
        mockCurrent = { ...b, id: "unrelated" };
        render();
        expect(renderer.root.findAllByType(ThemeText).some(node => node.props.children === "aggregate.sourcePlaying")).toBe(false);
        mockCurrent = a;
        act(() => renderer.update(<TrackGroupSources group={group} selected={a} onSelect={onSelect} />));
        expect(choices()[0].props.accessibilityLabel).toContain("aggregate.sourcePlaying");
    });
    it("preserves group splitting and source-specific removal without selecting or playing", async () => {
        const actions = { link: jest.fn(), split: jest.fn(), removeSource: jest.fn(async () => {}), prefer: jest.fn(async () => {}) };
        const saved = { ...group, groupId: "saved" };
        render({ group: saved, selected: b, favoriteActions: actions });
        const remove = renderer.root.findAllByType(PageAction).find(node => node.props.title === "aggregate.removeSource")!;
        await act(async () => remove.props.onPress());
        expect(actions.removeSource).toHaveBeenCalledWith(b);
        expect(onSelect).not.toHaveBeenCalled();
        act(() => renderer.unmount());
        render({ group: saved, selected: b, favoriteActions: actions });
        act(() => renderer.root.findAllByType(PageAction).find(node => node.props.title === "aggregate.splitFavorites")!.props.onPress());
        expect(actions.split).toHaveBeenCalledWith(saved);
        expect(actions.link).not.toHaveBeenCalled();
    });
    it("keeps linking available for a suggested favorite group", () => {
        const actions = { link: jest.fn(), split: jest.fn(), removeSource: jest.fn(async () => {}), prefer: jest.fn(async () => {}) };
        render({ favoriteActions: actions });
        act(() => renderer.root.findByType(PageAction).props.onPress());
        expect(actions.link).toHaveBeenCalledWith(group, a);
        expect(hidePanel).toHaveBeenCalledTimes(1);
    });
    it("blocks repeat removal and competing choices, then recovers if saving fails", async () => {
        let reject!: (error: Error) => void;
        const actions = { link: jest.fn(), split: jest.fn(), prefer: jest.fn(async () => {}),
            removeSource: jest.fn(() => new Promise<void>((_, rejectPromise) => {
                reject = rejectPromise;
            })),
        };
        render({ group: { ...group, groupId: "saved" }, favoriteActions: actions });
        const remove = renderer.root.findAllByType(PageAction).find(node => node.props.title === "aggregate.removeSource")!;
        let operation!: Promise<void>;
        act(() => {
            operation = remove.props.onPress(); remove.props.onPress();
        });
        act(() => choices()[1].props.onPress());
        expect(actions.removeSource).toHaveBeenCalledTimes(1);
        expect(choices()[1].props.disabled).toBe(true);
        expect(onSelect).not.toHaveBeenCalled();
        await act(async () => {
            reject(new Error("disk")); await operation;
        });
        expect(Toast.warn).toHaveBeenCalledWith("aggregate.updateFailed");
        expect(hidePanel).not.toHaveBeenCalled();
        expect(choices()[1].props.disabled).toBe(false);
        act(() => choices()[1].props.onPress());
        expect(onSelect).toHaveBeenCalledWith(trackSourceKey(b));
    });
    it.each([lightColors, darkColors, { ...lightColors, primary: "#ac52bd" }])("keeps selected text and check marks readable on the panel surface", palette => {
        mockColors = resolveThemeColors({ ...palette, background: palette.pageBackground }, palette === darkColors);
        render();
        const surface = StyleSheet.flatten(choices()[0].props.style({ pressed: false })).backgroundColor;
        const name = choices()[0].findAllByType(ThemeText).find(node => node.props.children === "A")!;
        const check = choices()[0].findByType(Icon);
        expect(name.props.color).toBe(mockColors.active);
        expect(contrastRatio(name.props.color, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(check.props.color, surface)).toBeGreaterThanOrEqual(3);
    });
});
