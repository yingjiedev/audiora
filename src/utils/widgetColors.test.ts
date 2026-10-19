import Color from "color";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { contrastRatio } from "./colorContrast";
import { resolveThemeColors, resolveWidgetAppearance } from "./themeColors";

it.each([
    ["light", lightColors, false],
    ["dark", darkColors, true],
    ["bright custom", { ...lightColors, primary: "#FFCC00" }, false],
    ["transparent custom", { ...darkColors, primary: "rgba(116,89,199,0.4)", card: "rgba(18,18,18,0.22)", textSecondary: "#777777" }, true],
] as const)("keeps the %s desktop widget opaque and readable without changing preferences", (_name, input, dark) => {
    const before = { ...input };
    const colors = resolveThemeColors({ ...input, background: input.pageBackground }, dark);
    for (const color of [colors.widgetSurface, colors.widgetPrimary]) expect(Color(color).alpha()).toBe(1);
    for (const foreground of [colors.widgetText, colors.widgetSecondary]) expect(contrastRatio(foreground, colors.widgetSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.widgetPrimary, colors.widgetSurface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(colors.onWidgetPrimary, colors.widgetPrimary)).toBeGreaterThanOrEqual(4.5);
    expect(Color(colors.widgetDiscoverySurface).alpha()).toBe(1);
    expect(contrastRatio(colors.onWidgetDiscovery, colors.widgetDiscoverySurface)).toBeGreaterThanOrEqual(4.5);
    expect(input).toEqual(before);
});

it.each(["#3867F4", "#6D8DFF", "#FFCC00", "rgba(116,89,199,0.4)", "invalid"])("keeps both picker appearances readable for primary %s", primary => {
    for (const dark of [false, true]) {
        const colors = resolveWidgetAppearance(primary, dark);
        expect(colors.surface).toBe(dark ? darkColors.card : lightColors.card);
        for (const color of [colors.surface, colors.primary, colors.discoverySurface]) expect(Color(color).alpha()).toBe(1);
        for (const color of [colors.text, colors.secondary]) expect(contrastRatio(color, colors.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.primary, colors.surface)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(colors.onDiscovery, colors.discoverySurface)).toBeGreaterThanOrEqual(4.5);
    }
});

it("keeps the two chosen styles stable across app theme switches and preserves custom accents", () => {
    const light = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
    const dark = resolveThemeColors({ ...darkColors, background: darkColors.pageBackground }, true);
    expect(light.widgetAppearances).toEqual(dark.widgetAppearances);
    expect(light.widgetAppearances.light.onPrimary).toBe("#FFFFFF");
    expect(light.widgetAppearances.dark.onPrimary).toBe("#FFFFFF");
    const input = { ...lightColors, primary: "#7459C7", background: lightColors.pageBackground };
    const before = { ...input };
    const custom = resolveThemeColors(input, false);
    expect(custom.widgetAppearances.light.primary).not.toBe(light.widgetAppearances.light.primary);
    expect(custom.widgetAppearances.dark.primary).not.toBe(light.widgetAppearances.dark.primary);
    expect(input).toEqual(before);
});
