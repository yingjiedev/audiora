/**
 * @jest-environment node
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
jest.mock("react-native", () => ({
    Platform: { OS: "android" },
    Dimensions: { get: () => ({ width: 400, height: 800 }) },
    ToastAndroid: { show: jest.fn(), SHORT: 0 },
}));
jest.mock("react-native-device-info", () => ({ getVersion: () => "0.3.0" }));
jest.mock("react-native-url-polyfill", () => ({ URL: global.URL }));
jest.mock("react-native-background-timer", () => ({}));
jest.mock("react-native-reanimated", () => ({}));
jest.mock("expo-file-system/legacy", () => ({ readAsStringAsync: jest.fn() }));
jest.mock("webdav", () => ({}));
jest.mock("@/native/mp3Util", () => ({}));
jest.mock("@/utils/nanoid", () => ({ nanoid: jest.fn() }));
jest.mock("@/utils/fileUtils", () => ({}));
jest.mock("@/utils/mediaUtils", () => ({
    getMediaUniqueKey: (item: { platform: string; id: string }) => `${item.platform}@${item.id}`,
}));
jest.mock("@/utils/androidSaf", () => ({}));
jest.mock("@/utils/mediaCompanion", () => ({}));
jest.mock("@/utils/network", () => ({}));
jest.mock("@/utils/delay", () => ({ __esModule: true, default: () => new Promise(() => {}) }));
jest.mock("@/utils/log", () => ({ devLog: jest.fn(), errorLog: jest.fn(), trace: jest.fn() }));
jest.mock("@/core/i18n", () => ({ __esModule: true, default: { t: (key: string) => key } }));

import { copyFile, readFile, unlink, writeFile } from "react-native-fs";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { getMediaExtraProperty, patchMediaExtra } from "@/utils/mediaExtra";
import { nanoid } from "@/utils/nanoid";
import axios from "./httpClient";
import pluginManager from "./index";
import { Plugin, PluginState } from "./plugin";
import { clearAllPluginStorage, createPluginStorage } from "./storage";

function source(platform: string, version = "1.0.0") {
    return `
        const storage = require("musicfree/storage");
        const initialRead = storage.getItem("state");
        module.exports = {
            platform: ${JSON.stringify(platform)},
            version: ${JSON.stringify(version)},
            storage,
            initialRead,
        };
    `;
}

function initializingSource(platform: string, version: string) {
    return `${source(platform, version)}
        initialRead.catch(() => {});
        module.exports.initialResults = Promise.allSettled([
            storage.setItem("state", "candidate"),
            storage.getItem("state"),
            storage.removeItem("remove-me"),
        ]);
    `;
}

describe("plugin storage sandbox and lifecycle", () => {
    let globalDescriptors: Map<string, PropertyDescriptor | undefined>;

    beforeEach(async () => {
        await pluginManager.uninstallAllPlugins();
        clearAllPluginStorage();
        jest.clearAllMocks();
        globalDescriptors = new Map(["process", "env", "TextDecoder"].map(key =>
            [key, Object.getOwnPropertyDescriptor(globalThis, key)],
        ));
        // Plugin code injects a mobile process shim. Keep Node's process usable
        // by Jest while still exercising the real sandbox and storage facade.
        const nodeProcess = globalThis.process;
        Object.defineProperty(globalThis, "process", {
            configurable: true,
            get: () => nodeProcess,
            set: () => {},
        });
    });

    afterEach(async () => {
        await pluginManager.uninstallAllPlugins();
        for (const [key, descriptor] of globalDescriptors) {
            if (descriptor) {
                Object.defineProperty(globalThis, key, descriptor);
            } else {
                Reflect.deleteProperty(globalThis, key);
            }
        }
        jest.restoreAllMocks();
    });

    it("makes top-level imports and reads work on first and default-export mounts", async () => {
        await createPluginStorage(() => "first").setItem("state", "saved");
        const plugin = new Plugin(source("first"), "/first.js");
        expect(plugin.state).toBe(PluginState.Mounted);
        await expect((plugin.instance as any).initialRead).resolves.toBe("saved");
        expect((plugin.instance as any).storage.default).toBe((plugin.instance as any).storage);

        const defaultExport = new Plugin(`
            const storage = __musicfree_require("musicfree/storage").default;
            const write = storage.setItem("state", "initialized");
            module.exports.default = { platform: "default-export", storage, write };
        `, "/default.js");
        expect(defaultExport.state).toBe(PluginState.Mounted);
        await (defaultExport.instance as any).write;
        await expect((defaultExport.instance as any).storage.getItem("state")).resolves.toBe("initialized");
    });

    it("keeps asynchronous calls bound to the originating plugin after another mount", async () => {
        const a = new Plugin(source("a"), "/a.js");
        const b = new Plugin(source("b"), "/b.js");
        const aStorage = (a.instance as any).storage;
        const bStorage = (b.instance as any).storage;
        await Promise.all([aStorage.setItem("state", "a"), bStorage.setItem("state", "b")]);
        b.activateSandboxGlobals();
        await expect(aStorage.getItem("state")).resolves.toBe("a");
        await expect(bStorage.getItem("state")).resolves.toBe("b");
    });

    it("reads the same namespace on lazy mount after a restart", async () => {
        const code = source("lazy");
        await createPluginStorage(() => "lazy").setItem("state", "persisted");
        const loadFuncCode = jest.fn(async () => code);
        const plugin = new Plugin(null, "/lazy.js", {
            name: "lazy", hash: "old-hash", path: "/lazy.js", loadFuncCode,
        });
        await Promise.all([plugin.ensureMounted(), plugin.ensureMounted()]);
        expect(loadFuncCode).toHaveBeenCalledTimes(1);
        expect(plugin.state).toBe(PluginState.Mounted);
        await expect((plugin.instance as any).initialRead).resolves.toBe("persisted");
    });

    it("rejects top-level storage writes when plugin mounting fails", async () => {
        const plugin = new Plugin(`
            const storage = require("musicfree/storage");
            module.exports = {
                platform: "invalid",
                writeResult: storage.setItem("state", "bad").then(() => "written", () => "rejected"),
            };
            throw { instance: module.exports };
        `, "/invalid.js");
        expect(plugin.state).toBe(PluginState.Error);
        await expect((plugin.instance as any).writeResult).resolves.toBe("rejected");
        await expect(createPluginStorage(() => "invalid").getItem("state")).resolves.toBeNull();
    });

    async function install(platform: string, version = "1.0.0") {
        jest.mocked(nanoid).mockReturnValueOnce(`${platform}-${version}`);
        jest.mocked(readFile).mockResolvedValueOnce(source(platform, version));
        await expect(pluginManager.installPluginFromLocalFile("/incoming.js"))
            .resolves.toMatchObject({ success: true });
        return pluginManager.getByName(platform)!;
    }

    const installMethods = ["local", "url"] as const;
    function installCode(code: string, method: typeof installMethods[number]) {
        if (method === "local") {
            jest.mocked(readFile).mockResolvedValueOnce(code);
            return pluginManager.installPluginFromLocalFile("/incoming.js");
        }
        jest.spyOn(axios, "get").mockResolvedValueOnce({ data: code });
        return pluginManager.installPluginFromUrl("https://example.test/plugin.js");
    }

    describe.each(installMethods)("%s installation candidates", method => {
        it.each(["duplicate", "older"])("revokes a %s candidate without changing installed data", async reason => {
            jest.mocked(nanoid).mockReturnValue("installed");
            const code = initializingSource("rejected", "2.0.0");
            await expect(installCode(code, method)).resolves.toMatchObject({ success: true });
            const installed = pluginManager.getByName("rejected")!;
            await (installed.instance as any).initialResults;
            const storage = (installed.instance as any).storage;
            await storage.setItem("state", "current");
            await storage.setItem("remove-me", "current");
            const mount = jest.spyOn(Plugin.prototype as any, "mountPlugin");

            const result = await installCode(reason === "duplicate" ? code : initializingSource("rejected", "1.0.0"), method);

            expect(result).toMatchObject({ success: reason === "duplicate" });
            const candidate = mount.mock.contexts[mount.mock.contexts.length - 1] as Plugin;
            expect(candidate).not.toBe(installed);
            await expect((candidate.instance as any).initialResults).resolves.toEqual([
                { status: "rejected", reason: expect.any(Error) },
                { status: "rejected", reason: expect.any(Error) },
                { status: "rejected", reason: expect.any(Error) },
            ]);
            expect(pluginManager.getByName("rejected")).toBe(installed);
            await expect(storage.getItem("state")).resolves.toBe("current");
            await expect(storage.getItem("remove-me")).resolves.toBe("current");

            await pluginManager.uninstallPlugin(installed.hash);
            const rejectedStorage = (candidate.instance as any).storage;
            await expect(rejectedStorage.setItem("late", "stale")).rejects.toThrow("unavailable");
            await expect(rejectedStorage.getItem("state")).rejects.toThrow("unavailable");
            await expect(rejectedStorage.removeItem("state")).rejects.toThrow("unavailable");
            expect(getOrCreateMMKV("plugin.storage").getAllKeys()).toEqual([]);
        });

        it("waits for file persistence before releasing top-level storage operations", async () => {
            const installed = await install("pending");
            const storage = (installed.instance as any).storage;
            await storage.setItem("state", "current");
            await storage.setItem("remove-me", "current");
            jest.mocked(nanoid).mockReturnValueOnce("pending-2.0.0");
            let finish!: () => void;
            let started!: () => void;
            const saveStarted = new Promise<void>(resolve => {
                started = resolve;
            });
            jest.mocked(method === "local" ? copyFile : writeFile).mockImplementationOnce(() => new Promise<void>(resolve => {
                finish = resolve;
                started();
            }));
            const mount = jest.spyOn(Plugin.prototype as any, "mountPlugin");

            const pending = installCode(initializingSource("pending", "2.0.0"), method);
            await saveStarted;
            const candidate = mount.mock.contexts[mount.mock.contexts.length - 1] as Plugin;
            let initialized = false;
            const initialization = (candidate.instance as any).initialResults.then(() => {
                initialized = true;
            });
            await expect(storage.getItem("state")).resolves.toBe("current");
            await expect(storage.getItem("remove-me")).resolves.toBe("current");
            expect(initialized).toBe(false);

            finish();
            await expect(pending).resolves.toMatchObject({ success: true });
            await initialization;
            expect(pluginManager.getByName("pending")).toBe(candidate);
            await expect((candidate.instance as any).initialResults).resolves.toEqual([
                { status: "fulfilled", value: undefined },
                { status: "fulfilled", value: "candidate" },
                { status: "fulfilled", value: undefined },
            ]);
            await expect((candidate.instance as any).storage.getItem("state")).resolves.toBe("candidate");
            await expect((candidate.instance as any).storage.getItem("remove-me")).resolves.toBeNull();
            await expect(storage.getItem("state")).rejects.toThrow("unavailable");
        });

        it("revokes the candidate if saving its file fails while keeping the installed plugin usable", async () => {
            const installed = await install("failed");
            const storage = (installed.instance as any).storage;
            await storage.setItem("state", "current");
            await storage.setItem("remove-me", "current");
            jest.mocked(nanoid).mockReturnValueOnce("failed-2.0.0");
            jest.mocked(unlink).mockClear();
            jest.mocked(method === "local" ? copyFile : writeFile).mockRejectedValueOnce(new Error("disk full"));
            const mount = jest.spyOn(Plugin.prototype as any, "mountPlugin");

            const pending = installCode(initializingSource("failed", "2.0.0"), method);
            if (method === "local") {
                await expect(pending).rejects.toThrow("disk full");
            } else {
                await expect(pending).resolves.toMatchObject({ success: false, message: "disk full" });
            }

            const candidate = mount.mock.contexts[mount.mock.contexts.length - 1] as Plugin;
            await expect((candidate.instance as any).initialResults).resolves.toEqual([
                { status: "rejected", reason: expect.any(Error) },
                { status: "rejected", reason: expect.any(Error) },
                { status: "rejected", reason: expect.any(Error) },
            ]);
            expect(pluginManager.getByName("failed")).toBe(installed);
            expect(unlink).not.toHaveBeenCalled();
            await expect(storage.getItem("state")).resolves.toBe("current");
            await expect(storage.getItem("remove-me")).resolves.toBe("current");
            await storage.setItem("still-usable", "yes");
            await pluginManager.uninstallPlugin(installed.hash);
            await expect((candidate.instance as any).storage.setItem("late", "stale")).rejects.toThrow("unavailable");
            expect(getOrCreateMMKV("plugin.storage").getAllKeys()).toEqual([]);
        });
    });

    it("preserves data through an upgrade while revoking the old instance", async () => {
        const old = await install("upgrade");
        const oldStorage = (old.instance as any).storage;
        await oldStorage.setItem("state", "keep");
        const updated = await install("upgrade", "2.0.0");
        expect(updated.hash).not.toBe(old.hash);
        expect(updated.path).not.toBe(old.path);
        expect(updated).not.toBe(old);
        await expect((updated.instance as any).storage.getItem("state")).resolves.toBe("keep");
        await expect(oldStorage.setItem("state", "stale")).rejects.toThrow("unavailable");
    });

    it("also preserves data when upgrading from a URL", async () => {
        const old = await install("url-upgrade");
        await (old.instance as any).storage.setItem("state", "keep");
        jest.mocked(nanoid).mockReturnValueOnce("url-upgrade-2.0.0");
        jest.spyOn(axios, "get").mockResolvedValueOnce({ data: source("url-upgrade", "2.0.0") });
        await expect(pluginManager.installPluginFromUrl("https://example.test/plugin.js"))
            .resolves.toMatchObject({ success: true });
        const updated = pluginManager.getByName("url-upgrade")!;
        expect(updated.path).not.toBe(old.path);
        await expect((updated.instance as any).storage.getItem("state")).resolves.toBe("keep");
        await expect((old.instance as any).storage.getItem("state")).rejects.toThrow("unavailable");
    });

    it("resets only persisted plugin data and keeps host settings and other plugins", async () => {
        const plugin = await install("reset");
        const storage = (plugin.instance as any).storage;
        const other = createPluginStorage(() => "other");
        await storage.setItem("state", "clear");
        await other.setItem("state", "keep");
        pluginManager.setUserVariables(plugin, { setting: "keep" });
        pluginManager.setPluginDisplayName(plugin, "My source");
        const song = { platform: "reset", id: "song" };
        patchMediaExtra(song, { localPath: "/download/song.mp3" });

        pluginManager.resetPluginStorage(plugin);

        await expect(storage.getItem("state")).resolves.toBeNull();
        await expect(other.getItem("state")).resolves.toBe("keep");
        expect(pluginManager.getUserVariables(plugin)).toEqual({ setting: "keep" });
        expect(pluginManager.getPluginDisplayName(plugin)).toBe("My source");
        expect(getMediaExtraProperty(song, "localPath")).toBe("/download/song.mp3");
        await storage.setItem("new", "usable");
    });

    it("clears data and rejects pending old writes on uninstall even if the file is missing", async () => {
        const plugin = await install("uninstall");
        const storage = (plugin.instance as any).storage;
        await storage.setItem("state", "clear");
        jest.mocked(unlink).mockRejectedValueOnce(new Error("ENOENT"));
        const pending = storage.setItem("late", "stale");
        const uninstall = pluginManager.uninstallPlugin(plugin.hash);
        await expect(pending).rejects.toThrow("unavailable");
        await uninstall;
        expect(pluginManager.getByName("uninstall")).toBeUndefined();
        await expect(createPluginStorage(() => "uninstall").getItem("state")).resolves.toBeNull();
        await expect(createPluginStorage(() => "uninstall").getItem("late")).resolves.toBeNull();
    });

    it("clears all plugin data on uninstall-all despite file deletion failures", async () => {
        const a = await install("all-a");
        const b = await install("all-b");
        await (a.instance as any).storage.setItem("state", "a");
        await (b.instance as any).storage.setItem("state", "b");
        jest.mocked(unlink).mockRejectedValueOnce(new Error("ENOENT"));
        await pluginManager.uninstallAllPlugins();
        expect(pluginManager.getSortedPlugins()).toEqual([]);
        expect(getOrCreateMMKV("plugin.storage").getAllKeys()).toEqual([]);
        await expect((a.instance as any).storage.setItem("late", "a")).rejects.toThrow("unavailable");
        await expect((b.instance as any).storage.setItem("late", "b")).rejects.toThrow("unavailable");
    });

    it("keeps plugins without storage imports working", () => {
        const plugin = new Plugin("module.exports = { platform: \"legacy\" };", "/legacy.js");
        expect(plugin.state).toBe(PluginState.Mounted);
        expect(plugin.name).toBe("legacy");
    });
});
