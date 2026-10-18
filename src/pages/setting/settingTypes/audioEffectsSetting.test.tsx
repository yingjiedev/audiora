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
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { success: jest.fn() } }));

function render() {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<AudioEffectsSetting />);
    });
    return renderer;
}

describe("audio effects settings", () => {
    beforeEach(() => {
        mockState = { ...initialState(true), loaded: true, version: 1, status: "ready", frequencies: [60, 230, 910, 3600, 14000] };
        mockState.settings = { ...defaultSettings(), enabled: true };
        mockUpdate.mockReset().mockResolvedValue(true);
        jest.requireMock("@/utils/toast").default.success.mockReset();
    });

    it("renders only the device bands and sends live previews separately from persistence", () => {
        const renderer = render();
        const sliders = renderer.root.findAllByType("Slider" as any);
        expect(sliders).toHaveLength(5);
        act(() => {
            sliders[0].props.onValueChange(2); sliders[0].props.onSlidingComplete(2);
        });
        expect(mockUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({ preset: "custom" }), false);
        expect(mockUpdate).toHaveBeenNthCalledWith(2, expect.objectContaining({ preset: "custom" }), true);
    });

    it("disables sliders when bypassed and hides tuning when unsupported", () => {
        mockState.settings.enabled = false;
        expect(render().root.findAllByType("Slider" as any).every(slider => slider.props.disabled)).toBe(true);
        mockState.status = "unsupported";
        expect(render().root.findAllByType("Slider" as any)).toHaveLength(0);
    });

    it("does not announce a saved preset if persistence failed", async () => {
        mockUpdate.mockResolvedValue(false);
        const renderer = render();
        const row = renderer.root.findAllByProps({ title: "audioEffects.saveCustom" })[0];
        await act(async () => {
            await row.props.onPress();
        });
        expect(jest.requireMock("@/utils/toast").default.success).not.toHaveBeenCalled();
    });
});
