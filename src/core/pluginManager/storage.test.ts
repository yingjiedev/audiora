import { Buffer } from "buffer";
import { createMMKV } from "react-native-mmkv";
import {
    clearAllPluginStorage,
    clearPluginStorage,
    createPluginStorage,
    MAX_PLUGIN_STORAGE_BYTES,
    MAX_PLUGIN_STORAGE_ITEM_BYTES,
} from "./storage";

jest.mock("@/utils/getOrCreateMMKV", () => ({
    __esModule: true,
    default: () => mockStore,
}));

const mockStore = createMMKV({ id: "plugin-storage-test" });

describe("plugin persistent storage", () => {
    const storage = createPluginStorage(() => "音源 A");

    beforeEach(() => {
        clearAllPluginStorage();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("round trips strings, empty keys and values, and missing entries", async () => {
        expect(storage.default).toBe(storage);
        await expect(storage.getItem("missing")).resolves.toBeNull();
        await storage.setItem("settings", JSON.stringify({ title: "音乐 🎵" }));
        await expect(storage.getItem("settings")).resolves.toBe("{\"title\":\"音乐 🎵\"}");
        await storage.setItem("", "");
        await expect(storage.getItem("")).resolves.toBe("");
        await storage.removeItem("");
        await storage.removeItem("missing");
        await expect(storage.getItem("")).resolves.toBeNull();
    });

    it("matches desktop value conversion and nullish removal", async () => {
        for (const [value, expected] of [[0, "0"], [false, "false"], [{}, "[object Object]"]] as const) {
            await storage.setItem("value", value);
            await expect(storage.getItem("value")).resolves.toBe(expected);
        }
        for (const value of [null, undefined]) {
            await storage.setItem("value", "old");
            await storage.setItem("value", value);
            await expect(storage.getItem("value")).resolves.toBeNull();
        }
    });

    it("isolates concurrent calls with identical keys across platforms", async () => {
        const other = createPluginStorage(() => "音源 B");
        await Promise.all([storage.setItem("token", "a"), other.setItem("token", "b")]);
        await expect(storage.getItem("token")).resolves.toBe("a");
        await expect(other.getItem("token")).resolves.toBe("b");
        clearPluginStorage("音源 A");
        await expect(storage.getItem("token")).resolves.toBeNull();
        await expect(other.getItem("token")).resolves.toBe("b");
    });

    it("does not collide or over-clear when platform names contain delimiters", async () => {
        const a = createPluginStorage(() => "a");
        const b = createPluginStorage(() => "a\":b");
        await a.setItem("b\":key", "a");
        await b.setItem("key", "b");
        clearPluginStorage("a");
        await expect(a.getItem("b\":key")).resolves.toBeNull();
        await expect(b.getItem("key")).resolves.toBe("b");
    });

    it("resolves plugin identity after synchronous initialization", async () => {
        let platform = "";
        const initializing = createPluginStorage(() => platform);
        const pendingWrite = initializing.setItem("state", "ready");
        platform = "mounted";
        await pendingWrite;
        await expect(createPluginStorage(() => "mounted").getItem("state")).resolves.toBe("ready");
    });

    it("rejects invalid keys, missing identities, and conversion failures", async () => {
        await expect(storage.setItem(1 as any, "value")).rejects.toThrow("keys must be strings");
        await expect(storage.getItem(null as any)).rejects.toThrow("keys must be strings");
        await expect(storage.removeItem(undefined as any)).rejects.toThrow("keys must be strings");
        await expect(createPluginStorage(() => "").getItem("key")).rejects.toThrow("unavailable");
        await expect(storage.setItem("key", {
            toString: () => {
                throw new Error("conversion failed");
            },
        })).rejects.toThrow("conversion failed");
        await expect(storage.setItem("key", { toString: () => 42 })).rejects.toThrow("convert to strings");
        expect(mockStore.getAllKeys()).toEqual([]);
    });

    it("counts UTF-8 bytes and namespace overhead at the item limit", async () => {
        await storage.setItem("key", "old");
        const keyBytes = Buffer.byteLength(mockStore.getAllKeys()[0], "utf8");
        const bytesLeft = MAX_PLUGIN_STORAGE_ITEM_BYTES - keyBytes;
        const text = "中".repeat(Math.floor(bytesLeft / 3)) + "x".repeat(bytesLeft % 3);
        await storage.setItem("key", text);
        await expect(storage.setItem("key", text + "x")).rejects.toThrow("1 MiB");
        await expect(storage.getItem("key")).resolves.toBe(text);
    });

    async function fillStorage() {
        const slots = MAX_PLUGIN_STORAGE_BYTES / MAX_PLUGIN_STORAGE_ITEM_BYTES;
        for (let index = 0; index < slots; index++) {
            const key = `"音源 A":${index}`;
            await storage.setItem(String(index), "x".repeat(MAX_PLUGIN_STORAGE_ITEM_BYTES - Buffer.byteLength(key, "utf8")));
        }
    }

    it("enforces the shared quota and releases it on overwrite, delete, and reset", async () => {
        await fillStorage();
        const other = createPluginStorage(() => "音源 B");
        await expect(other.setItem("key", "x")).rejects.toThrow("10 MiB");
        await storage.removeItem("missing");
        await expect(other.setItem("key", "x")).rejects.toThrow("10 MiB");
        await storage.setItem("0", "small");
        await other.setItem("key", "x");
        await storage.removeItem("1");
        await other.setItem("another", "y");
        clearPluginStorage("音源 A");
        await other.setItem("large", "z".repeat(500_000));
        await expect(other.getItem("key")).resolves.toBe("x");
    });

    it("cannot bypass the total quota with concurrent writes", async () => {
        const results = await Promise.allSettled(Array.from({ length: 11 }, (_, index) => {
            const plugin = createPluginStorage(() => `plugin-${index}`);
            const key = `"plugin-${index}":key`;
            return plugin.setItem("key", "x".repeat(MAX_PLUGIN_STORAGE_ITEM_BYTES - Buffer.byteLength(key, "utf8")));
        }));
        expect(results.filter(result => result.status === "fulfilled")).toHaveLength(10);
        expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    });

    it("retains data and rebuilds quota accounting after a module restart", async () => {
        await fillStorage();
        let restarted: typeof import("./storage");
        jest.isolateModules(() => {
            restarted = require("./storage");
        });
        const reloaded = restarted!.createPluginStorage(() => "音源 A");
        await expect(reloaded.getItem("0")).resolves.toEqual(expect.any(String));
        await expect(reloaded.setItem("extra", "value")).rejects.toThrow("10 MiB");
        await reloaded.removeItem("0");
        await reloaded.setItem("extra", "value");
    });

    it("rejects unsuccessful native deletions instead of reporting a successful reset", async () => {
        await storage.setItem("state", "keep");
        jest.spyOn(mockStore, "remove").mockReturnValueOnce(false);
        await expect(storage.removeItem("state")).rejects.toThrow("Failed to remove");
        await expect(storage.getItem("state")).resolves.toBe("keep");
        jest.spyOn(mockStore, "clearAll").mockImplementationOnce(() => {});
        expect(clearAllPluginStorage).toThrow("Failed to clear");
        await expect(storage.getItem("state")).resolves.toBe("keep");
    });

    it("propagates native read, write and remove failures without corrupting quota", async () => {
        await fillStorage();
        const previous = await storage.getItem("0");
        jest.spyOn(mockStore, "set").mockImplementationOnce(() => {
            throw new Error("disk full");
        });
        await expect(storage.setItem("0", "small")).rejects.toThrow("disk full");
        await expect(storage.getItem("0")).resolves.toBe(previous);
        await expect(storage.setItem("extra", "value")).rejects.toThrow("10 MiB");
        jest.spyOn(mockStore, "remove").mockImplementationOnce(() => {
            throw new Error("remove failed");
        });
        await expect(storage.removeItem("0")).rejects.toThrow("remove failed");
        await expect(storage.setItem("extra", "value")).rejects.toThrow("10 MiB");
        jest.spyOn(mockStore, "getString").mockImplementationOnce(() => {
            throw new Error("read failed");
        });
        await expect(storage.getItem("0")).rejects.toThrow("read failed");
        await storage.removeItem("0");
        await storage.setItem("extra", "value");
    });
});
