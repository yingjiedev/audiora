import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AudioEffectsSetting from "./audioEffectsSetting";
import { AudioEffectsState, defaultSettings, initialState } from "@/core/audioEffects/model";

let mockState: AudioEffectsState;
const mockUpdate = jest.fn();
const mockRefresh = jest.fn();
jest.mock("@/core/audioEffects", () => ({
    useAudioEffects: () => mockState,
    audioEffects: { getSnapshot: () => mockState, update: (...args: any[]) => mockUpdate(...args), refresh: () => mockRefresh() },
}));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/hooks/useColors", () => () => ({ card: "#FFFFFF", surface: "#EEEEEE", text: "#111111", textSecondary: "#555555", primary: "#3867F4", active: "#3867F4", onPrimary: "#FFFFFF" }));
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value }));
jest.mock("@/components/base/switch", () => "ThemeSwitch");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@react-native-community/slider", () => "Slider");
jest.mock("../components/equalizerCurve", () => "EqualizerCurve");
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { success: jest.fn(), warn: jest.fn() } }));

function render() {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<AudioEffectsSetting />);
    });
    return renderer;
}

function press(renderer: TestRenderer.ReactTestRenderer, label: string) {
    act(() => {
        renderer.root.findAllByProps({ accessibilityLabel: label })[0].props.onPress();
    });
}

describe("audio effects settings", () => {
    beforeEach(() => {
        mockState = { ...initialState(true), loaded: true, version: 1, status: "ready", frequencies: [60, 230, 910, 3600, 14000] };
        mockState.settings = { ...defaultSettings(), enabled: true };
        mockState.active = true;
        mockUpdate.mockReset().mockResolvedValue(true);
        jest.requireMock("@/utils/toast").default.success.mockReset();
    });

    it("groups actual device bands and sends live previews separately from persistence", () => {
        const renderer = render();
        press(renderer, "audioEffects.custom");
        const sliders = renderer.root.findAllByType("Slider" as any);
        expect(sliders).toHaveLength(2);
        act(() => {
            sliders[0].props.onValueChange(2); sliders[0].props.onSlidingComplete(2);
        });
        expect(mockUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({ preset: "custom" }), false);
        expect(mockUpdate).toHaveBeenNthCalledWith(2, expect.objectContaining({ preset: "custom" }), true);
        press(renderer, "audioEffects.range.mid");
        expect(renderer.root.findAllByType("Slider" as any).map(slider => slider.props.accessibilityLabel)).toEqual([
            "audioEffects.bandLabel", "audioEffects.bandLabel",
        ]);
        press(renderer, "audioEffects.range.high");
        expect(renderer.root.findAllByType("Slider" as any)).toHaveLength(1);
        expect(renderer.root.findByType("EqualizerCurve" as any).props.bands.map((band: any) => band.frequencyHz)).toEqual(mockState.frequencies);
    });

    it("disables sliders when bypassed and hides tuning when unsupported", () => {
        mockState.settings.enabled = false;
        const renderer = render();
        press(renderer, "audioEffects.custom");
        expect(renderer.root.findAllByType("Slider" as any).every(slider => slider.props.disabled)).toBe(true);
        mockState.status = "unsupported";
        expect(render().root.findAllByType("Slider" as any)).toHaveLength(0);
    });

    it("does not announce a saved preset if persistence failed", async () => {
        mockUpdate.mockResolvedValue(false);
        const renderer = render();
        press(renderer, "audioEffects.custom");
        const row = renderer.root.findAllByProps({ accessibilityLabel: "audioEffects.saveCustom" })[0];
        await act(async () => {
            await row.props.onPress();
        });
        expect(jest.requireMock("@/utils/toast").default.success).not.toHaveBeenCalled();
        expect(jest.requireMock("@/utils/toast").default.warn).toHaveBeenCalledWith("audioEffects.saveFailed");
    });

    it("applies genre presets while keeping a saved custom tuning", () => {
        mockState.settings.savedCustom = { bands: mockState.settings.bands, preampDb: -3 };
        const renderer = render();
        press(renderer, "audioEffects.preset.rock");
        expect(mockUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
            preset: "rock", preampDb: 0, savedCustom: mockState.settings.savedCustom,
        }));
    });

    it("keeps preamp available across band groups and saves the whole tuning", async () => {
        mockState.supportsPreamp = true;
        mockState.frequencies = [63, 250, 4000];
        const renderer = render();
        press(renderer, "audioEffects.custom");
        press(renderer, "audioEffects.range.mid");
        const preamp = renderer.root.findAllByType("Slider" as any).find(slider => slider.props.accessibilityLabel === "audioEffects.preamp")!;
        act(() => {
            preamp.props.onSlidingComplete(-3);
        });
        expect(mockUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ preampDb: -3, preset: "custom" }), true);
        const save = renderer.root.findAllByProps({ accessibilityLabel: "audioEffects.saveCustom" })[0];
        await act(async () => {
            await save.props.onPress();
        });
        expect(mockUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
            savedCustom: { bands: mockState.settings.bands, preampDb: mockState.settings.preampDb },
        }));
        expect(jest.requireMock("@/utils/toast").default.success).toHaveBeenCalledWith("audioEffects.saved");
    });
});
