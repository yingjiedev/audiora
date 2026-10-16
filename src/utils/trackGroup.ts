import { normalizeTrackArtist, normalizeTrackTitle, SAME_TRACK_DURATION_TOLERANCE_MS } from "@/utils/sheetMerge";

export interface TrackGroup {
    key: string;
    candidates: IMusic.IMusicItem[];
    groupId?: string;
    preferredKey?: string;
}

export function trackSourceKey(item: ICommon.IMediaBase): string {
    return JSON.stringify([item.platform, String(item.id)]);
}

function metadataKey(item: IMusic.IMusicItem): string | undefined {
    const title = normalizeTrackTitle(item.title ?? "");
    const artist = normalizeTrackArtist(item.artist ?? "");
    return title && artist && Number.isFinite(item.duration) && item.duration > 0
        ? JSON.stringify([title, artist])
        : undefined;
}

function orderedTracks(items: IMusic.IMusicItem[], previous: TrackGroup[]) {
    // Reuse a visible group's anchor/order when a slower source or later page arrives.
    const byKey = new Map(items.map(item => [trackSourceKey(item), item]));
    const ordered: IMusic.IMusicItem[] = [];
    const queued = new Set<string>();
    for (const group of previous) {
        for (const candidate of group.candidates) {
            const key = trackSourceKey(candidate);
            const current = byKey.get(key);
            if (current && !queued.has(key)) {
                ordered.push(current);
                queued.add(key);
            }
        }
    }
    ordered.push(...items.filter(item => !queued.has(trackSourceKey(item))));
    return ordered;
}

interface GroupEntry {
    position: number;
    min: number;
    max: number;
    platforms: Set<string>;
}

/** Append-only internal index; previously published arrays and rows stay immutable. */
class TrackGroups {
    groups: TrackGroup[] = [];
    private seen = new Set<string>();
    private buckets = new Map<string, GroupEntry[]>();

    append(items: IMusic.IMusicItem[]) {
        let groups = this.groups;
        for (const item of items) {
            const identity = trackSourceKey(item);
            if (this.seen.has(identity)) continue;
            this.seen.add(identity);
            if (groups === this.groups) groups = [...groups];
            const key = metadataKey(item);
            const duration = item.duration * 1000;
            const matches = key ? this.buckets.get(key) ?? [] : [];
            const match = matches.find(entry => !entry.platforms.has(item.platform)
                && Math.max(entry.max, duration) - Math.min(entry.min, duration) <= SAME_TRACK_DURATION_TOLERANCE_MS);
            if (match) {
                const group = groups[match.position];
                groups[match.position] = { ...group, candidates: [...group.candidates, item] };
                match.min = Math.min(match.min, duration);
                match.max = Math.max(match.max, duration);
                match.platforms.add(item.platform);
            } else {
                const position = groups.length;
                groups.push({ key: identity, candidates: [item] });
                if (key) {
                    matches.push({ position, min: duration, max: duration, platforms: new Set([item.platform]) });
                    this.buckets.set(key, matches);
                }
            }
        }
        this.groups = groups;
        return groups;
    }
}

/** Keep original objects and all sources. Matching is deliberately non-transitive. */
export function groupTracks(items: IMusic.IMusicItem[], previous: TrackGroup[] = []): TrackGroup[] {
    return new TrackGroups().append(orderedTracks(items, previous));
}

export interface TrackGroupSource {
    key: string;
    data: IMusic.IMusicItem[];
    /** Changes when a source replaces its data; pagination appends keep this value. */
    dataVersion?: number;
}

/** Retain metadata buckets across source updates instead of regrouping every page. */
export class TrackGroupIndex {
    private index = new TrackGroups();
    private sources: TrackGroupSource[] = [];

    sync(sources: TrackGroupSource[]): TrackGroup[] {
        const rebuild = this.sources.length !== sources.length || sources.some((source, i) => {
            const previous = this.sources[i];
            if (previous?.key !== source.key) return true;
            if (source.data === previous.data || !previous.data.length) return false;
            return source.dataVersion === undefined || source.dataVersion !== previous.dataVersion
                || source.data.length <= previous.data.length
                || source.data[previous.data.length - 1] !== previous.data[previous.data.length - 1];
        });
        if (rebuild) {
            const previous = this.index.groups;
            this.index = new TrackGroups();
            this.index.append(orderedTracks(interleaveTracks(sources.map(source => source.data)), previous));
        } else {
            this.index.append(interleaveTracks(sources.map((source, i) =>
                source.data === this.sources[i].data ? [] : source.data.slice(this.sources[i].data.length),
            )));
        }
        this.sources = sources.map(source => ({ ...source }));
        return this.index.groups;
    }
}

/** Source rank first, then user source order; never sort by response timing. */
export function interleaveTracks(sources: IMusic.IMusicItem[][]): IMusic.IMusicItem[] {
    const result: IMusic.IMusicItem[] = [];
    const length = Math.max(0, ...sources.map(source => source.length));
    for (let rank = 0; rank < length; rank += 1) {
        for (const source of sources) if (source[rank]) result.push(source[rank]);
    }
    return result;
}
