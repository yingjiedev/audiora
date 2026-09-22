import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import SeekBar from "./seekBar";

const COLORS = {
    primary: "#3978FF",
    onMedia: "#FFFFFF",
    onMediaSecondary: "#B9C2D0",
    onMediaTrack: "#474F5E",
    text: "#111827",
};

jest.mock("@react-native-community/slider", () => "Slider");
jest.mock("@/core/i18n", () => ({
    useI18N: () => ({ t: (key: string) => key }),
}));
jest.mock("@/core/trackPlayer", () => ({
    __esModule: true,
    default: { seekTo: jest.fn() },
    useProgress: () => ({ position: 30, duration: 210 }),
}));
jest.mock("@/hooks/useColors", () => () => COLORS);
jest.mock("@/utils/rpx", () => ({
    __esModule: true,
    default: (value: number) => value,
    fontRpx: (value: number) => value,
    fontRpxRound: (value: number) => value,
}));

describe("SeekBar", () => {
    it("is exposed to TalkBack as an adjustable control with a readable value", () => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<SeekBar />);
        });

        const slider = renderer!.root.findByType("Slider");

        expect(slider.props.accessibilityRole).toBe("adjustable");
        expect(slider.props.accessibilityLabel).toBe("musicDetail.a11y.seek");
        expect(slider.props.accessibilityValue).toEqual({
            min: 0,
            max: 210,
            now: 30,
        });
    });

    it("takes track colors from media tokens instead of hardcoded white", () => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<SeekBar />);
        });

        const slider = renderer!.root.findByType("Slider");

        expect(slider.props.minimumTrackTintColor).toBe(COLORS.onMedia);
        expect(slider.props.maximumTrackTintColor).toBe(COLORS.onMediaTrack);
    });
});
