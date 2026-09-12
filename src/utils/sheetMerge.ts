/** 跨平台同曲判定的时长容差（毫秒） */
export const SAME_TRACK_DURATION_TOLERANCE_MS = 5000;

/** 每个音源的输入，按优先级从高到低排列 */
export interface IMergeSource {
    pluginHash: string;
    pluginName: string;
    musicList: IMusic.IMusicItem[];
}

export interface IMergeSourceStat {
    pluginHash: string;
    pluginName: string;
    /** 按现有媒体身份规则去除同源重复后的数量 */
    total: number;
    /** 保留进最终结果的数量 */
    kept: number;
    /** 与更高优先级音源判定为同曲而跳过的数量 */
    duplicates: number;
    /** 因时长缺失而无法可靠判定、因此保留的数量 */
    uncertain: number;
}

export interface IMergeMusicSheetsResult {
    mergedList: IMusic.IMusicItem[];
    stats: IMergeSourceStat[];
}

interface IDurationBucket {
    min: number;
    max: number;
}

interface ITrackIndexEntry {
    durations: Map<number, IDurationBucket>;
    hasMissingDuration: boolean;
}

/**
 * 规范化标题：统一全角字母和数字、大小写及空白。
 * live、伴奏等版本词会保留，避免把不同版本误判成同曲。
 */
export function normalizeTrackTitle(title: string): string {
    return normalizeText(title);
}

/**
 * 规范化歌手：按常见分隔符拆分、规范化后排序，忽略歌手顺序差异。
 */
export function normalizeTrackArtist(artist: string): string {
    const names = artist
        .split(/\s*(?:[/、,，;；&]|feat\.?|ft\.?)\s*/i)
        .map(normalizeText)
        .filter(Boolean)
        .sort();
    return names.join("|");
}

function normalizeText(text: string): string {
    return (text ?? "")
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, char =>
            String.fromCharCode(char.charCodeAt(0) - 0xfee0),
        )
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

/** 时长（秒）转毫秒；缺失或无效时返回 null */
function getDurationMs(item: IMusic.IMusicItem): number | null {
    const duration = Number(item?.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
        return null;
    }
    return duration * 1000;
}

function getTrackKey(item: IMusic.IMusicItem): string {
    return JSON.stringify([
        normalizeTrackTitle(item.title ?? ""),
        normalizeTrackArtist(item.artist ?? ""),
    ]);
}

function getDurationBucket(duration: number): number {
    return Math.floor(duration / SAME_TRACK_DURATION_TOLERANCE_MS);
}

function hasDurationWithinTolerance(
    entry: ITrackIndexEntry,
    duration: number,
): boolean {
    const minimum = duration - SAME_TRACK_DURATION_TOLERANCE_MS;
    const maximum = duration + SAME_TRACK_DURATION_TOLERANCE_MS;
    const firstBucket = getDurationBucket(Math.max(0, minimum));
    const lastBucket = getDurationBucket(maximum);

    for (let bucket = firstBucket; bucket <= lastBucket; bucket += 1) {
        const range = entry.durations.get(bucket);
        if (range && range.max >= minimum && range.min <= maximum) {
            return true;
        }
    }
    return false;
}

function addToTrackIndex(
    index: Map<string, ITrackIndexEntry>,
    item: IMusic.IMusicItem,
) {
    const key = getTrackKey(item);
    let entry = index.get(key);
    if (!entry) {
        entry = {
            durations: new Map<number, IDurationBucket>(),
            hasMissingDuration: false,
        };
        index.set(key, entry);
    }

    const duration = getDurationMs(item);
    if (duration === null) {
        entry.hasMissingDuration = true;
        return;
    }

    const bucketKey = getDurationBucket(duration);
    const bucket = entry.durations.get(bucketKey);
    if (bucket) {
        bucket.min = Math.min(bucket.min, duration);
        bucket.max = Math.max(bucket.max, duration);
    } else {
        entry.durations.set(bucketKey, { min: duration, max: duration });
    }
}

/**
 * 跨平台判断两首歌是否为同一首：标题与歌手规范化后相同，且双方时长
 * 有效、差值不超过五秒。任一方缺时长时保守地视为无法确定。
 */
export function isSameTrack(
    a: IMusic.IMusicItem,
    b: IMusic.IMusicItem,
): boolean {
    const aDuration = getDurationMs(a);
    const bDuration = getDurationMs(b);
    return (
        getTrackKey(a) === getTrackKey(b) &&
        aDuration !== null &&
        bDuration !== null &&
        Math.abs(aDuration - bDuration) <= SAME_TRACK_DURATION_TOLERANCE_MS
    );
}

function dedupeSourceMusicList(
    musicList: IMusic.IMusicItem[],
): IMusic.IMusicItem[] {
    const identities = new Map<string, Set<string>>();
    const uniqueList: IMusic.IMusicItem[] = [];

    for (const item of musicList) {
        let platformIds = identities.get(item.platform);
        if (!platformIds) {
            platformIds = new Set<string>();
            identities.set(item.platform, platformIds);
        }
        if (platformIds.has(item.id)) {
            continue;
        }
        platformIds.add(item.id);
        uniqueList.push(item);
    }
    return uniqueList;
}

/**
 * 按音源优先级合并多个歌单。
 *
 * 同一音源内按现有 platform + id 身份去重；不同音源间使用规范化标题、
 * 歌手和时长索引判重。索引避免随歌单增长重复遍历完整结果列表。
 */
export function mergeMusicSheetsByPriority(
    sources: IMergeSource[],
): IMergeMusicSheetsResult {
    const mergedList: IMusic.IMusicItem[] = [];
    const stats: IMergeSourceStat[] = [];
    const trackIndex = new Map<string, ITrackIndexEntry>();

    for (const source of sources) {
        const uniqueList = dedupeSourceMusicList(source.musicList ?? []);
        const stat: IMergeSourceStat = {
            pluginHash: source.pluginHash,
            pluginName: source.pluginName,
            total: uniqueList.length,
            kept: 0,
            duplicates: 0,
            uncertain: 0,
        };

        for (const item of uniqueList) {
            const key = getTrackKey(item);
            const duration = getDurationMs(item);
            const indexedTrack = trackIndex.get(key);

            if (
                duration !== null &&
                indexedTrack &&
                hasDurationWithinTolerance(indexedTrack, duration)
            ) {
                stat.duplicates += 1;
                continue;
            }

            if (
                duration === null ||
                Boolean(indexedTrack?.hasMissingDuration)
            ) {
                stat.uncertain += 1;
            }

            mergedList.push(item);
            stat.kept += 1;
            addToTrackIndex(trackIndex, item);
        }

        stats.push(stat);
    }

    return { mergedList, stats };
}
