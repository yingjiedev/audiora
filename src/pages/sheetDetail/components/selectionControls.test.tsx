import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, View } from "react-native";
import { SelectionActions } from "./selectionControls";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { resolveThemeColors } from "@/utils/themeColors";
import { blendOver, contrastRatio } from "@/utils/colorContrast";

let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { addNext: jest.fn() } }));
jest.mock("@/core/musicSheet", () => ({ __esModule: true, default: { removeMusic: jest.fn() } }));
jest.mock("@/core/downloader", () => ({ __esModule: true, default: { download: jest.fn() } }));
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: jest.fn() }));
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { success: jest.fn(), warn: jest.fn() } }));

it.each([
    ["light", lightColors, false],
    ["dark", darkColors, true],
    ["custom", { ...lightColors, primary: "#B68CFF", card: "rgba(255,255,255,0.8)" }, false],
] as const)("keeps all four enabled toolbar actions readable against the actual surface in %s", (_name, palette, dark) => {
    mockColors = resolveThemeColors({ ...palette, background: palette.pageBackground }, dark);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<SelectionActions sheetId="favorite" selectedItems={[{ id: "one", platform: "source", title: "Song", artist: "Artist", album: "Album", duration: 180, artwork: "" }]} onClear={jest.fn()} />);
    });
    const page = blendOver(mockColors.pageBackground!, dark ? darkColors.pageBackground : lightColors.pageBackground);
    const fill = blendOver(StyleSheet.flatten(renderer!.root.findAllByType(View)[0].props.style).backgroundColor as string, page);
    const buttons = renderer!.root.findAll(node => node.props.accessibilityRole === "button" && typeof node.props.style === "function");
    expect(buttons).toHaveLength(4);
    for (const button of buttons) {
        const text = button.findByType("ThemeText" as any);
        const icon = button.findByType("Icon" as any);
        expect(contrastRatio(blendOver(text.props.color, fill), fill)).toBeGreaterThanOrEqual(4.5);
        expect(icon.props.color).toBe(text.props.color);
        expect(text.props.allowFontScaling).toBe(true);
        expect(text.props.numberOfLines).toBeUndefined();
    }
    act(() => renderer!.unmount());
});
