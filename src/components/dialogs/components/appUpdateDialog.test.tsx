import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import ThemeText from "@/components/base/themeText";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { getAppUpdateUrl } from "@/core/appUpdate";
import { appUpdate } from "@/core/appUpdateState";
import useColors from "@/hooks/useColors";
import { contrastRatio } from "@/utils/colorContrast";
import { resolveThemeColors } from "@/utils/themeColors";
import { hideDialog } from "../useDialog";
import AppUpdateDialog from "./appUpdateDialog";
import Dialog from "./base";

jest.mock("@/core/appUpdate", () => ({ getAppUpdateUrl: jest.fn() }));
jest.mock("@/core/appUpdateState", () => ({ appUpdate: { start: jest.fn() } }));
jest.mock("../useDialog", () => ({ hideDialog: jest.fn() }));
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/hooks/useColors", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/utils/fileUtils", () => ({ sizeFormatter: (bytes: number) => `${bytes}B` }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 24 }) }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("./base", () => "Dialog");

const release = { version: "0.3.3", changeLog: ["In-app updates"], download: ["https://example.com/app.apk"] };

describe("AppUpdateDialog", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    function action(title: string) {
        return renderer.root.findAllByType(TouchableOpacity)
            .find(item => item.findByType(ThemeText).props.children === title)?.props;
    }
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(useColors).mockReturnValue(resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false));
        jest.mocked(getAppUpdateUrl).mockReturnValue(release.download[0]);
        act(() => {
            renderer = TestRenderer.create(<AppUpdateDialog release={release} />);
        });
    });
    afterEach(() => {
        act(() => renderer.unmount());
    });

    it("shows a bottom sheet with notes and real metadata", () => {
        expect(renderer.root.findByType(Dialog).props.placement).toBe("bottom");
        const messages = renderer.root.findAllByType(ThemeText).map(node => node.props.children);
        expect(messages).toEqual(expect.arrayContaining(["In-app updates", "0.3.3", "checkUpdate.foundNewVersion"]));
        expect(appUpdate.start).not.toHaveBeenCalled();
        act(() => renderer.update(<AppUpdateDialog release={{ ...release, downloadSize: 100 }} />));
        expect(renderer.root.findAllByType(ThemeText).map(node => node.props.children)).toContain("0.3.3 · 100B");
    });

    it("starts once and closes immediately, without owning the download", () => {
        const confirm = action("checkUpdate.updateNow")!.onPress;
        act(() => {
            confirm(); confirm();
        });
        expect(appUpdate.start).toHaveBeenCalledTimes(1);
        expect(appUpdate.start).toHaveBeenCalledWith(release);
        expect(hideDialog).toHaveBeenCalledTimes(1);
    });

    it("allows later, backdrop and back dismissal without starting a task", () => {
        act(() => {
            action("checkUpdate.later")!.onPress();
            renderer.root.findByType(Dialog).props.onDismiss();
        });
        expect(hideDialog).toHaveBeenCalledTimes(2);
        expect(appUpdate.start).not.toHaveBeenCalled();
    });

    it("has no download action without an APK URL", () => {
        jest.mocked(getAppUpdateUrl).mockReturnValue(undefined);
        act(() => renderer.update(<AppUpdateDialog release={release} />));
        expect(action("checkUpdate.updateNow")).toBeUndefined();
        expect(renderer.root.findAllByType(ThemeText).map(node => node.props.children))
            .toContain("checkUpdate.error.noDownload");
    });

    it.each([
        ["light", lightColors, false],
        ["dark", darkColors, true],
        ["custom", { ...lightColors, primary: "#e7ce52" }, false],
    ] as const)("keeps the tonal action readable in %s themes", (_name, palette, dark) => {
        const colors = resolveThemeColors({ ...palette, background: palette.pageBackground }, dark);
        jest.mocked(useColors).mockReturnValue(colors);
        act(() => renderer.update(<AppUpdateDialog release={release} />));
        const button = renderer.root.findAllByType(TouchableOpacity).find(node =>
            node.findByType(ThemeText).props.children === "checkUpdate.updateNow")!;
        expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe(colors.tonalSurface);
        expect(contrastRatio(button.findByType(ThemeText).props.color, colors.tonalSurface)).toBeGreaterThanOrEqual(4.5);
    });
});
