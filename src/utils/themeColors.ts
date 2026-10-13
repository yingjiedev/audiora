import Color from "color";
import type { CustomizedColors } from "@/hooks/useColors";
import {
    colorContrastMinimum, controlNeutralDark, darkColors, lightColors, mediaOnDark,
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
    const accentWarm = safeColor(colors.accentWarm, preset.accentWarm).toString();
    const page = safeColor(colors.pageBackground ?? (colors.background === "transparent" ? preset.pageBackground : colors.background), preset.pageBackground).alpha(1).hex();
    const card = safeColor(colors.card, preset.card).toString();
    const surface = colors.surface ?? card;
    const surfaceElevated = colors.surfaceElevated ?? Color(card).lighten(dark ? 0.24 : 0.12).toString();
    // The panel itself is opaque so wallpaper cannot invalidate foreground contrast.
    // Its surroundings remain transparent; preserve the selected surface RGB.
    const playerSurface = safeColor(dark ? surfaceElevated : colors.musicBar ?? card, preset.surfaceElevated).alpha(1).hex();
    const playerTint = Color(accentWarm).alpha(1);
    const playerGradient = playerTintWeights.map(weight => Color(playerSurface).mix(playerTint, weight).hex());
    const playerText = Color(bestForeground(playerGradient[0], [colors.musicBarText ?? colors.text, preset.text, lightColors.text, mediaOnDark])).alpha(1).hex();
    const playerTextSecondary = readableAccent(Color(playerText).mix(Color(playerSurface), 0.28).hex(), playerGradient, colorContrastMinimum.text);
    const playerTextTertiary = readableAccent(Color(playerText).mix(Color(playerSurface), 0.36).hex(), playerGradient, colorContrastMinimum.text);
    const tonalSurface = Color(blendOver(card, page)).mix(Color(primaryOpaque), 0.16).hex();
    const cardBackground = blendOver(card, page);
    const cardInset = Color(tonalSurface).mix(Color(blendOver(surface, page)), 0.25).hex();
    const insetBackgrounds = [cardBackground, cardInset];
    const onCardInset = readableAccent(safeColor(colors.text, preset.text).hex(), insetBackgrounds, colorContrastMinimum.text);
    const onCardInsetSecondary = readableAccent(safeColor(colors.textSecondary, preset.textSecondary).hex(), insetBackgrounds, colorContrastMinimum.text);
    // Featured listening cards use the user's primary hue at full opacity.
    // Separate surfaces keep text legible without changing persisted theme settings.
    const featuredSurface = primaryOpaque;
    const featuredFoldSurface = Color(primaryOpaque).mix(safeColor(colors.text, preset.text), 0.10).hex();
    const featuredCompanionSurface = Color(primaryOpaque).mix(safeColor(colors.accentWarm, preset.accentWarm).alpha(1), 0.38).darken(0.08).hex();
    const featuredBackgrounds = [featuredSurface, featuredFoldSurface];
    const onFeatured = readableAccent(bestForeground(featuredSurface, [mediaOnDark, lightColors.text, controlNeutralDark]), featuredBackgrounds, colorContrastMinimum.text);
    const onFeaturedSecondary = readableAccent(Color(onFeatured).mix(Color(featuredSurface), 0.12).hex(), featuredBackgrounds, colorContrastMinimum.text);
    const onFeaturedCompanion = contrastRatio(onFeatured, featuredCompanionSurface) >= colorContrastMinimum.text ? onFeatured
        : readableAccent(bestForeground(featuredCompanionSurface, [colors.text, preset.text, mediaOnDark, lightColors.text]), [featuredCompanionSurface], colorContrastMinimum.text);
    const onFeaturedCompanionSecondary = readableAccent(Color(onFeaturedCompanion).mix(Color(featuredCompanionSurface), 0.20).hex(), [featuredCompanionSurface], colorContrastMinimum.text);
    // Two media appearances share opaque, local surfaces; neither rewrites the app theme.
    const featuredWindowSurface = cardBackground;
    const featuredWindowFoldSurface = Color(cardBackground).mix(Color(primaryOpaque), 0.035).hex();
    const windowBackgrounds = [featuredWindowSurface, featuredWindowFoldSurface];
    const onFeaturedWindow = readableAccent(safeColor(colors.text, preset.text).hex(), windowBackgrounds, colorContrastMinimum.text);
    const onFeaturedWindowSecondary = readableAccent(safeColor(colors.textSecondary, preset.textSecondary).hex(), windowBackgrounds, colorContrastMinimum.text);
    const featuredRecordSurface = Color(darkColors.card).mix(Color(primaryOpaque), 0.04).hex();
    const featuredRecordFoldSurface = Color(featuredRecordSurface).mix(Color(mediaScrim), 0.04).hex();
    const featuredRecordTextureOpacity = 0.28;
    const recordBackgrounds = [featuredRecordSurface, featuredRecordFoldSurface, Color(featuredRecordSurface).mix(Color(mediaOnDark), featuredRecordTextureOpacity).hex()];
    const onFeaturedRecord = readableAccent(mediaOnDark, recordBackgrounds, colorContrastMinimum.text);
    const onFeaturedRecordSecondary = readableAccent(Color(onFeaturedRecord).mix(Color(featuredRecordSurface), 0.14).hex(), recordBackgrounds, colorContrastMinimum.text);
    const featuredActionSurface = primaryOpaque;
    const onFeaturedAction = bestForeground(featuredActionSurface, [mediaOnDark, lightColors.text, controlNeutralDark]);
    const backgrounds = [page, blendOver(card, page), blendOver(surface, page), blendOver(surfaceElevated, page), tonalSurface, ...playerGradient];
    const primaryText = readableAccent(primaryOpaque, backgrounds, colorContrastMinimum.text);
    const activityUnrecorded = Color(cardBackground).mix(Color(onCardInsetSecondary), 0.10).hex();
    const activityEmpty = Color(cardBackground).mix(Color(onCardInsetSecondary), 0.18).hex();
    const activityBackgrounds = [cardBackground, activityUnrecorded, activityEmpty];
    const activityOutline = readableAccent(Color(onCardInsetSecondary).mix(Color(cardBackground), 0.5).hex(), activityBackgrounds, colorContrastMinimum.control);
    const activityLow = readableAccent(Color(primaryOpaque).mix(Color(blendOver(card, page)), 0.5).hex(), activityBackgrounds, colorContrastMinimum.control);
    const activityStrong = readableAccent(primaryText, activityBackgrounds, colorContrastMinimum.text);
    const activityLevels = [0, 0.33, 0.66, 1].map(weight => readableAccent(Color(activityLow).mix(Color(activityStrong), weight).hex(), activityBackgrounds, colorContrastMinimum.control));
    const danger = readableAccent(safeColor(colors.danger, preset.danger).hex(), backgrounds, colorContrastMinimum.text);
    return {
        ...colors,
        primary,
        primaryText,
        active: primaryText,
        favorite: readableAccent(safeColor(colors.favorite, preset.favorite).hex(), backgrounds, colorContrastMinimum.control),
        onPrimary: bestForeground(blendOver(primary, blendOver(card, page)), [mediaOnDark, lightColors.text, controlNeutralDark]),
        tonalSurface,
        onTonal: readableAccent(primaryOpaque, [tonalSurface], colorContrastMinimum.text),
        cardInset,
        onCardInset,
        onCardInsetSecondary,
        featuredSurface,
        featuredFoldSurface,
        featuredCompanionSurface,
        onFeatured,
        onFeaturedSecondary,
        onFeaturedCompanion,
        onFeaturedCompanionSecondary,
        featuredWindowSurface, featuredWindowFoldSurface, onFeaturedWindow, onFeaturedWindowSecondary,
        featuredRecordSurface, featuredRecordFoldSurface, featuredRecordTextureOpacity, onFeaturedRecord, onFeaturedRecordSecondary,
        featuredActionSurface, onFeaturedAction,
        activityUnrecorded,
        activityEmpty,
        activityOutline,
        activityLevels,
        success: readableAccent(safeColor(colors.success, preset.success).hex(), backgrounds, colorContrastMinimum.text),
        warning: readableAccent(safeColor(colors.warning, preset.warning).hex(), backgrounds, colorContrastMinimum.text),
        danger,
        onDanger: bestForeground(danger, [mediaOnDark, lightColors.text, controlNeutralDark]),
        dangerSurface: Color(safeColor(colors.danger, preset.danger)).alpha(0.12).toString(),
        divider: colors.divider ?? preset.divider,
        shadow: colors.shadow ?? preset.shadow,
        mask: colors.mask ?? preset.mask,
        modalScrim: Color(preset.mask).alpha(1).hex(),
        inverseSurface: mediaOnDark,
        onInverse: lightColors.text,
        onMedia: mediaOnDark,
        onMediaSecondary: Color(mediaOnDark).alpha(0.86).toString(),
        onMediaTrack: Color(mediaOnDark).alpha(0.28).toString(),
        onMediaSurface: Color(mediaOnDark).alpha(0.16).toString(),
        onMediaScrim: mediaScrim,
        mediaSurface: darkColors.surface,
        mediaAccent: readableAccent(primaryOpaque, [mediaScrim, darkColors.surface], colorContrastMinimum.text),
        mediaFavorite: readableAccent(safeColor(colors.favorite, preset.favorite).hex(), [mediaScrim], colorContrastMinimum.control),
        mediaAmbientGradient: [Color(primaryOpaque).alpha(0.16).toString(), Color(primaryOpaque).alpha(0.18).toString(), Color(accentWarm).alpha(0.24).toString()],
        panelGradient: [Color(surfaceElevated).alpha(1).hex(), Color(surface).alpha(1).hex()],
        textSecondary: colors.textSecondary ?? Color(colors.text).alpha(0.64).toString(),
        surface,
        surfaceElevated,
        border: colors.border ?? Color(colors.text).alpha(0.12).toString(),
        listActive: colors.listActive ?? Color(primary).alpha(0.12).toString(),
        accentWarm,
        accentCool: colors.accentCool ?? colors.info ?? primary,
        background: colors.pageBackground ?? colors.background,
        playerSurface, playerGradient, playerText, playerTextSecondary, playerTextTertiary,
    };
}
