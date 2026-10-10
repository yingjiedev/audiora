import Color from "color";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import Slider from "@react-native-community/slider";
import SeekBar from "./seekBar";
import TrackPlayer from "@/core/trackPlayer";

let mockProgress = { position: 30, duration: 210 };

const COLORS = {
    primary: "#3978FF",
    onMedia: "#FFFFFF",
    onMediaSecondary: "#B9C2D0",
    onMediaTrack: "#474F5E",
    text: "#111827",
    textSecondary: "#485574",
    border: "#E5E7EB",
};

jest.mock("@react-native-community/slider", () => "Slider");
jest.mock("@/core/i18n", () => ({
    useI18N: () => ({ t: (key: string) => key }),
}));
jest.mock("@/core/trackPlayer", () => ({
    __esModule: true,
    default: { seekTo: jest.fn() },
    useProgress: () => mockProgress,
}));
jest.mock("@/hooks/useColors", () => () => COLORS);
jest.mock("@/utils/rpx", () => ({
    __esModule: true,
    default: (value: number) => value,
    fontRpx: (value: number) => value,
    fontRpxRound: (value: number) => value,
}));

describe("SeekBar", () => {
    beforeEach(() => {
        mockProgress = { position: 30, duration: 210 };
        jest.clearAllMocks();
    });

    it("uses surface colors in the expanded dock", () => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<SeekBar variant="surface" />);
        });
        const slider = renderer!.root.findByType(Slider);
        expect(slider.props.minimumTrackTintColor).toBe(COLORS.text);
        expect(slider.props.maximumTrackTintColor).toBe(Color(COLORS.text).alpha(0.22).toString());
        expect(slider.props.thumbSize).toBe(16);
    });

    it("does not seek to a negative time for clips shorter than two seconds", () => {
        mockProgress = { position: 0, duration: 1.5 };
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<SeekBar variant="surface" />);
        });
        act(() => renderer!.root.findByType(Slider).props.onSlidingComplete(1.5));
        expect(TrackPlayer.seekTo).toHaveBeenCalledWith(0);
    });

    it("disables seeking until a finite duration is known", () => {
        mockProgress = { position: 30, duration: Number.NaN };
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<SeekBar variant="surface" />);
        });
        const slider = renderer!.root.findByType(Slider);
        expect(slider.props.disabled).toBe(true);
        expect(slider.props.accessibilityValue).toEqual({ min: 0, max: 0, now: 0 });
        act(() => slider.props.onSlidingComplete(30));
        expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
    });

    it("is exposed to TalkBack as an adjustable control with a readable value", () => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<SeekBar />);
        });

        const slider = renderer!.root.findByType(Slider);

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

        const slider = renderer!.root.findByType(Slider);

        expect(slider.props.minimumTrackTintColor).toBe(COLORS.onMedia);
        expect(slider.props.maximumTrackTintColor).toBe(COLORS.onMediaTrack);
    });
});
