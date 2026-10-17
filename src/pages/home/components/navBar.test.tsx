import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import NavBar from "./navBar";

const mockNavigate = jest.fn();
const mockPanel = jest.fn();
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/core/router", () => ({ ROUTE_PATH: { SEARCH_PAGE: "search" } }));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock("@/components/panels/usePanel", () => ({ showPanel: (...args: unknown[]) => mockPanel(...args) }));
jest.mock("@/hooks/useColors", () => () => ({ surface: "surface", text: "text", textSecondary: "secondary" }));
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value }));

it("keeps search and sleep timer accessible without a misleading extra search control", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<NavBar />);
    });
    const search = renderer.root.findByProps({ accessibilityLabel: "home.clickToSearch" });
    const timer = renderer.root.findByProps({ accessibilityLabel: "sidebar.scheduleClose" });
    expect(StyleSheet.flatten(search.props.style).minHeight).toBeGreaterThanOrEqual(44);
    expect(StyleSheet.flatten(timer.props.style).height).toBeGreaterThanOrEqual(44);
    expect(renderer.root.findAllByType("Icon" as any).some(icon => icon.props.name === "crosshair")).toBe(false);
    act(() => search.props.onPress());
    act(() => timer.props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith("search");
    expect(mockPanel).toHaveBeenCalledWith("TimingClose");
    act(() => renderer.unmount());
});
