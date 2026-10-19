export interface SearchDiscoveryItem {
    query: string;
    source: "recent" | "favorite" | "chart";
}

export type DiscoveryMusic = Pick<IMusic.IMusicItem, "title" | "artist">;

function keywordKey(value: string) {
    return value.normalize("NFKC").toLocaleLowerCase();
}

/** All sources share keyword deduplication; chart entries contribute song titles only. */
export function buildSearchDiscovery(recent: DiscoveryMusic[], favorites: DiscoveryMusic[], history: string[], charts: DiscoveryMusic[] = []): SearchDiscoveryItem[] {
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
    charts.forEach(music => append(music.title, "chart"));
    return candidates;
}

function cycleBatch(items: SearchDiscoveryItem[], batch: number, size: number) {
    if (!items.length || size < 1) return [];
    const batches = Math.ceil(items.length / size);
    const start = ((batch % batches) + batches) % batches * size;
    return items.slice(start, start + size);
}

export function getDiscoveryBatch(items: SearchDiscoveryItem[], batch: number, size = 8, rng = Math.random) {
    if (!items.length || size < 1) return [];
    const charts = items.filter(item => item.source === "chart");
    const personal = items.filter(item => item.source !== "chart");
    if (!charts.length) return cycleBatch(personal, batch, size);
    const result = cycleBatch(personal, batch, size - Math.min(2, charts.length, size));
    const candidates = [...charts];
    // Draw without replacement and insert at random positions, preserving personal order.
    while (result.length < size && candidates.length) {
        const picked = candidates.splice(Math.floor(rng() * candidates.length), 1)[0];
        result.splice(Math.floor(rng() * (result.length + 1)), 0, picked);
    }
    return result;
}
