import Mp3Util from "@/native/mp3Util";
import { mapLocalQuality } from "@/utils/localQuality";
import {
    convertLegacyQuality,
    parseQualityText,
} from "@/utils/qualities";

const PROBE_TIMEOUT_MS = 12000;
const POSITIVE_CACHE_TTL_MS = 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;

interface IQualityCacheEntry {
    expiresAt: number;
    quality: IMusic.IQualityKey | null;
}

const qualityCache = new Map<string, IQualityCacheEntry>();
const inFlightProbes = new Map<string, Promise<IMusic.IQualityKey | null>>();

function normalizeReportedQuality(
    quality?: IMusic.IQualityKey | null,
): IMusic.IQualityKey | null {
    if (typeof quality !== "string" || !quality.trim()) {
        return null;
    }
    const trimmed = quality.trim();
    return parseQualityText(trimmed) ?? convertLegacyQuality(trimmed);
}

/**
 * Prefer an explicit plugin-reported quality, then fall back to technical
 * metadata included with the source. A requested quality is intentionally not
 * accepted here because plugins may silently downgrade it.
 */
export function getImmediateActualQuality(
    source?: IPlugin.IMediaSourceResult | null,
): IMusic.IQualityKey | null {
    const reportedQuality = normalizeReportedQuality(source?.quality);
    if (reportedQuality) {
        return reportedQuality;
    }
    return mapLocalQuality(source?.audioMeta);
}

function hashHeaders(headers?: Record<string, string>): string {
    if (!headers) {
        return "0";
    }
    const serialized = Object.entries(headers)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key.toLowerCase()}:${value}`)
        .join("\n");
    let hash = 5381;
    for (let index = 0; index < serialized.length; index++) {
        hash = (hash * 33 + serialized.charCodeAt(index)) % 2147483647;
    }
    return hash.toString(36);
}

function getCacheKey(source: IPlugin.IMediaSourceResult): string | null {
    if (!source.url) {
        return null;
    }
    return `${source.url}\u0000${hashHeaders(source.headers)}`;
}

function readCache(key: string): IMusic.IQualityKey | null | undefined {
    const entry = qualityCache.get(key);
    if (!entry) {
        return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
        qualityCache.delete(key);
        return undefined;
    }
    // Refresh insertion order to keep the cache approximately LRU.
    qualityCache.delete(key);
    qualityCache.set(key, entry);
    return entry.quality;
}

function writeCache(key: string, quality: IMusic.IQualityKey | null) {
    qualityCache.set(key, {
        quality,
        expiresAt:
            Date.now() +
            (quality ? POSITIVE_CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
    });
    while (qualityCache.size > MAX_CACHE_ENTRIES) {
        const oldestKey = qualityCache.keys().next().value;
        if (typeof oldestKey !== "string") {
            break;
        }
        qualityCache.delete(oldestKey);
    }
}

async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
): Promise<T | undefined> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            promise,
            new Promise<undefined>(resolve => {
                timeout = setTimeout(() => resolve(undefined), timeoutMs);
            }),
        ]);
    } catch {
        return undefined;
    } finally {
        if (timeout) {
            clearTimeout(timeout);
        }
    }
}

/**
 * Best-effort online-source probe. It never blocks playback callers, coalesces
 * concurrent work for the same authenticated URL, and caches failures briefly.
 */
export async function probeActualAudioQuality(
    source?: IPlugin.IMediaSourceResult | null,
): Promise<IMusic.IQualityKey | null> {
    const immediateQuality = getImmediateActualQuality(source);
    if (immediateQuality || !source) {
        return immediateQuality;
    }

    const cacheKey = getCacheKey(source);
    if (!cacheKey) {
        return null;
    }
    const cachedQuality = readCache(cacheKey);
    if (cachedQuality !== undefined) {
        return cachedQuality;
    }
    const existingProbe = inFlightProbes.get(cacheKey);
    if (existingProbe) {
        return existingProbe;
    }

    const probe = (async () => {
        const meta = await withTimeout(
            Mp3Util.getAudioMeta(source.url!, source.headers),
            PROBE_TIMEOUT_MS,
        );
        const quality = mapLocalQuality(meta);
        writeCache(cacheKey, quality);
        return quality;
    })().finally(() => {
        inFlightProbes.delete(cacheKey);
    });
    inFlightProbes.set(cacheKey, probe);
    return probe;
}

export function resetAudioQualityProbeCacheForTests() {
    qualityCache.clear();
    inFlightProbes.clear();
}
