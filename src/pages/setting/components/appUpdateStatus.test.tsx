import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import ThemeText from "@/components/base/themeText";
import { appUpdate, type AppUpdateState } from "@/core/appUpdateState";
import { darkColors, lightColors } from "@/constants/colorPalette";
import useColors from "@/hooks/useColors";
import { resolveThemeColors } from "@/utils/themeColors";
import { contrastRatio } from "@/utils/colorContrast";
import AppUpdateStatus from "./appUpdateStatus";

jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/core/appUpdate", () => ({ downloadAppUpdate: jest.fn() }));
jest.mock("@/native/utils", () => ({ installAppUpdate: jest.fn() }));
jest.mock("@/hooks/useColors", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/utils/fileUtils", () => ({ sizeFormatter: (bytes: number) => `${bytes}B` }));
jest.mock("@/core/i18n", () => ({
    useI18N: () => ({ t: (key: string, args?: { version?: string }) => args?.version ? `${key} ${args.version}` : key }),
}));

const release = { version: "0.3.3", changeLog: [], download: ["https://example.com/update.apk"] };
const baseState = { release, progress: { bytesWritten: 62, contentLength: 100 }, apkPath: null };
describe("AppUpdateStatus", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    function setState(value: AppUpdateState) {
        act(() => appUpdate.state.setValue(value));
    }
    function messages() {
        return renderer.root.findAllByType(ThemeText).map(node => node.props.children);
    }
    beforeEach(() => {
        jest.mocked(useColors).mockReturnValue(resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false));
        appUpdate.state.setValue({ phase: "idle" });
        act(() => {
            renderer = TestRenderer.create(<AppUpdateStatus />);
        });
    });
    afterEach(() => {
        act(() => renderer.unmount());
        jest.restoreAllMocks();
    });

    it("shows progress and size without opening a modal", () => {
        expect(renderer.toJSON()).toBeNull();
        setState({ ...baseState, phase: "downloading" });
        expect(messages()).toEqual(expect.arrayContaining(["checkUpdate.downloadingVersion 0.3.3", "62%", "62B / 100B"]));
        expect(renderer.root.findByProps({ testID: "app-update-progress" }).props.accessibilityValue.now).toBe(62);
        const cancel = jest.spyOn(appUpdate, "cancel").mockImplementation(() => {});
        // Refresh so the button receives the spied handler.
        setState({ ...baseState, phase: "downloading" });
        act(() => {
            renderer.root.findByType(TouchableOpacity).props.onPress();
        });
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it("shows transferred bytes and activity without inventing an unknown total", () => {
        setState({ ...baseState, phase: "downloading", progress: null });
        expect(messages()).toContain("checkUpdate.selectingDownload");
        setState({ ...baseState, phase: "downloading", progress: { bytesWritten: 50, contentLength: null } });
        expect(messages()).toContain("50B");
        expect(renderer.root.findAllByProps({ testID: "app-update-percentage" })).toHaveLength(0);
        expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    });

    it("bounds progress and prevents repeated cancellation while cleanup runs", () => {
        setState({ ...baseState, phase: "downloading", progress: { bytesWritten: 120, contentLength: 100 } });
        expect(messages()).toContain("100%");
        setState({ ...baseState, phase: "cancelling" });
        expect(renderer.root.findByType(TouchableOpacity).props.disabled).toBe(true);
        expect(messages()).toContain("checkUpdate.cancelling");
    });

    it("offers installation of the downloaded package and no progress bar", () => {
        const install = jest.spyOn(appUpdate, "install").mockResolvedValue(undefined);
        setState({ ...baseState, phase: "ready", apkPath: "/cache/update.apk" });
        expect(messages()).toEqual(expect.arrayContaining(["checkUpdate.packageDownloaded", "0.3.3 · 100B", "checkUpdate.installNow"]));
        expect(renderer.root.findAllByProps({ testID: "app-update-progress" })).toHaveLength(0);
        expect(install).not.toHaveBeenCalled();
        act(() => {
            renderer.root.findByType(TouchableOpacity).props.onPress();
        });
        expect(install).toHaveBeenCalledTimes(1);
    });

    it("allows download retry and explains install permissions inline", () => {
        const start = jest.spyOn(appUpdate, "start").mockResolvedValue(undefined);
        setState({ ...baseState, phase: "downloadFailed" });
        expect(messages()).toContain("checkUpdate.error.downloadFailed");
        act(() => {
            renderer.root.findByType(TouchableOpacity).props.onPress();
        });
        expect(start).toHaveBeenCalledWith(release);
        setState({ ...baseState, phase: "permissionDenied", apkPath: "/cache/update.apk" });
        expect(messages()).toContain("checkUpdate.error.installPermission");
        expect(messages()).toContain("checkUpdate.installNow");
        setState({ ...baseState, phase: "installing", apkPath: "/cache/update.apk" });
        expect(renderer.root.findByType(TouchableOpacity).props.disabled).toBe(true);
    });

    it.each([
        ["light", lightColors, false],
        ["dark", darkColors, true],
        ["custom", { ...lightColors, primary: "#e7ce52" }, false],
    ] as const)("keeps text and progress readable on the %s card", (_name, palette, dark) => {
        const colors = resolveThemeColors({ ...palette, background: palette.pageBackground }, dark);
        jest.mocked(useColors).mockReturnValue(colors);
        setState({ ...baseState, phase: "downloading" });
        const text = renderer.root.findByProps({ testID: "app-update-percentage" }).props.color;
        const fill = StyleSheet.flatten(renderer.root.findByProps({ testID: "app-update-progress-fill" }).props.style).backgroundColor;
        expect(contrastRatio(text, colors.card)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(fill, colors.tonalSurface)).toBeGreaterThanOrEqual(3);
        setState({ ...baseState, phase: "ready", apkPath: "/cache/update.apk" });
        const button = renderer.root.findByType(TouchableOpacity);
        expect(contrastRatio(button.findByType(ThemeText).props.color, StyleSheet.flatten(button.props.style).backgroundColor))
            .toBeGreaterThanOrEqual(4.5);
    });
});
