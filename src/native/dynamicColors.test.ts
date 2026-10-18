import { systemColorPalette } from "@/utils/__tests__/fixtures/systemColorPalette";

const mockNative = {
    initialPalette: systemColorPalette as unknown,
    getPalette: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
};
const mockPlatform = { OS: "android", Version: 34 };
const mockModules = { AudioraDynamicColors: mockNative as typeof mockNative | undefined };
const mockRemove = jest.fn();
const mockAddListener = jest.fn(() => ({ remove: mockRemove }));

jest.mock("react-native", () => ({
    Platform: mockPlatform,
    NativeModules: mockModules,
    NativeEventEmitter: jest.fn(() => ({ addListener: mockAddListener })),
}));

function loadModule() {
    let loaded!: typeof import("./dynamicColors");
    jest.isolateModules(() => {
        loaded = require("./dynamicColors");
    });
    return loaded;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockPlatform.OS = "android";
    mockPlatform.Version = 34;
    mockModules.AudioraDynamicColors = mockNative;
    mockNative.initialPalette = systemColorPalette;
    mockNative.getPalette.mockResolvedValue(systemColorPalette);
});

it("provides an initial snapshot and fresh native colors without converting roles", async () => {
    const colors = loadModule().default;
    expect(colors.isSupported).toBe(true);
    expect(colors.getInitialPalette()).toEqual(systemColorPalette);
    expect(await colors.getPalette()).toEqual(systemColorPalette);
});

it.each([null, {}, { light: systemColorPalette.light }, {
    ...systemColorPalette, dark: { ...systemColorPalette.dark, primary: "broken" },
}, {
    ...systemColorPalette, light: { ...systemColorPalette.light, surface: "rgba(0,0,0,0.2)" },
}])("rejects an incomplete or non-opaque palette: %p", input => {
    expect(loadModule().parseSystemColorPalette(input)).toBeNull();
});

it.each([["ios", 34], ["android", 30]] as const)("does not access Android resources on %s %s", async (os, version) => {
    mockPlatform.OS = os;
    mockPlatform.Version = version;
    const colors = loadModule().default;
    expect(colors.isSupported).toBe(false);
    expect(colors.getInitialPalette()).toBeNull();
    expect(await colors.getPalette()).toBeNull();
    colors.addChangeListener(jest.fn())();
    expect(mockNative.getPalette).not.toHaveBeenCalled();
    expect(mockAddListener).not.toHaveBeenCalled();
});

it("falls back when native resources are unavailable or a read fails", async () => {
    mockNative.initialPalette = null;
    mockNative.getPalette.mockRejectedValue(new Error("vendor resource unavailable"));
    const colors = loadModule().default;
    expect(colors.getInitialPalette()).toBeNull();
    expect(await colors.getPalette()).toBeNull();
    mockNative.getPalette.mockResolvedValue({ light: systemColorPalette.light });
    expect(await colors.getPalette()).toBeNull();
});

it("falls back safely if an older binary does not have the native module", async () => {
    mockModules.AudioraDynamicColors = undefined;
    const colors = loadModule().default;
    expect(colors.isSupported).toBe(false);
    expect(colors.getInitialPalette()).toBeNull();
    expect(await colors.getPalette()).toBeNull();
});

it("removes the native change subscription", () => {
    const callback = jest.fn();
    const remove = loadModule().default.addChangeListener(callback);
    expect(mockAddListener).toHaveBeenCalledWith("AudioraDynamicColorsChanged", callback);
    remove();
    expect(mockRemove).toHaveBeenCalledTimes(1);
});
