import { atom, getDefaultStore, useAtomValue } from "jotai";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { addListeningInterval, ListeningProgressTracker, restoreListeningData } from "./listeningStatsModel";

const storage = getOrCreateMMKV("music.ListeningStats");
function load() {
    try {
        return restoreListeningData(storage.getString("daily"));
    } catch {
        return restoreListeningData(undefined);
    }
}
let data = load();
const statsAtom = atom(data);
let dirty = false;
let lastSavedAt = 0;

export function flushListeningStats(now = Date.now()) {
    if (!dirty) return;
    try {
        storage.set("daily", JSON.stringify(data));
        dirty = false;
        lastSavedAt = now;
    } catch {
        // Statistics are optional; storage failure must not interrupt audio.
    }
    getDefaultStore().set(statsAtom, data);
}

export const listeningTracker = new ListeningProgressTracker((song, from, to, count) => {
    data = addListeningInterval(data, song, from, to, count);
    dirty = true;
    // Native progress arrives every 100 ms. Batch persistence and UI notifications.
    if (count || to - lastSavedAt >= 10000) flushListeningStats(to);
});

export function useListeningStats() {
    return useAtomValue(statsAtom);
}
