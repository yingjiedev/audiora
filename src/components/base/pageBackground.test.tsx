import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import PageBackground from "./pageBackground";
import Theme from "@/core/theme";

const mockConfigStore: Record<string, unknown> = {};
const mockCapturedProps: Array<Record<string, unknown>> = [];

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
jest.mock("@/hooks/useColors", () => () => ({
    pageBackground: "#F6F9FF",
    background: "transparent",
}));
jest.mock("./customBackground", () => {
    return (props: Record<string, unknown>) => {
        mockCapturedProps.push(props);
        return null;
    };
});

const BACKGROUND_URL = "file:///data/audiora/background.jpg";

function latestBackgroundProps() {
    return mockCapturedProps[mockCapturedProps.length - 1];
}

describe("PageBackground", () => {
    let renderer: TestRenderer.ReactTestRenderer | undefined;

    beforeEach(() => {
        mockCapturedProps.length = 0;
        Theme.setTheme("p-light");
        Theme.setBackground({ url: null });
    });

    afterEach(() => {
        // 卸载后再重置主题，避免残留组件收到 act 之外的更新
        const mounted = renderer;
        renderer = undefined;
        if (mounted) {
            act(() => {
                mounted.unmount();
            });
        }
    });

    function mount() {
        act(() => {
            renderer = TestRenderer.create(React.createElement(PageBackground));
        });
    }

    it("自定义主题下渲染壁纸", () => {
        Theme.setTheme("custom", { background: { url: BACKGROUND_URL } });
        mount();

        expect(latestBackgroundProps()?.url).toBe(BACKGROUND_URL);
    });

    it("切到浅色模式后不再渲染壁纸", () => {
        Theme.setTheme("custom", { background: { url: BACKGROUND_URL } });
        mount();
        expect(latestBackgroundProps()?.url).toBe(BACKGROUND_URL);

        act(() => {
            Theme.setTheme("p-light");
        });

        // 只保留底色，壁纸必须消失
        expect(latestBackgroundProps()?.url).toBeUndefined();
        expect(latestBackgroundProps()?.backgroundColor).toBe("#F6F9FF");
    });

    it("切到深色模式后同样不渲染壁纸", () => {
        Theme.setTheme("custom", { background: { url: BACKGROUND_URL } });
        mount();

        act(() => {
            Theme.setTheme("p-dark");
        });

        expect(latestBackgroundProps()?.url).toBeUndefined();
    });

    it("切回自定义主题后壁纸恢复", () => {
        Theme.setTheme("custom", { background: { url: BACKGROUND_URL } });
        mount();

        act(() => {
            Theme.setTheme("p-light");
        });
        expect(latestBackgroundProps()?.url).toBeUndefined();

        act(() => {
            Theme.setTheme("custom");
        });
        expect(latestBackgroundProps()?.url).toBe(BACKGROUND_URL);
    });
});
