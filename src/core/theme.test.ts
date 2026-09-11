import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import Theme, { isPresetThemeId, resolveActiveBackground } from "@/core/theme";

const mockConfigStore: Record<string, unknown> = {};

jest.mock("@/core/appConfig", () => ({
    __esModule: true,
    default: {
        getConfig: (key: string) => mockConfigStore[key],
        setConfig: (key: string, value?: unknown) => {
            if (value === undefined) {
                delete mockConfigStore[key];
            } else {
                mockConfigStore[key] = value;
            }
        },
    },
}));

const BACKGROUND_URL = "file:///data/audiora/background.jpg";

/** 订阅 useActiveBackground 的探针组件 */
function Probe() {
    const background = Theme.useActiveBackground();
    return React.createElement("probe", {
        url: background?.url ?? null,
    });
}

describe("isPresetThemeId / resolveActiveBackground", () => {
    it("把浅色与深色识别为预设主题", () => {
        expect(isPresetThemeId("p-light")).toBe(true);
        expect(isPresetThemeId("p-dark")).toBe(true);
        expect(isPresetThemeId("custom")).toBe(false);
        expect(isPresetThemeId(undefined)).toBe(false);
    });

    it("预设主题下无论有没有配置都返回 null", () => {
        expect(resolveActiveBackground("p-light", { url: BACKGROUND_URL })).toBeNull();
        expect(resolveActiveBackground("p-dark", { url: BACKGROUND_URL })).toBeNull();
        expect(resolveActiveBackground("p-light", null)).toBeNull();
    });

    it("自定义主题下原样返回配置", () => {
        const background = { url: BACKGROUND_URL, blur: 8 };
        expect(resolveActiveBackground("custom", background)).toBe(background);
        expect(resolveActiveBackground("custom", null)).toBeNull();
        // 只调过模糊/透明度、没有 url 时不算生效
        expect(resolveActiveBackground("custom", { blur: 8 })).toBeNull();
    });
});

describe("切换主题模式时的自定义背景", () => {
    beforeEach(() => {
        Theme.setTheme("p-light");
        Theme.setBackground({ url: null });
    });

    it("自定义主题下背景生效并写入配置", () => {
        Theme.setTheme("custom", { background: { url: BACKGROUND_URL } });

        expect(Theme.getTheme().id).toBe("custom");
        expect(Theme.getActiveBackground()?.url).toBe(BACKGROUND_URL);
        expect(Theme.getBackground()?.url).toBe(BACKGROUND_URL);
    });

    it("切到浅色模式后立即停用自定义背景，但配置保留", () => {
        Theme.setTheme("custom", { background: { url: BACKGROUND_URL } });
        Theme.setTheme("p-light");

        expect(Theme.getTheme().id).toBe("p-light");
        expect(Theme.getActiveBackground()).toBeNull();
        // 配置保留，切回自定义主题时复用同一张图
        expect(Theme.getBackground()?.url).toBe(BACKGROUND_URL);
    });

    it("切到深色模式后同样停用自定义背景", () => {
        Theme.setTheme("custom", { background: { url: BACKGROUND_URL } });
        Theme.setTheme("p-dark");

        expect(Theme.getTheme().id).toBe("p-dark");
        expect(Theme.getActiveBackground()).toBeNull();
        expect(Theme.getBackground()?.url).toBe(BACKGROUND_URL);
    });

    it("切到浅色/深色模式后页面配色回到该模式的预设值", () => {
        Theme.setTheme("custom", { background: { url: BACKGROUND_URL } });

        Theme.setTheme("p-light");
        expect(Theme.getTheme().colors.pageBackground).toBe("#F6F9FF");
        expect(Theme.getTheme().colors.card).toBe("#FFFFFF");

        Theme.setTheme("custom", { background: { url: BACKGROUND_URL } });
        Theme.setTheme("p-dark");
        expect(Theme.getTheme().colors.pageBackground).toBe("#090F1F");
        expect(Theme.getTheme().colors.card).toBe("#121D33");
    });

    it("切回自定义主题后背景自动恢复，不需要重新选图", () => {
        Theme.setTheme("custom", { background: { url: BACKGROUND_URL } });
        Theme.setTheme("p-light");
        expect(Theme.getActiveBackground()).toBeNull();

        Theme.setTheme("custom");
        expect(Theme.getActiveBackground()?.url).toBe(BACKGROUND_URL);
    });

    it("在浅色模式下清除背景图后，切回自定义主题不会再出现", () => {
        Theme.setTheme("custom", { background: { url: BACKGROUND_URL } });
        Theme.setTheme("p-light");

        Theme.setBackground({ url: null });
        expect(Theme.getBackground()?.url).toBeUndefined();

        Theme.setTheme("custom");
        expect(Theme.getActiveBackground()).toBeNull();
    });

    it("useActiveBackground 会跟随主题切换重新求值", () => {
        Theme.setTheme("custom", { background: { url: BACKGROUND_URL } });

        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(React.createElement(Probe));
        });
        const renderedUrl = () =>
            renderer.root.findByType("probe" as any).props.url;

        expect(renderedUrl()).toBe(BACKGROUND_URL);

        act(() => {
            Theme.setTheme("p-light");
        });
        expect(renderedUrl()).toBeNull();

        act(() => {
            Theme.setTheme("p-dark");
        });
        expect(renderedUrl()).toBeNull();

        act(() => {
            Theme.setTheme("custom");
        });
        expect(renderedUrl()).toBe(BACKGROUND_URL);

        act(() => {
            renderer.unmount();
        });
    });
});
