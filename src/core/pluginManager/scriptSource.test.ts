jest.mock("./plugin", () => {
    class FakePlugin {
        name: string;
        hash: string;
        path: string;
        instance: any;
        state = 2;
        supportedMethods: Set<string>;
        static injectDependencies() {}
        activateStorage() {}
        disposeStorage() {}
        constructor(code: string | (() => any), path: string) {
            if (typeof code === "function") {
                this.instance = code();
            } else {
                // Only local test fixtures use the existing CJS path in this fake.
                this.instance = { platform: "catalog", version: "1.0.0", search: async () => ({ data: [] }) };
            }
            this.name = this.instance.platform;
            this.hash = `hash:${this.name}`;
            this.path = path;
            this.supportedMethods = new Set(Object.keys(this.instance).filter(key => typeof this.instance[key] === "function"));
        }
    }
    return { Plugin: FakePlugin, PluginState: { Initializing: 0, Loading: 1, Mounted: 2, Error: 3 }, localFilePlugin: {} };
});
jest.mock("react-native-reanimated", () => ({ Easing: { exp: jest.fn(), out: (value: any) => value } }));
jest.mock("expo-file-system/legacy", () => ({ readAsStringAsync: jest.fn() }));
jest.mock("@/utils/log", () => ({ devLog: jest.fn(), errorLog: jest.fn() }));
jest.mock("@/core/i18n", () => ({ __esModule: true, default: {
    t: (_key: string, variables: any) => `Custom source ${variables?.index ?? ""}`,
} }));
jest.mock("@/utils/nanoid", () => ({ nanoid: jest.fn(() => "fixture-source") }));
jest.mock("react-native-background-timer", () => ({ __esModule: true, default: { setTimeout: jest.fn(), clearTimeout: jest.fn() } }));
const mockInitialize = jest.fn();
jest.mock("@/core/scriptSource/runtime", () => ({
    getSourceRuntime: () => ({ initialize: () => mockInitialize() }),
    disposeSourceRuntime: jest.fn(),
}));

import { readDir, readFile, writeFile, unlink } from "react-native-fs";
import manager from "./index";
import { disposeSourceRuntime } from "../scriptSource/runtime";

const first = "/**\n * @name Fixture name\n * @version arbitrary release\n */\nconst api = globalThis.lx;";
const second = first + "\n// updated revision";

describe("custom source installation and persistence", () => {
    beforeEach(async () => {
        (readDir as jest.Mock).mockResolvedValue([]);
        (writeFile as jest.Mock).mockResolvedValue(undefined);
        (unlink as jest.Mock).mockResolvedValue(undefined);
        await manager.uninstallAllPlugins();
        jest.clearAllMocks();
        mockInitialize.mockResolvedValue({ wy: { qualitys: ["320k", "flac24bit"] } });
        manager.injectDependencies({ getConfig: () => true } as any);
    });

    it("imports a playback-only source and uses a neutral display name", async () => {
        (readFile as jest.Mock).mockResolvedValue(first);
        const result = await manager.installPluginFromLocalFile("/import/source.js");
        expect(result.success).toBe(true);
        const plugin = manager.getSortedPlugins()[0];
        expect(manager.getPluginDisplayName(plugin)).toBe("Custom source 1");
        expect(plugin.instance.version).not.toBe("arbitrary release");
        expect(manager.getSearchablePlugins()).toEqual([]);
        const persisted = JSON.parse((writeFile as jest.Mock).mock.calls[0][1]);
        expect(persisted.script).toBe(first);
        expect(persisted.scriptInfo.version).toBe("arbitrary release");
        expect(persisted.providers.wy.qualitys).toContain("flac24bit");
    });

    it("keeps source identity, renamed display name and bindings when updating", async () => {
        (readFile as jest.Mock).mockResolvedValue("module.exports = { platform: 'catalog', search(){} };");
        await manager.installPluginFromLocalFile("/import/catalog.js");
        const catalog = manager.getSearchablePlugins()[0];
        (readFile as jest.Mock).mockResolvedValue(first);
        await manager.installPluginFromLocalFile("/import/source.js");
        const previous = manager.getSortedPlugins().find(plugin => plugin.instance.scriptSource)!;
        manager.setPluginDisplayName(previous, "My resolver");
        manager.setAlternativePluginName(catalog, previous.name);
        manager.setSourceProvider(catalog, "wy");
        const cached = { url: "https://example.invalid/old", resolverKey: JSON.stringify([previous.name, previous.hash, "wy"]) };
        expect(manager.canReuseMediaSource({ id: "42", platform: "catalog" }, cached)).toBe(true);
        (readFile as jest.Mock).mockResolvedValue(second);
        const result = await manager.installPluginFromLocalFile("/import/update.js");
        expect(result.success).toBe(true);
        const updated = manager.getSortedPlugins().find(plugin => plugin.instance.scriptSource)!;
        expect(updated.name).toBe(previous.name);
        expect(updated.hash).not.toBe(previous.hash);
        expect(manager.getPluginDisplayName(updated)).toBe("My resolver");
        expect(manager.getAlternativePluginName(catalog)).toBe(updated.name);
        expect(manager.getMediaSourceQualityScope({ id: "42", platform: "catalog" })).toEqual(["320k", "flac24bit"]);
        expect(manager.canReuseMediaSource({ id: "42", platform: "catalog" }, cached)).toBe(false);
        expect(unlink).toHaveBeenCalledWith(previous.path);
    });

    it("preserves the previous source after initialization or persistence fails", async () => {
        (readFile as jest.Mock).mockResolvedValue(first);
        await manager.installPluginFromLocalFile("/import/source.js");
        const previous = manager.getSortedPlugins()[0];
        (readFile as jest.Mock).mockResolvedValue(second);
        mockInitialize.mockRejectedValueOnce(new Error("initialization failed"));
        expect((await manager.installPluginFromLocalFile("/import/update.js")).success).toBe(false);
        expect(manager.getSortedPlugins()[0]).toBe(previous);
        (writeFile as jest.Mock).mockRejectedValueOnce(new Error("disk full"));
        expect((await manager.installPluginFromLocalFile("/import/update.js")).success).toBe(false);
        expect(manager.getSortedPlugins()[0]).toBe(previous);
    });

    it("restores persisted capabilities without executing scripts at startup", async () => {
        (readFile as jest.Mock).mockResolvedValue(first);
        await manager.installPluginFromLocalFile("/import/source.js");
        const path = manager.getSortedPlugins()[0].path;
        const content = (writeFile as jest.Mock).mock.calls[0][1];
        await manager.uninstallAllPlugins();
        mockInitialize.mockClear();
        (readDir as jest.Mock).mockResolvedValue([{ isFile: () => true, name: "fixture.source.json", path }]);
        (readFile as jest.Mock).mockResolvedValue(content);
        await manager.setup();
        expect(manager.getSortedPlugins()).toHaveLength(1);
        expect(manager.getSortedPlugins()[0].instance.scriptSource.providers.wy.qualitys).toEqual(["320k", "flac24bit"]);
        expect(mockInitialize).not.toHaveBeenCalled();
    });

    it("reports source installation, unchanged and update results to subscriptions", async () => {
        const url = "https://example.invalid/source.js";
        expect(await manager.installPluginFromCode(first, url)).toEqual(expect.objectContaining({ success: true, status: "installed", pluginUrl: url }));
        expect(await manager.installPluginFromCode(first, url)).toEqual(expect.objectContaining({ success: true, status: "unchanged", pluginUrl: url }));
        expect(await manager.installPluginFromCode(second, url)).toEqual(expect.objectContaining({ success: true, status: "updated", pluginUrl: url }));
    });

    it("does not replace the previous source when cancelled during initialization", async () => {
        const url = "https://example.invalid/source.js";
        await manager.installPluginFromCode(first, url);
        const previous = manager.getSortedPlugins()[0];
        const controller = new AbortController();
        mockInitialize.mockImplementationOnce(async () => {
            controller.abort();
            return { wy: { qualitys: ["320k"] } };
        });
        (writeFile as jest.Mock).mockClear();
        expect(await manager.installPluginFromCode(second, url, { signal: controller.signal })).toEqual(expect.objectContaining({ success: false, message: "Cancelled" }));
        expect(writeFile).not.toHaveBeenCalled();
        expect(manager.getSortedPlugins()[0]).toBe(previous);
    });

    it("keeps CommonJS plugins searchable and disposes custom sources when disabled", async () => {
        (readFile as jest.Mock).mockResolvedValue("module.exports = { platform: 'catalog', search(){} };");
        expect((await manager.installPluginFromLocalFile("/import/catalog.js")).success).toBe(true);
        expect(manager.getSearchablePlugins()).toHaveLength(1);
        (readFile as jest.Mock).mockResolvedValue(first);
        await manager.installPluginFromLocalFile("/import/source.js");
        const source = manager.getSortedPlugins().find(plugin => plugin.instance.scriptSource)!;
        const catalog = manager.getSearchablePlugins()[0];
        manager.setAlternativePluginName(catalog, source.name);
        manager.setPluginEnabled(source, false);
        expect(disposeSourceRuntime).toHaveBeenCalledWith(source.instance.scriptSource!.id);
        expect(manager.getAlternativePlugin(catalog)).toBeNull();
        manager.setPluginEnabled(source, true);
    });
});
