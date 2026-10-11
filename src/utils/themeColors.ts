import Color from "color";
import type { CustomizedColors } from "@/hooks/useColors";
import {
    colorContrastMinimum, darkColors, lightColors, mediaOnDark,
    mediaScrim, playerTintWeights,
} from "@/constants/colorPalette";
import { bestForeground, blendOver, contrastRatio } from "./colorContrast";

function safeColor(value: string | undefined, fallback: string) {
    try {
        return Color(value ?? fallback);
    } catch {
        return Color(fallback);
    }
}

/** Adjust lightness within the chosen hue; mixed incompatible surfaces may need local overrides. */
export function readableAccent(accent: string, backgrounds: readonly string[], minimum: number) {
    const original = Color(accent).alpha(1);
    const passes = (candidate: Color) => backgrounds.every(background => contrastRatio(candidate.hex(), background) >= minimum);
    if (passes(original)) return original.hex();
    const lightness = original.lightness();
    for (let step = 1; step <= 100; step += 1) {
        for (const direction of [-1, 1]) {
            const next = lightness + direction * step;
            if (next < 0 || next > 100) continue;
            const candidate = original.lightness(next);
            if (passes(candidate)) return candidate.hex();
        }
    }
    // One foreground cannot necessarily serve unrelated black and white custom surfaces.
    return original.hex();
}

/** Pure theme derivation shared by the hook, native components and contrast tests. */
export function resolveThemeColors(colors: CustomizedColors, dark: boolean) {
    const preset = dark ? darkColors : lightColors;
    const primaryColor = safeColor(colors.primary, preset.primary);
    const primary = primaryColor.alpha() < 1 ? primaryColor.toString() : primaryColor.hex();
    const primaryOpaque = primaryColor.alpha(1).hex();
    const page = safeColor(colors.pageBackground ?? (colors.background === "transparent" ? preset.pageBackground : colors.background), preset.pageBackground).alpha(1).hex();
    const card = safeColor(colors.card, preset.card).toString();
    const surface = colors.surface ?? card;
    const surfaceElevated = colors.surfaceElevated ?? Color(card).lighten(dark ? 0.24 : 0.12).toString();
    // The panel itself is opaque so wallpaper cannot invalidate foreground contrast.
    // Its surroundings remain transparent; preserve the selected surface RGB.
    const playerSurface = safeColor(dark ? surfaceElevated : colors.musicBar ?? card, preset.surfaceElevated).alpha(1).hex();
    const playerGradient = playerTintWeights.map(weight => Color(playerSurface).mix(Color(primaryOpaque), weight).hex());
    const playerText = Color(bestForeground(playerGradient[0], [colors.musicBarText ?? colors.text, preset.text, lightColors.text, mediaOnDark])).alpha(1).hex();
    const playerTextSecondary = Color(playerText).mix(Color(playerSurface), 0.28).hex();
    const playerTextTertiary = Color(playerText).mix(Color(playerSurface), 0.36).hex();
    const backgrounds = [page, blendOver(card, page), blendOver(surface, page), blendOver(surfaceElevated, page), ...playerGradient];
    const primaryText = readableAccent(primaryOpaque, backgrounds, colorContrastMinimum.text);
    return {
        ...colors,
        primary,
        primaryText,
        active: primaryText,
        favorite: readableAccent(safeColor(colors.favorite, preset.favorite).hex(), backgrounds, colorContrastMinimum.control),
        onPrimary: bestForeground(blendOver(primary, blendOver(card, page)), [mediaOnDark, lightColors.text]),
        onMedia: mediaOnDark,
        onMediaSecondary: Color(mediaOnDark).alpha(0.72).toString(),
        onMediaTrack: Color(mediaOnDark).alpha(0.28).toString(),
        onMediaScrim: mediaScrim,
        textSecondary: colors.textSecondary ?? Color(colors.text).alpha(0.64).toString(),
        surface,
        surfaceElevated,
        border: colors.border ?? Color(colors.text).alpha(0.12).toString(),
        listActive: colors.listActive ?? Color(primary).alpha(0.12).toString(),
        accentWarm: colors.accentWarm ?? primary,
        accentCool: colors.accentCool ?? colors.info ?? primary,
        background: colors.pageBackground ?? colors.background,
        playerSurface, playerGradient, playerText, playerTextSecondary, playerTextTertiary,
    };
}
