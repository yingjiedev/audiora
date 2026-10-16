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

/** Keep original objects and all sources. Matching is deliberately non-transitive. */
export function groupTracks(items: IMusic.IMusicItem[], previous: TrackGroup[] = []): TrackGroup[] {
    const seen = new Set<string>();
    const groups: TrackGroup[] = [];
    const index = new Map<string, Array<{ group: TrackGroup; min: number; max: number }>>();
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
    for (const item of ordered) {
        const identity = trackSourceKey(item);
        if (seen.has(identity)) continue;
        seen.add(identity);
        const key = metadataKey(item);
        const duration = item.duration * 1000;
        const matches = key ? index.get(key) ?? [] : [];
        const match = matches.find(entry =>
            !entry.group.candidates.some(candidate => candidate.platform === item.platform)
            && Math.max(entry.max, duration) - Math.min(entry.min, duration) <= SAME_TRACK_DURATION_TOLERANCE_MS,
        );
        if (match) {
            match.group.candidates.push(item);
            match.min = Math.min(match.min, duration);
            match.max = Math.max(match.max, duration);
        } else {
            const group = { key: identity, candidates: [item] };
            groups.push(group);
            if (key) {
                matches.push({ group, min: duration, max: duration });
                index.set(key, matches);
            }
        }
    }
    return groups;
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
