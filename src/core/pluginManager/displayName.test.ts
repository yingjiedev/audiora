// 插件沙箱模块会把一批原生 ESM 依赖拖进 Jest（Jest 不 transform 它们），
// 这里用一个只认平台名的假 Plugin 顶掉，其余原生依赖按最小可用实现 mock。
jest.mock("./plugin", () => {
    class FakePlugin {
        name = "";
        hash = "";
        path = "";
        instance: any;

        constructor(
            funcCode: string | (() => any) | null,
            pluginPath: string,
            lazyProps: any = null,
        ) {
            const define =
                lazyProps ?? (typeof funcCode === "function" ? funcCode() : {});
            this.name = define?.platform ?? "";
            this.path = pluginPath;
            this.hash = `hash-${this.name}`;
            this.instance = define ?? {};
        }
    }

    return {
        __esModule: true,
        Plugin: FakePlugin,
        PluginState: {
            Initializing: 0,
            Loading: 1,
            Mounted: 2,
            Error: 3,
        },
        localFilePlugin: new FakePlugin(() => ({ platform: "本地" }), ""),
    };
});
jest.mock("react-native-reanimated", () => ({
    Easing: {
        exp: jest.fn(),
        out: jest.fn(easing => easing),
    },
}));
jest.mock("expo-file-system/legacy", () => ({
    readAsStringAsync: jest.fn(async () => ""),
}));
jest.mock("react-native-background-timer", () => ({
    __esModule: true,
    default: { setTimeout: jest.fn(), clearTimeout: jest.fn() },
}));
jest.mock("@/utils/nanoid", () => ({ nanoid: () => "test-nanoid" }));

import pluginManager, { Plugin } from "./index";
import pluginMeta from "./meta";

function createPlugin(platform: string): Plugin {
    return new Plugin(
        () => ({ platform }) as any,
        `internal-plugin://${platform}`,
    );
}

describe("插件显示名", () => {
    const platform = "测试音源";
    const otherPlatform = "另一个音源";

    afterEach(() => {
        pluginManager.setPluginDisplayName(createPlugin(platform), null);
        pluginManager.setPluginDisplayName(createPlugin(otherPlatform), null);
    });

    it("未自定义时显示名回落到平台名", () => {
        expect(pluginManager.getPluginDisplayName(createPlugin(platform))).toBe(
            platform,
        );
    });

    it("自定义显示名只影响展示，不动平台名", () => {
        const plugin = createPlugin(platform);
        pluginManager.setPluginDisplayName(plugin, "我的音源");

        expect(pluginManager.getPluginDisplayName(plugin)).toBe("我的音源");
        expect(plugin.name).toBe(platform);
    });

    it("前后空白会被去掉", () => {
        const plugin = createPlugin(platform);
        pluginManager.setPluginDisplayName(plugin, "  我的音源  ");

        expect(pluginManager.getPluginDisplayName(plugin)).toBe("我的音源");
    });

    it("传入空白或 null 时恢复插件本身的平台名", () => {
        const plugin = createPlugin(platform);

        pluginManager.setPluginDisplayName(plugin, "我的音源");
        pluginManager.setPluginDisplayName(plugin, "   ");
        expect(pluginManager.getPluginDisplayName(plugin)).toBe(platform);

        pluginManager.setPluginDisplayName(plugin, "我的音源");
        pluginManager.setPluginDisplayName(plugin, null);
        expect(pluginManager.getPluginDisplayName(plugin)).toBe(platform);
    });

    it("显示名按平台生效，同平台的新实例（插件更新后）沿用同一个名字", () => {
        const plugin = createPlugin(platform);
        const otherPlugin = createPlugin(otherPlatform);
        pluginManager.setPluginDisplayName(plugin, "我的音源");

        expect(pluginManager.getPluginDisplayName(otherPlugin)).toBe(
            otherPlatform,
        );
        expect(
            pluginManager.getPluginDisplayName(createPlugin(platform)),
        ).toBe("我的音源");
    });

    it("只拿到平台名（媒体项 / 歌单里存的只有它）也能取到显示名", () => {
        pluginManager.setPluginDisplayName(createPlugin(platform), "我的音源");

        expect(pluginManager.getPluginDisplayName(platform)).toBe("我的音源");
    });

    it("空值或未知平台名不会抛错，原样回落", () => {
        expect(pluginManager.getPluginDisplayName("")).toBe("");
        expect(pluginManager.getPluginDisplayName("不存在的音源")).toBe(
            "不存在的音源",
        );
    });

    it("清空显示名不会误删用户变量等其它 meta", () => {
        const plugin = createPlugin(platform);
        pluginManager.setPluginDisplayName(plugin, "我的音源");
        pluginManager.setUserVariables(plugin, { cookie: "token" });

        pluginMeta.clearDisplayNames();

        expect(pluginMeta.getAllDisplayNames()).toEqual({});
        expect(pluginManager.getUserVariables(plugin)).toEqual({
            cookie: "token",
        });

        pluginManager.setUserVariables(plugin, {});
    });

    it("显示名与其它 meta（用户变量）互不干扰", () => {
        const plugin = createPlugin(platform);
        pluginManager.setPluginDisplayName(plugin, "我的音源");
        pluginManager.setUserVariables(plugin, { cookie: "token" });

        expect(pluginManager.getUserVariables(plugin)).toEqual({
            cookie: "token",
        });
        expect(pluginManager.getPluginDisplayName(plugin)).toBe("我的音源");

        pluginManager.setUserVariables(plugin, {});
    });
});
