import { Buffer } from "buffer";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";

export const MAX_PLUGIN_STORAGE_ITEM_BYTES = 1024 * 1024;
export const MAX_PLUGIN_STORAGE_BYTES = 10 * 1024 * 1024;

export interface PluginStorage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: unknown): Promise<void>;
    removeItem(key: string): Promise<void>;
}

// Keep plugin state outside the disposable media cache and host configuration.
const getStore = () => getOrCreateMMKV("plugin.storage");
let entrySizes: Map<string, number> | undefined;
let totalBytes = 0;

function measureEntry(key: string, value: string) {
    return Buffer.byteLength(key, "utf8") + Buffer.byteLength(value, "utf8");
}

function getEntrySizes() {
    if (!entrySizes) {
        const sizes = new Map<string, number>();
        let bytes = 0;
        const store = getStore();
        for (const key of store.getAllKeys()) {
            const size = measureEntry(key, store.getString(key) ?? "");
            sizes.set(key, size);
            bytes += size;
        }
        entrySizes = sizes;
        totalBytes = bytes;
    }
    return entrySizes;
}

function getPrefix(platform: string) {
    if (typeof platform !== "string" || !platform.length) {
        throw new Error("Plugin storage is unavailable before a successful mount or after disposal");
    }
    // JSON escaping prevents platform names and arbitrary keys from colliding.
    return `${JSON.stringify(platform)}:`;
}

function getStorageKey(platform: string, key: string) {
    if (typeof key !== "string") {
        throw new TypeError("Plugin storage keys must be strings");
    }
    return getPrefix(platform) + key;
}

function removeEntry(key: string) {
    const sizes = getEntrySizes();
    const store = getStore();
    if (!store.remove(key) && store.contains(key)) {
        throw new Error("Failed to remove plugin storage item");
    }
    totalBytes -= sizes.get(key) ?? 0;
    sizes.delete(key);
}

/** Each sandbox receives its own facade; never infer identity from global env. */
export function createPluginStorage(resolvePlatform: () => string): PluginStorage & { default: PluginStorage } {
    const storage: PluginStorage = {
        async getItem(key) {
            // Top-level plugin calls can precede module.exports.platform. The
            // synchronous mount must finish before we resolve the namespace.
            await Promise.resolve();
            const storageKey = getStorageKey(resolvePlatform(), key);
            return getStore().getString(storageKey) ?? null;
        },
        async setItem(key, value) {
            await Promise.resolve();
            const storageKey = getStorageKey(resolvePlatform(), key);
            // Match desktop string conversion, including nullish values removing
            // an existing entry. Objects require explicit JSON.stringify().
            const text = typeof value === "string" ? value : value?.toString?.();
            if (text === undefined || text === null) {
                removeEntry(storageKey);
                return;
            }
            if (typeof text !== "string") {
                throw new TypeError("Plugin storage values must convert to strings");
            }
            const bytes = measureEntry(storageKey, text);
            if (bytes > MAX_PLUGIN_STORAGE_ITEM_BYTES) {
                throw new Error("Plugin storage item exceeds the 1 MiB limit");
            }
            const sizes = getEntrySizes();
            const newTotal = totalBytes - (sizes.get(storageKey) ?? 0) + bytes;
            if (newTotal > MAX_PLUGIN_STORAGE_BYTES) {
                throw new Error("Plugin storage exceeds the 10 MiB total limit");
            }
            // Only commit accounting after MMKV succeeds. No await between the
            // quota check and write, so concurrent plugin calls cannot overfill.
            getStore().set(storageKey, text);
            sizes.set(storageKey, bytes);
            totalBytes = newTotal;
        },
        async removeItem(key) {
            await Promise.resolve();
            removeEntry(getStorageKey(resolvePlatform(), key));
        },
    };
    return Object.assign(storage, { default: storage });
}

/** Reset one plugin without touching user variables, media, or other plugins. */
export function clearPluginStorage(platform: string) {
    const prefix = getPrefix(platform);
    for (const key of getStore().getAllKeys()) {
        if (key.startsWith(prefix)) {
            removeEntry(key);
        }
    }
}

export function clearAllPluginStorage() {
    const store = getStore();
    store.clearAll();
    if (store.getAllKeys().length) {
        throw new Error("Failed to clear plugin storage");
    }
    entrySizes = new Map();
    totalBytes = 0;
}
