/** Raw palette. UI components consume useColors(), never these preset values. */
export const lightColors = {
    text: "#10172D",
    textSecondary: "#5B657C",
    primary: "#3867F4",
    pageBackground: "#F6F9FF",
    shadow: "#2D4A78",
    appBar: "#F6F9FF",
    appBarText: "#10172D",
    musicBar: "#FFFFFF",
    musicBarText: "#10172D",
    divider: "rgba(45,67,105,0.10)",
    border: "rgba(75,103,148,0.12)",
    listActive: "rgba(56,103,244,0.10)",
    mask: "rgba(16,23,45,0.22)",
    backdrop: "#EEF4FF",
    surface: "#EEF4FF",
    surfaceElevated: "#FFFFFF",
    accentWarm: "#B26EF3",
    accentCool: "#00AEEA",
    tabBar: "#F1F6FF",
    placeholder: "#E9F0FC",
    success: "#08735C",
    warning: "#8C5C00",
    danger: "#C62E43",
    favorite: "#F23F70",
    info: "#3867F4",
    card: "#FFFFFF",
    notification: "#EEF4FF",
};

export const darkColors = {
    text: "#F7FAFF",
    textSecondary: "#B6C1D8",
    primary: "#6D8DFF",
    pageBackground: "#090F1F",
    shadow: "#000000",
    appBar: "#0C1424",
    appBarText: "#F7FAFF",
    musicBar: "#1A2642",
    musicBarText: "#F7FAFF",
    divider: "rgba(198,214,255,0.16)",
    border: "rgba(198,214,255,0.20)",
    listActive: "rgba(109,141,255,0.15)",
    mask: "rgba(10,8,14,0.82)",
    backdrop: "#131C31",
    surface: "#131C31",
    surfaceElevated: "#212E4E",
    accentWarm: "#B878FF",
    accentCool: "#25C7F4",
    tabBar: "#131C31",
    placeholder: "#1C2843",
    success: "#20D2B0",
    warning: "#FFD074",
    danger: "#FF7A88",
    favorite: "#FF648B",
    info: "#6D8DFF",
    card: "#18233C",
    notification: "#131C31",
};

/** Decorative branding only; intentionally excluded from control surfaces. */
export const audioraGradient = ["#00DDB5", "#00BDF2", "#3B82F6", "#6366F1", "#B26EF3"] as const;
export const topListGradients = [
    ["#00DDB5", "#3B82F6"],
    ["#00BDF2", "#6366F1"],
    ["#3B82F6", "#B26EF3"],
    ["#22C7A9", "#667EEA"],
    ["#4F7DFF", "#D16BA5"],
] as const;

/** Immersive cover surfaces always use a dark scrim, independently of theme. */
export const mediaOnDark = "#FFFFFF";
export const controlNeutralDark = "#000000";
export const mediaScrim = "#050C1C";
export const neutralFallbackPrimary = "#F2F2F2";

export const colorContrastMinimum = { text: 4.5, control: 3 } as const;
/** Visible decorative purple at the top, fading into the selected panel surface. */
export const playerTintWeights = [0.28, 0.12, 0] as const;
