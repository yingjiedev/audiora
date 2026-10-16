import type { Plugin } from "@/core/pluginManager";
import { pickHotTopLists } from "@/core/randomPlay";
import type { DiscoveryMusic } from "./searchDiscovery";

const REQUEST_TIMEOUT = 5000;
const CACHE_TTL = 5 * 60 * 1000;
const cache = new WeakMap<Plugin, { music: DiscoveryMusic[]; expiresAt: number }>();
const pending = new WeakMap<Plugin, Promise<DiscoveryMusic[]>>();

function withDeadline<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Chart discovery timed out")), REQUEST_TIMEOUT);
        Promise.resolve().then(request).then(value => {
            clearTimeout(timer);
            resolve(value);
        }, error => {
            clearTimeout(timer);
            reject(error);
        });
    });
}

async function fetchPluginMusic(plugin: Plugin, groups?: IMusic.IMusicSheetGroupItem[]): Promise<DiscoveryMusic[]> {
    try {
        const topLists = groups?.length ? groups : await withDeadline(() => plugin.methods.getTopLists());
        const boards = pickHotTopLists(topLists, 6);
        const selected: IMusic.IMusicSheetItemBase[] = [];
        while (selected.length < 2 && boards.length) {
            selected.push(boards.splice(Math.floor(Math.random() * boards.length), 1)[0]);
        }
        const results = await Promise.all(selected.map(async board => {
            try {
                const result = await withDeadline(() => plugin.methods.getTopListDetail(board, 1));
                return (Array.isArray(result.musicList) ? result.musicList : []).slice(0, 30)
                    .filter(music => typeof music?.title === "string" && music.title.trim())
                    .map(music => ({ title: music.title, artist: music.artist }));
            } catch {
                return [];
            }
        }));
        return results.flat();
    } catch {
        return [];
    }
}

function loadPluginMusic(plugin: Plugin, groups?: IMusic.IMusicSheetGroupItem[]) {
    const cached = cache.get(plugin);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.music);
    const inFlight = pending.get(plugin);
    if (inFlight) return inFlight;
    const request = fetchPluginMusic(plugin, groups).then(music => {
        if (music.length) cache.set(plugin, { music, expiresAt: Date.now() + CACHE_TTL });
        return music;
    }).finally(() => pending.delete(plugin));
    pending.set(plugin, request);
    return request;
}

/** At most two providers, two boards each; requests never touch playback or pushed history. */
export async function loadChartDiscovery(plugins: Plugin[], topListCache: Record<string, IMusic.IMusicSheetGroupItem[]> = {}) {
    const results = await Promise.all(plugins.slice(0, 2).map(plugin => loadPluginMusic(plugin, topListCache[plugin.hash])));
    return results.flat();
}
