import Color from "color";
import { darkColors, lightColors } from "@/constants/colorPalette";
import type { SystemColorPalette, SystemColorScheme } from "@/native/dynamicColors";
import { systemColorPalette } from "./__tests__/fixtures/systemColorPalette";
import { blendOver, contrastRatio } from "./colorContrast";
import { resolveThemeColors } from "./themeColors";
import { systemThemeColors } from "./systemThemeColors";

function rotatePalette(degrees: number): SystemColorPalette {
    const rotate = (scheme: SystemColorScheme): SystemColorScheme => Object.fromEntries(
        Object.entries(scheme).map(([key, value]) => [key, Color(value).rotate(degrees).hex()]),
    ) as SystemColorScheme;
    return { light: rotate(systemColorPalette.light), dark: rotate(systemColorPalette.dark) };
}

const palettes = [
    ["green", systemColorPalette],
    ["purple", rotatePalette(120)],
    ["warm", rotatePalette(240)],
] as const;

describe.each(palettes)("system %s palette", (_name, palette) => {
    it.each([false, true])("maps the complete theme and preserves system role pairs (dark=%s)", dark => {
        const before = JSON.stringify(palette);
        const scheme = dark ? palette.dark : palette.light;
        const source = {
            ...(dark ? darkColors : lightColors),
            background: "transparent",
            ...systemThemeColors(palette, dark),
        };
        const colors = resolveThemeColors(source, dark);
        expect(colors.primary).toBe(scheme.primary);
        expect(colors.pageBackground).toBe(scheme.surface);
        expect(colors.card).toBe(scheme.surfaceContainer);
        expect(colors.surfaceElevated).toBe(scheme.surfaceContainerHigh);
        expect(colors.accentWarm).toBe(Color(scheme.tertiary).toString());
        expect(colors.tonalSurface).toBe(scheme.secondaryContainer);
        expect(colors.onTonal).toBe(scheme.onSecondaryContainer);
        expect(colors.onPrimary).toBe(scheme.onPrimary);
        expect(colors.mediaSurface).toBe(palette.dark.surface);
        expect(contrastRatio(colors.featuredRecordSurface, palette.dark.surfaceContainer)).toBeLessThan(1.15);
        const presetColors = dark ? darkColors : lightColors;
        const preset = resolveThemeColors({ ...presetColors, background: "transparent" }, dark);
        expect(colors.featuredRecordSurface).not.toBe(preset.featuredRecordSurface);
        expect(JSON.stringify(palette)).toBe(before);
        expect(source.primary).toBe(scheme.primary);
    });

    it.each([false, true])("keeps controls, player gradients and actual surfaces readable (dark=%s)", dark => {
        const input = {
            ...(dark ? darkColors : lightColors),
            background: "transparent",
            ...systemThemeColors(palette, dark),
        };
        // Exercise the same alpha multiplication as the runtime opacity setting.
        const colors = resolveThemeColors({
            ...input,
            card: Color(input.card).alpha(0.5).toString(),
            surface: Color(input.surface).alpha(0.5).toString(),
            surfaceElevated: Color(input.surfaceElevated).alpha(0.5).toString(),
        }, dark);
        const surfaces = [colors.pageBackground!, blendOver(colors.card, colors.pageBackground!),
            blendOver(colors.surface, colors.pageBackground!), blendOver(colors.surfaceElevated, colors.pageBackground!)];
        for (const surface of surfaces) {
            for (const text of [colors.text, colors.textSecondary, colors.primaryText, colors.success, colors.danger, colors.warning]) {
                expect(contrastRatio(blendOver(text, surface), surface)).toBeGreaterThanOrEqual(4.5);
            }
            expect(contrastRatio(colors.favorite, surface)).toBeGreaterThanOrEqual(3);
        }
        expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.onTonal, colors.tonalSurface)).toBeGreaterThanOrEqual(4.5);
        const gradientBackgrounds = (stops: string[]) => stops.flatMap((stop, index) => index === stops.length - 1 ? [stop]
            : Array.from({ length: 21 }, (_, step) => Color(stop).mix(Color(stops[index + 1]), step / 20).hex()));
        for (const surface of gradientBackgrounds(colors.playerGradient)) {
            for (const text of [colors.playerText, colors.playerTextSecondary, colors.playerTextTertiary]) {
                expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5);
            }
        }
        for (const surface of [...gradientBackgrounds(colors.featuredRecordGradient), ...gradientBackgrounds(colors.featuredRecordFoldGradient)]) {
            for (const text of [colors.onFeaturedRecord, colors.onFeaturedRecordSecondary]) {
                expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5);
            }
        }
        for (const activity of colors.activityLevels) {
            for (const surface of [surfaces[1], colors.activityUnrecorded, colors.activityEmpty]) {
                expect(contrastRatio(activity, surface)).toBeGreaterThanOrEqual(3);
            }
        }
    });
});

it("calibrates invalid role pair contrast against its actual fill without altering the source", () => {
    const source = {
        ...lightColors,
        background: "transparent",
        ...systemThemeColors(systemColorPalette, false),
        onPrimary: systemColorPalette.light.primary,
        onTonal: systemColorPalette.light.secondaryContainer,
    };
    const before = { ...source };
    const colors = resolveThemeColors(source, false);
    expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.onTonal, colors.tonalSurface)).toBeGreaterThanOrEqual(4.5);
    expect(source).toEqual(before);
});
