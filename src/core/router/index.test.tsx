import React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockNavigation: { navigate: jest.Mock; push?: jest.Mock } = {
    navigate: jest.fn(),
    push: jest.fn(),
};

jest.mock("@react-navigation/native", () => ({
    useNavigation: () => mockNavigation,
    useRoute: () => ({ params: {} }),
}));

import { useNavigate, usePush } from "./index";

let api: { navigate: ReturnType<typeof useNavigate>; push: ReturnType<typeof usePush> };

function Host() {
    api = { navigate: useNavigate(), push: usePush() };
    return null;
}

function renderRouter() {
    act(() => {
        TestRenderer.create(<Host />);
    });
    return api;
}

describe("router navigation helpers", () => {
    beforeEach(() => {
        mockNavigation.navigate = jest.fn();
        mockNavigation.push = jest.fn();
        api = undefined as any;
    });

    it("routes useNavigate to navigation.navigate", () => {
        const { navigate } = renderRouter();

        act(() => {
            navigate("downloading");
        });

        expect(mockNavigation.navigate).toHaveBeenCalledWith(
            "downloading",
            undefined,
        );
        expect(mockNavigation.push).not.toHaveBeenCalled();
    });

    it("routes usePush to navigation.push so the route is always stacked", () => {
        const { push } = renderRouter();

        act(() => {
            push("setting", { type: "basic", section: "playback" });
        });

        // 设置子页与设置首页同名，只有 navigate 才会复用已有屏幕；
        // push 必须原样透传，否则「返回上一级」会直接退回入口页。
        expect(mockNavigation.push).toHaveBeenCalledWith("setting", {
            type: "basic",
            section: "playback",
        });
        expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it("falls back to navigate when the navigator has no push", () => {
        delete mockNavigation.push;
        const { push } = renderRouter();

        act(() => {
            push("setting", { type: "theme", section: undefined });
        });

        expect(mockNavigation.navigate).toHaveBeenCalledWith("setting", {
            type: "theme",
            section: undefined,
        });
    });
});
