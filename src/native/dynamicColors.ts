import { NativeEventEmitter, NativeModules, Platform } from "react-native";

const schemeKeys = [
    "primary", "onPrimary", "secondaryContainer", "onSecondaryContainer", "tertiary",
    "surface", "surfaceContainerLow", "surfaceContainer", "surfaceContainerHigh",
    "onSurface", "onSurfaceVariant", "outlineVariant",
] as const;

export type SystemColorScheme = Record<typeof schemeKeys[number], string>;
export interface SystemColorPalette {
    light: SystemColorScheme;
    dark: SystemColorScheme;
}

interface DynamicColorsNative {
    initialPalette?: unknown;
    getPalette: () => Promise<unknown>;
    addListener: (eventName: string) => void;
    removeListeners: (count: number) => void;
}

const native: DynamicColorsNative | undefined = Platform.OS === "android" && Number(Platform.Version) >= 31
    ? NativeModules.AudioraDynamicColors : undefined;

/** Reject incomplete or malformed vendor palettes as a unit, avoiding mixed fallback colors. */
export function parseSystemColorPalette(value: unknown): SystemColorPalette | null {
    if (!value || typeof value !== "object") return null;
    const palette = value as SystemColorPalette;
    const valid = [palette.light, palette.dark].every(scheme => scheme && schemeKeys.every(key =>
        typeof scheme[key] === "string" && /^#[\da-f]{6}$/i.test(scheme[key]),
    ));
    return valid ? palette : null;
}

const SystemColors = {
    isSupported: !!native,
    getInitialPalette(): SystemColorPalette | null {
        try {
            return parseSystemColorPalette(native?.initialPalette);
        } catch {
            return null;
        }
    },
    async getPalette(): Promise<SystemColorPalette | null> {
        try {
            return parseSystemColorPalette(await native?.getPalette());
        } catch {
            return null;
        }
    },
    addChangeListener(listener: () => void): () => void {
        if (!native) return () => {};
        const subscription = new NativeEventEmitter(native).addListener("AudioraDynamicColorsChanged", listener);
        return () => subscription.remove();
    },
};

export default SystemColors;
