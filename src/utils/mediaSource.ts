import { normalizeAudioMeta } from "@/utils/localQuality";
import {
    convertLegacyQuality,
    parseQualityText,
} from "@/utils/qualities";

/** Normalize and preserve source metadata supplied by third-party plugins. */
export function normalizePluginMediaSourceResult(
    source: IPlugin.IMediaSourceResult,
): IPlugin.IMediaSourceResult {
    const quality =
        typeof source.quality === "string" && source.quality.trim()
            ? parseQualityText(source.quality.trim()) ??
                convertLegacyQuality(source.quality.trim())
            : undefined;
    return {
        ...source,
        userAgent: source.userAgent ?? source.headers?.["user-agent"],
        quality,
        audioMeta: normalizeAudioMeta(source.audioMeta),
    };
}
