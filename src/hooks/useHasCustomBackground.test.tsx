import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import useHasCustomBackground, {
    LocalBackgroundContext,
} from "./useHasCustomBackground";
import Theme from "@/core/theme";

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

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

function Probe() {
    return React.createElement("probe", {
        hasCustomBackground: useHasCustomBackground(),
    });
}

function renderProbe(hasLocalBackground = false) {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(
            React.createElement(
                LocalBackgroundContext.Provider,
                { value: hasLocalBackground },
                React.createElement(Probe),
            ),
        );
    });
    mountedRenderers.push(renderer);
    const read = () =>
        renderer.root.findByType("probe" as any).props.hasCustomBackground;
    return {
        read,
        update: (fn: () => void) => act(fn),
    };
}

describe("useHasCustomBackground", () => {
    beforeEach(() => {
        Theme.setTheme("p-light");
        Theme.setBackground({ url: null });
    });

    afterEach(() => {
        // 卸载后再重置主题，避免残留组件收到 act 之外的更新
        const mounted = mountedRenderers.splice(0);
        act(() => {
            mounted.forEach(renderer => renderer.unmount());
        });
    });

    it("自定义主题 + 壁纸时为 true", () => {
        Theme.setTheme("custom", { background: { url: BACKGROUND_URL } });
        const { read } = renderProbe();

        expect(read()).toBe(true);
    });

    it("切到浅色/深色模式后回到 false，卡片重新拿到边框和投影", () => {
        Theme.setTheme("custom", { background: { url: BACKGROUND_URL } });
        const { read, update } = renderProbe();
        expect(read()).toBe(true);

        update(() => Theme.setTheme("p-light"));
        expect(read()).toBe(false);

        update(() => Theme.setTheme("p-dark"));
        expect(read()).toBe(false);
    });

    it("切回自定义主题后重新变为 true", () => {
        Theme.setTheme("custom", { background: { url: BACKGROUND_URL } });
        const { read, update } = renderProbe();

        update(() => Theme.setTheme("p-light"));
        expect(read()).toBe(false);

        update(() => Theme.setTheme("custom"));
        expect(read()).toBe(true);
    });

    it("页面自带背景（LocalBackgroundContext）不受主题模式影响", () => {
        const { read, update } = renderProbe(true);
        expect(read()).toBe(true);

        update(() => Theme.setTheme("p-dark"));
        expect(read()).toBe(true);
    });

    it("没有壁纸时为 false", () => {
        const { read } = renderProbe();
        expect(read()).toBe(false);
    });
});
