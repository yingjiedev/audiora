import Color from "color";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { bestForeground, blendOver, contrastRatio } from "./colorContrast";
import { readableAccent, resolveThemeColors } from "./themeColors";

describe("Audiora semantic colors", () => {
    it.each([false, true])("keeps actual text, controls and state colors readable (dark=%s)", dark => {
        const palette = dark ? darkColors : lightColors;
        const colors = resolveThemeColors({ ...palette, background: "transparent" }, dark);
        const surfaces = [palette.pageBackground, palette.card, palette.surface, palette.surfaceElevated];
        for (const background of surfaces) {
            for (const text of [colors.text, colors.textSecondary, colors.active]) {
                expect(contrastRatio(blendOver(text, background), background)).toBeGreaterThanOrEqual(4.5);
            }
            for (const icon of [colors.favorite, palette.success, palette.danger]) {
                expect(contrastRatio(icon, background)).toBeGreaterThanOrEqual(3);
            }
        }
        expect(colors.favorite).not.toBe(palette.danger);
        expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
        for (let segment = 0; segment < colors.playerGradient.length - 1; segment += 1) {
            for (let sample = 0; sample <= 10; sample += 1) {
                const background = Color(colors.playerGradient[segment]).mix(Color(colors.playerGradient[segment + 1]), sample / 10).hex();
                for (const text of [colors.playerText, colors.playerTextSecondary, colors.playerTextTertiary, colors.active]) {
                    expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
                }
                expect(contrastRatio(colors.favorite, background)).toBeGreaterThanOrEqual(3);
            }
        }
    });

    it("uses the agreed subtle blue surface instead of the brand's mint green", () => {
        const colors = resolveThemeColors({ ...lightColors, background: "transparent" }, false);
        expect(colors.playerGradient).toEqual(["#F3F6FE", "#FBFCFF", "#FFFFFF"]);
        expect(colors.primary).toBe("#3867F4");
        expect(colors.active).toBe(colors.primaryText);
    });

    it.each(["#FFCC00", "#FF7650", "#8A46D9", "#888888"])("follows the custom accent %s without leaking preset blue/green", primary => {
        const input = { ...lightColors, background: "transparent", primary };
        const before = { ...input };
        const colors = resolveThemeColors(input, false);
        expect(colors.primary).toBe(primary);
        expect(colors.playerGradient[0]).not.toBe("#F3F6FE");
        for (const background of [lightColors.card, lightColors.pageBackground, ...colors.playerGradient]) {
            expect(contrastRatio(colors.active, background)).toBeGreaterThanOrEqual(4.5);
        }
        expect(input).toEqual(before);
    });

    it("keeps custom surface RGB while protecting the player from wallpaper transparency", () => {
        const colors = resolveThemeColors({
            ...darkColors, background: "transparent", primary: "#F2F2F2",
            pageBackground: "rgba(0,0,0,0.12)", card: "rgba(18,18,18,0.22)",
            surface: "rgba(20,20,20,0.18)", surfaceElevated: "rgba(29,29,29,0.3)",
        }, true);
        expect(colors.card).toBe("rgba(18,18,18,0.22)");
        expect(colors.playerSurface).toBe("#1D1D1D");
        for (const background of colors.playerGradient) {
            expect(Color(background).alpha()).toBe(1);
            expect(contrastRatio(colors.playerTextSecondary, background)).toBeGreaterThanOrEqual(4.5);
        }
    });

    it("honors configured secondary text and keeps a fallback for old themes", () => {
        const input = { ...lightColors, background: "transparent", textSecondary: "#574B67" };
        expect(resolveThemeColors(input, false).textSecondary).toBe(input.textSecondary);
        expect(resolveThemeColors({ ...input, textSecondary: undefined }, false).textSecondary).toBe(Color(input.text).alpha(0.64).toString());
    });

    it("recovers from an invalid saved primary without throwing", () => {
        expect(resolveThemeColors({ ...lightColors, background: "transparent", primary: "invalid" }, false).primary).toBe(lightColors.primary);
    });

    it("preserves a custom primary's opacity and selects foreground on its rendered fill", () => {
        const primary = "rgba(56,103,244,0.25)";
        const colors = resolveThemeColors({ ...lightColors, background: "transparent", primary }, false);
        expect(Color(colors.primary).alpha()).toBe(0.25);
        expect(contrastRatio(colors.onPrimary, blendOver(colors.primary, lightColors.card))).toBeGreaterThanOrEqual(4.5);
        expect(colors.playerGradient).toEqual(["#F3F6FE", "#FBFCFF", "#FFFFFF"]);
    });

    it("does not overestimate a transparent foreground's contrast", () => {
        expect(bestForeground("#FFFFFF", ["rgba(0,0,0,0.1)", "#10172D"])).toBe("#10172D");
    });

    it("leaves an already readable accent alone and handles impossible mixed surfaces", () => {
        expect(readableAccent("#10172D", ["#FFFFFF"], 4.5)).toBe("#10172D");
        expect(readableAccent("#3867F4", ["#000000", "#FFFFFF"], 21)).toBe("#3867F4");
    });

    it.each([false, true])("keeps tonal badges, warnings and destructive fills readable (dark=%s)", dark => {
        const colors = resolveThemeColors({ ...(dark ? darkColors : lightColors), background: "transparent" }, dark);
        expect(contrastRatio(colors.onTonal, colors.tonalSurface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.onDanger, colors.danger)).toBeGreaterThanOrEqual(4.5);
        for (const background of [colors.card, colors.surface, colors.surfaceElevated, colors.tonalSurface]) {
            for (const foreground of [colors.success, colors.warning, colors.danger]) {
                expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
            }
        }
        for (const background of colors.panelGradient) {
            expect(Color(background).alpha()).toBe(1);
            expect(contrastRatio(colors.textSecondary, background)).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrastRatio(colors.mediaAccent, colors.mediaSurface)).toBeGreaterThanOrEqual(4.5);
    });

    it.each(["#FFCC00", "rgba(255,204,0,0.2)", "#3978FF"])("calibrates a custom control %s without recoloring the user's primary", primary => {
        const colors = resolveThemeColors({ ...lightColors, background: "transparent", primary, danger: "rgba(200,20,40,0.8)" }, false);
        expect(Color(colors.primary).alpha()).toBe(Color(primary).alpha());
        expect(contrastRatio(colors.onTonal, colors.tonalSurface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.onPrimary, blendOver(colors.primary, colors.card))).toBeGreaterThanOrEqual(4.5);
        expect(Color(colors.dangerSurface).alpha()).toBe(0.12);
        expect(contrastRatio(colors.onDanger, colors.danger)).toBeGreaterThanOrEqual(4.5);
        expect(colors.mediaAmbientGradient[0]).toBe(Color(primary).alpha(0.16).toString());
    });

    it("uses opaque custom panel RGB without resetting page surface transparency", () => {
        const colors = resolveThemeColors({ ...darkColors, background: "transparent", surface: "rgba(22,22,22,0.2)", surfaceElevated: "rgba(29,29,29,0.3)" }, true);
        expect(colors.surface).toBe("rgba(22,22,22,0.2)");
        expect(colors.panelGradient).toEqual(["#1D1D1D", "#161616"]);
    });
});
