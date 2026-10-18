import Color from "color";
import type { CustomizedColors } from "@/hooks/useColors";
import type { SystemColorPalette } from "@/native/dynamicColors";

/** Adapt Android roles once; business components continue to consume Audiora semantics. */
export function systemThemeColors(palette: SystemColorPalette, dark: boolean): Partial<CustomizedColors> {
    const scheme = dark ? palette.dark : palette.light;
    return {
        primary: scheme.primary,
        onPrimary: scheme.onPrimary,
        text: scheme.onSurface,
        textSecondary: scheme.onSurfaceVariant,
        textHighlight: scheme.primary,
        pageBackground: scheme.surface,
        appBar: scheme.surfaceContainerLow,
        appBarText: scheme.onSurface,
        card: scheme.surfaceContainer,
        surface: scheme.surfaceContainerLow,
        surfaceElevated: scheme.surfaceContainerHigh,
        musicBar: scheme.surfaceContainer,
        musicBarText: scheme.onSurface,
        tabBar: scheme.surfaceContainerLow,
        backdrop: scheme.surfaceContainerHigh,
        placeholder: scheme.surfaceContainerHigh,
        notification: scheme.surfaceContainerHigh,
        border: scheme.outlineVariant,
        divider: Color(scheme.outlineVariant).alpha(0.6).toString(),
        listActive: Color(scheme.primary).alpha(0.12).toString(),
        info: scheme.primary,
        accentWarm: scheme.tertiary,
        accentCool: scheme.primary,
        tonalSurface: scheme.secondaryContainer,
        onTonal: scheme.onSecondaryContainer,
        shadow: palette.dark.surface,
        mask: Color(palette.dark.surface).alpha(dark ? 0.82 : 0.22).toString(),
        darkSurface: palette.dark.surface,
        darkCard: palette.dark.surfaceContainer,
        darkSurfaceElevated: palette.dark.surfaceContainerHigh,
        darkTextSecondary: palette.dark.onSurfaceVariant,
    };
}
