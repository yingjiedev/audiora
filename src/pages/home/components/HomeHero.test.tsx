import React from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import HomeHero from "./HomeHero";

jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/constants/assetsConst", () => ({
    ImgAsset: { homeHero: 1 },
}));
jest.mock("@/core/i18n", () => ({
    useI18N: () => ({ t: (key: string) => key }),
}));
jest.mock("@/core/router", () => ({
    ROUTE_PATH: { LOCAL: "local", MUSIC_DETAIL: "music-detail" },
    useNavigate: () => jest.fn(),
}));
jest.mock("@/core/trackPlayer", () => ({
    __esModule: true,
    default: { pause: jest.fn(), play: jest.fn() },
    useCurrentMusic: () => null,
    useMusicState: () => null,
}));
jest.mock("@/utils/rpx", () => ({
    __esModule: true,
    default: (value: number) => value,
    fontRpx: (value: number) => value,
}));
jest.mock("@/utils/trackUtils", () => ({ musicIsPaused: () => true }));

describe("HomeHero layout", () => {
    it.each([
        ["light", DefaultTheme],
        ["dark", DarkTheme],
    ])("stretches horizontally without deriving width from an aspect ratio (%s)", (_mode, theme) => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(
                <ThemeProvider value={theme}>
                    <HomeHero />
                </ThemeProvider>,
            );
        });

        const card = renderer!.root.findByProps({
            accessibilityLabel: "home.welcomeTitle",
        });
        const style = StyleSheet.flatten(card.props.style);

        expect(style.alignSelf).toBe("stretch");
        expect(style.height).toBe(268);
        expect(style.marginHorizontal).toBe(24);
        expect(style.aspectRatio).toBeUndefined();

        act(() => {
            renderer!.unmount();
        });
    });
});
