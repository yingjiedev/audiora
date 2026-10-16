export interface SearchDiscoveryItem {
    query: string;
    source: "recent" | "favorite";
}

type DiscoveryMusic = Pick<IMusic.IMusicItem, "title" | "artist">;

function keywordKey(value: string) {
    return value.normalize("NFKC").toLocaleLowerCase();
}

/** Suggestions use existing listening data; no provider-specific hot-search API is required. */
export function buildSearchDiscovery(recent: DiscoveryMusic[], favorites: DiscoveryMusic[], history: string[]): SearchDiscoveryItem[] {
    const seen = new Set(history.map(item => keywordKey(item.trim())));
    const candidates: SearchDiscoveryItem[] = [];
    const append = (value: string, source: SearchDiscoveryItem["source"]) => {
        const query = typeof value === "string" ? value.trim() : "";
        if (!query || seen.has(keywordKey(query))) return;
        seen.add(keywordKey(query));
        candidates.push({ query, source });
    };
    // Interleave sources so the first batch is not entirely recent plays.
    for (let index = 0; index < 40; index++) {
        for (const [list, source] of [[recent, "recent"], [favorites, "favorite"]] as const) {
            const music = list[index];
            if (!music) continue;
            append(music.title, source);
            append(music.artist, source);
        }
    }
    return candidates;
}

export function getDiscoveryBatch(items: SearchDiscoveryItem[], batch: number, size = 8) {
    if (!items.length || size < 1) return [];
    const batches = Math.ceil(items.length / size);
    const start = ((batch % batches) + batches) % batches * size;
    return items.slice(start, start + size);
}
