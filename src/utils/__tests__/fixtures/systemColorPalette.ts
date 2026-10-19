import type { SystemColorPalette } from "@/native/dynamicColors";

/** Representative opaque Android dynamic roles, including distinct surface containers. */
export const systemColorPalette: SystemColorPalette = {
    light: {
        primary: "#386A20",
        onPrimary: "#FFFFFF",
        secondaryContainer: "#D7E8CD",
        onSecondaryContainer: "#121F0E",
        tertiary: "#006874",
        surface: "#F8FAF0",
        surfaceContainerLow: "#F2F5EB",
        surfaceContainer: "#ECF0E5",
        surfaceContainerHigh: "#E6EADD",
        onSurface: "#191D17",
        onSurfaceVariant: "#43483E",
        outlineVariant: "#C3C8BB",
    },
    dark: {
        primary: "#9DD67D",
        onPrimary: "#0A3900",
        secondaryContainer: "#3B4B34",
        onSecondaryContainer: "#D7E8CD",
        tertiary: "#4FD8EB",
        surface: "#10140E",
        surfaceContainerLow: "#191D17",
        surfaceContainer: "#1D211B",
        surfaceContainerHigh: "#272B25",
        onSurface: "#E0E4D9",
        onSurfaceVariant: "#C3C8BB",
        outlineVariant: "#43483E",
    },
};
