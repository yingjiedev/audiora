import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Platform } from "react-native";
import Theme from "@/core/theme";
import Mode from "./mode";

let mockThemeId = "p-light";
let mockSupported = true;
const mockConfig: Record<string, unknown> = {};

jest.mock("@/core/appConfig", () => ({ useAppConfig: (key: string) => mockConfig[key] }));
jest.mock("@/core/theme", () => ({
    __esModule: true,
    default: {
        useTheme: () => ({ id: mockThemeId }),
        setDynamicColors: jest.fn(),
        setFollowSystem: jest.fn(),
    },
    isPresetThemeId: (id: string) => id === "p-light" || id === "p-dark",
}));
jest.mock("@/native/dynamicColors", () => ({
    __esModule: true,
    default: {
        get isSupported() {
            return mockSupported;
        },
    },
}));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/components/base/themeText", () => "theme-text");
jest.mock("@/components/base/switch", () => "theme-switch");
jest.mock("../../components/settingSection", () => "setting-section");
jest.mock("../../components/settingRow", () => {
    const ReactMock = require("react");
    return ({ right, ...props }: { right: React.ReactNode }) => ReactMock.createElement("setting-row", props, right);
});

let renderer: TestRenderer.ReactTestRenderer;
const switches = () => renderer.root.findAllByType("theme-switch" as any);
const render = () => act(() => {
    renderer = TestRenderer.create(<Mode />);
});

beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = "android";
    mockThemeId = "p-light";
    mockSupported = true;
    Object.keys(mockConfig).forEach(key => {
        delete mockConfig[key];
    });
});
afterEach(() => {
    act(() => {
        renderer?.unmount();
    });
});

it("exposes an independent, default-off dynamic color preference on supported Android", () => {
    render();
    expect(switches()).toHaveLength(2);
    expect(switches()[0].props.value).toBe(true);
    expect(switches()[1].props.value).toBe(false);
    expect(switches()[1].props.disabled).toBe(false);
    act(() => {
        switches()[1].props.onValueChange(true);
    });
    expect(Theme.setDynamicColors).toHaveBeenCalledWith(true);
    expect(Theme.setFollowSystem).not.toHaveBeenCalled();
});

it("keeps a saved preference visible but inactive while a custom theme takes priority", () => {
    mockThemeId = "custom";
    mockConfig["theme.dynamicColors"] = true;
    render();
    expect(switches()[1].props.value).toBe(true);
    expect(switches()[1].props.disabled).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).toContain("themeSettings.dynamicColorsCustom");
});

it("explains why an older Android device cannot enable dynamic colors", () => {
    mockSupported = false;
    render();
    expect(switches()[1].props.disabled).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).toContain("themeSettings.dynamicColorsUnavailable");
});

it("keeps the Android preference out of iOS settings", () => {
    const originalOS = Platform.OS;
    try {
        Platform.OS = "ios";
        render();
        expect(switches()).toHaveLength(1);
    } finally {
        Platform.OS = originalOS;
    }
});
