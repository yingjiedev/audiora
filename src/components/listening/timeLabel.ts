import { ILanguageData } from "@/types/core/i18n";

export function listeningTimeLabel(seconds: number, t: (key: keyof ILanguageData, args?: Record<string, number>) => string) {
    if (seconds >= 3600) return t("listening.hoursMinutes", { hours: Math.floor(seconds / 3600), minutes: Math.floor(seconds % 3600 / 60) });
    if (seconds >= 60) return t("listening.minutes", { count: Math.floor(seconds / 60) });
    return t("listening.seconds", { count: Math.floor(seconds) });
}
