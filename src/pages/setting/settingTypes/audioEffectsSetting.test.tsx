import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AudioEffectsSetting from "./audioEffectsSetting";
import { AudioEffectsSettings, AudioEffectsState, createUserPreset, defaultSettings, initialState, presetBands } from "@/core/audioEffects/model";

let mockState: AudioEffectsState;
const mockUpdate = jest.fn();
const mockRefresh = jest.fn();
jest.mock("@/core/audioEffects", () => ({
    useAudioEffects: () => mockState,
    audioEffects: { getSnapshot: () => mockState, update: (...args: any[]) => mockUpdate(...args), refresh: () => mockRefresh() },
}));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string, values?: any) => values?.name ? `${key}:${values.name}` : key }) }));
jest.mock("@/hooks/useColors", () => () => ({ card: "#FFFFFF", surface: "#EEEEEE", text: "#111111", textSecondary: "#555555", primary: "#3867F4", active: "#3867F4", onPrimary: "#FFFFFF" }));
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value, fontRpx: (value: number) => value }));
jest.mock("@/utils/nanoid", () => ({ nanoid: () => "created-preset" }));
jest.mock("@/components/base/appBar", () => {
    const mockReact = require("react");
    return ({ children, actionComponent, ...props }: any) => mockReact.createElement("AppBar", props, children, actionComponent);
});
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("@/components/base/switch", () => "ThemeSwitch");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@react-native-community/slider", () => "Slider");
jest.mock("../components/equalizerCurve", () => "EqualizerCurve");
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: jest.fn() }));
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { success: jest.fn(), warn: jest.fn() } }));

function render() {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<AudioEffectsSetting />);
    });
    return renderer;
}

async function press(renderer: TestRenderer.ReactTestRenderer, label: string) {
    await act(async () => {
        await renderer.root.findAllByProps({ accessibilityLabel: label })[0].props.onPress();
    });
}

const input = () => jest.requireMock("@/components/panels/usePanel").showPanel.mock.calls.slice(-1)[0][1];
const toast = () => jest.requireMock("@/utils/toast").default;

describe("illustrated sound presets and editing", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockState = { ...initialState(true), loaded: true, version: 1, status: "ready", active: true, frequencies: [60, 230, 910, 3600, 14000] };
        mockState.settings = { ...defaultSettings(), enabled: true };
        mockUpdate.mockImplementation(async (settings: AudioEffectsSettings) => {
            mockState = { ...mockState, settings }; return true;
        });
    });

    it("renders an illustrated gallery with the switch outside the scrolling content", async () => {
        const renderer = render();
        expect(renderer.root.findAllByProps({ testID: "audio-effects-hero" })).not.toHaveLength(0);
        expect(renderer.root.findAllByType("Slider" as any)).toHaveLength(0);
        await press(renderer, "audioEffects.preset.rock");
        expect(mockUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true, preset: "rock", activeCustomId: null }));
    });

    it("groups actual device bands and separates live previews from persistence", async () => {
        const renderer = render();
        await press(renderer, "common.edit");
        const sliders = renderer.root.findAllByType("Slider" as any);
        expect(sliders).toHaveLength(2);
        act(() => {
            sliders[0].props.onValueChange(2); sliders[0].props.onSlidingComplete(2);
        });
        expect(mockUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({ preset: "custom" }), false);
        expect(mockUpdate).toHaveBeenNthCalledWith(2, expect.objectContaining({ preset: "custom" }), true);
        await press(renderer, "audioEffects.range.high");
        expect(renderer.root.findAllByType("Slider" as any)).toHaveLength(1);
        expect(renderer.root.findByType("EqualizerCurve" as any).props.bands.map((band: any) => band.frequencyHz)).toEqual(mockState.frequencies);
    });

    it("can configure a new preset while effects are off and no track has been played", async () => {
        mockState.settings.enabled = false;
        mockState.frequencies = [];
        mockState.status = "waiting";
        const renderer = render();
        await press(renderer, "common.edit");
        const sliders = renderer.root.findAllByType("Slider" as any);
        expect(sliders).toHaveLength(3);
        expect(sliders.every(slider => !slider.props.disabled)).toBe(true);
        act(() => {
            sliders[0].props.onSlidingComplete(2);
        });
        expect(mockUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false, preset: "custom" }), true);
    });

    it("creates a named preset without replacing the existing collection", async () => {
        mockState.settings = createUserPreset(mockState.settings, "old", "Old");
        const renderer = render();
        await press(renderer, "audioEffects.createPreset");
        const close = jest.fn();
        await act(async () => {
            await input().onOk("Commute", close);
        });
        expect(mockState.settings.customPresets.map(preset => preset.name)).toEqual(["Old", "Commute"]);
        expect(mockState.settings.activeCustomId).toBe("created-preset");
        expect(close).toHaveBeenCalled();
        expect(toast().success).toHaveBeenCalledWith("audioEffects.created");
    });

    it("keeps invalid names and failed writes from claiming successful creation", async () => {
        const renderer = render();
        await press(renderer, "audioEffects.createPreset");
        const close = jest.fn();
        await act(async () => {
            await input().onOk("   ", close);
        });
        expect(mockUpdate).not.toHaveBeenCalled();
        expect(toast().warn).toHaveBeenCalledWith("audioEffects.nameRequired");
        mockUpdate.mockResolvedValue(false);
        await act(async () => {
            await input().onOk("Night", close);
        });
        expect(close).not.toHaveBeenCalled();
        expect(toast().success).not.toHaveBeenCalled();
        expect(mockRefresh).toHaveBeenCalled();
    });

    it("saves modifications to the selected preset while retaining a separate save-as action", async () => {
        mockState.settings = createUserPreset(mockState.settings, "one", "One");
        mockState.settings = { ...mockState.settings, preampDb: -3 };
        mockState.supportsPreamp = true;
        const renderer = render();
        await press(renderer, "common.edit");
        expect(renderer.root.findAllByProps({ accessibilityLabel: "audioEffects.saveAsNew" })).not.toHaveLength(0);
        await press(renderer, "audioEffects.saveChanges");
        expect(mockState.settings.customPresets[0].preampDb).toBe(-3);
        expect(toast().success).toHaveBeenCalledWith("audioEffects.saved");
    });

    it("renames and deletes saved presets without resetting the current tuning", async () => {
        mockState.settings = createUserPreset({ ...mockState.settings, bands: presetBands("bass") }, "one", "One");
        const renderer = render();
        await press(renderer, "audioEffects.manageNamedPreset:One");
        act(() => {
            input().onPress({ value: "rename" });
        });
        await act(async () => {
            await input().onOk("Commute", jest.fn());
        });
        expect(mockState.settings.customPresets[0].name).toBe("Commute");
        act(() => {
            renderer.update(<AudioEffectsSetting />);
        });
        await press(renderer, "audioEffects.manageNamedPreset:Commute");
        act(() => {
            input().onPress({ value: "delete" });
        });
        const dialog = jest.requireMock("@/components/dialogs/useDialog").showDialog.mock.calls[0][1];
        await act(async () => {
            await dialog.onOk();
        });
        expect(mockState.settings.customPresets).toEqual([]);
        expect(mockState.settings.activeCustomId).toBeNull();
        expect(mockState.settings.bands).toEqual(presetBands("bass"));
    });

    it("opens another saved preset in the shared editor without enabling effects", async () => {
        mockState.settings = createUserPreset({ ...mockState.settings, bands: presetBands("bass") }, "one", "One");
        mockState.settings = createUserPreset({ ...mockState.settings, bands: presetBands("vocal") }, "two", "Two");
        mockState.settings.enabled = false;
        const renderer = render();
        await press(renderer, "audioEffects.editNamedPreset:One");
        expect(mockState.settings.enabled).toBe(false);
        expect(mockState.settings.activeCustomId).toBe("one");
        expect(mockState.settings.bands).toEqual(presetBands("bass"));
        expect(mockState.settings.customPresets[1].bands).toEqual(presetBands("vocal"));
        expect(renderer.root.findAllByType("Slider" as any)).toHaveLength(2);
    });

    it("selects a saved preset from its name or curve and only opens the editor from Edit", async () => {
        mockState.settings = createUserPreset({ ...mockState.settings, bands: presetBands("bass") }, "one", "One");
        mockState.settings = createUserPreset({ ...mockState.settings, bands: presetBands("vocal") }, "two", "Two");
        const renderer = render();
        await press(renderer, "audioEffects.applyNamedPreset:One");
        expect(mockState.settings.activeCustomId).toBe("one");
        expect(mockState.settings.bands).toEqual(presetBands("bass"));
        expect(renderer.root.findAllByType("Slider" as any)).toHaveLength(0);
        act(() => {
            renderer.update(<AudioEffectsSetting />);
        });
        expect(renderer.root.findAllByProps({ accessibilityLabel: "audioEffects.applyNamedPreset:One" })[0].props.accessibilityState.selected).toBe(true);
        await press(renderer, "audioEffects.editNamedPreset:One");
        expect(renderer.root.findAllByType("Slider" as any)).toHaveLength(2);
    });

    it("preserves unsaved tuning when applying or editing the current preset", async () => {
        mockState.settings = createUserPreset(mockState.settings, "one", "One");
        mockState.settings = { ...mockState.settings, enabled: false, preampDb: -3 };
        const renderer = render();
        await press(renderer, "audioEffects.applyNamedPreset:One");
        expect(mockState.settings.enabled).toBe(true);
        expect(mockState.settings.preampDb).toBe(-3);
        expect(mockState.settings.customPresets[0].preampDb).toBe(0);
        await press(renderer, "audioEffects.editNamedPreset:One");
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        expect(mockState.settings.preampDb).toBe(-3);
        expect(renderer.root.findAllByType("Slider" as any)).toHaveLength(2);
    });

    it("keeps the gallery open if loading a saved preset for editing fails", async () => {
        mockState.settings = { ...createUserPreset(mockState.settings, "one", "One"), activeCustomId: null };
        mockUpdate.mockResolvedValue(false);
        const renderer = render();
        await press(renderer, "audioEffects.editNamedPreset:One");
        expect(renderer.root.findAllByType("Slider" as any)).toHaveLength(0);
        expect(toast().warn).toHaveBeenCalledWith("audioEffects.saveFailed");
        expect(mockRefresh).toHaveBeenCalled();
    });
});
