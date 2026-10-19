import { Appearance, AppState } from "react-native";
import Theme, { lightTheme, darkTheme } from "@/core/theme";
import { systemColorPalette } from "@/utils/__tests__/fixtures/systemColorPalette";

const mockConfig: Record<string, unknown> = {};
const mockGetPalette = jest.fn();
const mockRemoveListener = jest.fn();
let mockOnChange: () => void;

jest.mock("@/core/appConfig", () => ({
    __esModule: true,
    default: {
        getConfig: (key: string) => mockConfig[key],
        setConfig: (key: string, value: unknown) => {
            mockConfig[key] = value;
        },
    },
}));
jest.mock("@/native/dynamicColors", () => ({
    __esModule: true,
    default: {
        isSupported: true,
        getInitialPalette: () => require("@/utils/__tests__/fixtures/systemColorPalette").systemColorPalette,
        getPalette: () => mockGetPalette(),
        addChangeListener: (listener: () => void) => {
            mockOnChange = listener;
            return mockRemoveListener;
        },
    },
}));

const updatedPalette = {
    ...systemColorPalette,
    light: { ...systemColorPalette.light, primary: "#7459C7" },
};

beforeEach(async () => {
    jest.clearAllMocks();
    Object.keys(mockConfig).forEach(key => {
        delete mockConfig[key];
    });
    mockConfig["theme.followSystem"] = false;
    mockGetPalette.mockResolvedValue(systemColorPalette);
    Theme.setTheme("p-light");
    Theme.setBackground({ url: null });
    await Theme.refreshSystemColors();
});

afterEach(() => {
    jest.restoreAllMocks();
});

it("keeps dynamic colors off by default", () => {
    Theme.setup();
    expect(Theme.getTheme().colors).toEqual(lightTheme.colors);
    expect(mockConfig["theme.dynamicColors"]).toBeUndefined();
});

it.each([false, true])("uses system roles synchronously at startup (dark=%s) without changing stored settings", dark => {
    mockConfig["theme.dynamicColors"] = true;
    mockConfig["theme.selectedTheme"] = dark ? "p-dark" : "p-light";
    mockConfig["theme.customColors"] = { primary: "#DA9717" };
    mockConfig["theme.background"] = "file:///saved-background.jpg";
    const before = JSON.stringify(mockConfig);
    Theme.setup();
    const theme = Theme.getTheme();
    const scheme = dark ? systemColorPalette.dark : systemColorPalette.light;
    expect(theme.dark).toBe(dark);
    expect(theme.colors.primary).toBe(scheme.primary);
    expect(theme.colors.card).toBe(scheme.surfaceContainer);
    expect(theme.fonts.regular).toBeDefined();
    expect(Theme.getActiveBackground()).toBeNull();
    expect(JSON.stringify(mockConfig)).toBe(before);
});

it("switches color source independently from light/dark mode and saves only preset colors", async () => {
    Theme.setDynamicColors(true);
    await Promise.resolve();
    expect(Theme.getTheme().colors.primary).toBe(systemColorPalette.light.primary);
    expect(mockConfig["theme.followSystem"]).toBe(false);
    Theme.setTheme("p-dark");
    expect(Theme.getTheme().colors.primary).toBe(systemColorPalette.dark.primary);
    expect(mockConfig["theme.colors"]).toEqual(darkTheme.colors);
    Theme.setDynamicColors(false);
    expect(Theme.getTheme().colors).toEqual(darkTheme.colors);
});

it("continues to follow system dark mode when dynamic colors are enabled", () => {
    mockConfig["theme.dynamicColors"] = true;
    jest.spyOn(Appearance, "getColorScheme").mockReturnValue("dark");
    Theme.setFollowSystem(true);
    expect(Theme.getTheme().dark).toBe(true);
    expect(Theme.getTheme().colors.primary).toBe(systemColorPalette.dark.primary);
    jest.spyOn(Appearance, "getColorScheme").mockReturnValue("light");
    Theme.setFollowSystem(true);
    expect(Theme.getTheme().colors.primary).toBe(systemColorPalette.light.primary);
});

it("preserves a custom theme, its wallpaper and opacity through refresh and source changes", async () => {
    Theme.setTheme("custom", { colors: { primary: "#DA9717" }, background: { url: "file:///custom.jpg" } });
    Theme.setSurfaceOpacity(0.6);
    const savedColors = mockConfig["theme.colors"];
    const before = Theme.getTheme();
    Theme.setDynamicColors(true);
    await Theme.refreshSystemColors();
    Theme.setDynamicColors(false);
    expect(Theme.getTheme()).toBe(before);
    expect(mockConfig["theme.colors"]).toBe(savedColors);
    expect(mockConfig["theme.surfaceOpacity"]).toBe(0.6);
    expect(Theme.getActiveBackground()?.url).toBe("file:///custom.jpg");
});

it("replaces the runtime palette on change without persisting it or compounding opacity", async () => {
    mockConfig["theme.dynamicColors"] = true;
    Theme.setSurfaceOpacity(0.5);
    const persisted = JSON.stringify(mockConfig);
    const before = Theme.getTheme();
    mockGetPalette.mockResolvedValue(updatedPalette);
    await Theme.refreshSystemColors();
    expect(Theme.getTheme()).not.toBe(before);
    expect(Theme.getTheme().colors.primary).toBe(updatedPalette.light.primary);
    expect(Theme.getTheme().colors.card).toMatch(/0.5\)/);
    const unchanged = Theme.getTheme();
    await Theme.refreshSystemColors();
    expect(Theme.getTheme()).toBe(unchanged);
    expect(JSON.stringify(mockConfig)).toBe(persisted);
});

it("falls back on failure and recovers while keeping the enabled preference", async () => {
    mockConfig["theme.dynamicColors"] = true;
    mockGetPalette.mockResolvedValue(null);
    await Theme.refreshSystemColors();
    expect(Theme.getTheme().colors).toEqual(lightTheme.colors);
    expect(mockConfig["theme.dynamicColors"]).toBe(true);
    mockGetPalette.mockResolvedValue(systemColorPalette);
    await Theme.refreshSystemColors();
    expect(Theme.getTheme().colors.primary).toBe(systemColorPalette.light.primary);
});

it("ignores a stale native response after a more recent palette arrives", async () => {
    mockConfig["theme.dynamicColors"] = true;
    let complete!: (palette: unknown) => void;
    mockGetPalette.mockReturnValueOnce(new Promise(resolve => {
        complete = resolve;
    }));
    const oldRequest = Theme.refreshSystemColors();
    mockGetPalette.mockResolvedValue(updatedPalette);
    await Theme.refreshSystemColors();
    complete(systemColorPalette);
    await oldRequest;
    expect(Theme.getTheme().colors.primary).toBe(updatedPalette.light.primary);
});

it("does not re-enable dynamic colors when a pending read completes", async () => {
    Theme.setDynamicColors(true);
    Theme.setDynamicColors(false);
    await Promise.resolve();
    expect(Theme.getTheme().colors).toEqual(lightTheme.colors);
    expect(mockConfig["theme.dynamicColors"]).toBe(false);
});

it("refreshes on mount, foreground and native changes, and cleans up pending work", async () => {
    let onAppState!: (state: string) => void;
    const removeAppState = jest.fn();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
        onAppState = listener;
        return { remove: removeAppState };
    });
    mockConfig["theme.dynamicColors"] = true;
    const stop = Theme.observeSystemColors();
    await Promise.resolve();
    const mounted = Theme.getTheme();
    mockGetPalette.mockResolvedValue(updatedPalette);
    onAppState("background");
    expect(Theme.getTheme()).toBe(mounted);
    onAppState("active");
    await Promise.resolve();
    expect(Theme.getTheme().colors.primary).toBe(updatedPalette.light.primary);
    mockGetPalette.mockResolvedValue(systemColorPalette);
    mockOnChange();
    await Promise.resolve();
    expect(Theme.getTheme().colors.primary).toBe(systemColorPalette.light.primary);
    mockGetPalette.mockResolvedValue(updatedPalette);
    mockOnChange();
    stop();
    await Promise.resolve();
    expect(Theme.getTheme().colors.primary).toBe(systemColorPalette.light.primary);
    expect(mockRemoveListener).toHaveBeenCalledTimes(1);
    expect(removeAppState).toHaveBeenCalledTimes(1);
});
