import { atom, getDefaultStore, useAtomValue } from "jotai";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { safeParse, safeStringify } from "@/utils/jsonUtil";

const routes = ["local-sheet-detail", "plugin-sheet-detail", "album-detail", "top-list-detail"] as const;
type SheetRoute = typeof routes[number];

export interface ISheetPlaybackContext {
    sheet: IMusic.IMusicSheetItemBase;
    routeName: string;
}

export interface ISheetPlaybackEntry {
    sheet: IMusic.IMusicSheetItemBase;
    routeName: SheetRoute;
}

const historyAtom = atom<ISheetPlaybackEntry[]>([]);
const storage = getOrCreateMMKV("music.SheetPlaybackHistory");
let loaded = false;
const MAX_HISTORY = 50;

function isEntry(value: unknown): value is ISheetPlaybackEntry {
    const entry = value as ISheetPlaybackEntry | null;
    return !!entry && routes.includes(entry.routeName) &&
        typeof entry.sheet?.id === "string" && !!entry.sheet.id &&
        typeof entry.sheet.platform === "string";
}

function key(entry: ISheetPlaybackEntry) {
    return JSON.stringify([entry.routeName, entry.sheet.platform, entry.sheet.id]);
}

function ensureLoaded() {
    if (loaded) {
        return;
    }
    const saved = safeParse(storage.getString("history") ?? "[]");
    const seen = new Set<string>();
    const history = Array.isArray(saved) ? saved.filter(entry => {
        if (!isEntry(entry) || seen.has(key(entry))) {
            return false;
        }
        seen.add(key(entry));
        return true;
    }).slice(0, MAX_HISTORY) : [];
    loaded = true;
    getDefaultStore().set(historyAtom, history);
}

function save(history: ISheetPlaybackEntry[]) {
    storage.set("history", safeStringify(history));
    getDefaultStore().set(historyAtom, history);
}

export function recordSheetPlayback(context: ISheetPlaybackContext) {
    if (!isEntry(context)) {
        return;
    }
    ensureLoaded();
    const { sheet, routeName } = context;
    // Preserve plugin-specific collection identifiers, but do not store the song list.
    const excluded = new Set(["musicList", "background", "backgroundBlur", "backgroundOpacity"]);
    const entry: ISheetPlaybackEntry = {
        routeName,
        sheet: Object.fromEntries(Object.entries(sheet).filter(([field]) => !excluded.has(field))) as IMusic.IMusicSheetItemBase,
    };
    save([entry, ...getDefaultStore().get(historyAtom).filter(item => key(item) !== key(entry))].slice(0, MAX_HISTORY));
}

export function removeSheetPlayback(entry: ISheetPlaybackEntry) {
    ensureLoaded();
    save(getDefaultStore().get(historyAtom).filter(item => key(item) !== key(entry)));
}

export function clearSheetPlaybackHistory() {
    ensureLoaded();
    save([]);
}

export function useSheetPlaybackHistory() {
    ensureLoaded();
    return useAtomValue(historyAtom);
}

export function getSheetPlaybackHistory() {
    ensureLoaded();
    return getDefaultStore().get(historyAtom);
}
