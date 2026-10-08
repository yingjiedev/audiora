import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import PlayControl from "./playControl";

const COLORS = {
    primary: "#3978FF",
    onPrimary: "#FFFFFF",
    onMedia: "#FFFFFF",
    onMediaSecondary: "#B9C2D0",
    shadow: "#0B1B3A",
    text: "#111827",
};

jest.mock("@/components/base/icon.tsx", () => "Icon");
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/core/i18n", () => ({
    useI18N: () => ({ t: (key: string) => key }),
}));
jest.mock("@/core/trackPlayer", () => ({
    __esModule: true,
    default: {
        play: jest.fn(),
        pause: jest.fn(),
        skipToNext: jest.fn(),
        skipToPrevious: jest.fn(),
        toggleRepeatMode: jest.fn(),
    },
    useMusicState: () => 0,
    useRepeatMode: () => "QUEUE",
}));
jest.mock("@/hooks/useColors", () => () => COLORS);
jest.mock("@/hooks/useOrientation", () => () => "vertical");
jest.mock("@/utils/delay", () => ({
    __esModule: true,
    default: () => Promise.resolve(false),
}));
jest.mock("@/utils/rpx", () => ({
    __esModule: true,
    default: (value: number) => value,
}));
jest.mock("@/utils/trackUtils", () => ({ musicIsPaused: () => true }));

/**
 * Pressable 会把无障碍属性透传给内部 View，同一份 props 会被匹配两次；
 * 只保留外层 Pressable（父节点不再带同一个 role 的那个）。
 */
function pressables(renderer: TestRenderer.ReactTestRenderer) {
    return renderer.root
        .findAllByProps({ accessibilityRole: "button" })
        .filter(node => node.parent?.props?.accessibilityRole !== "button");
}

describe("PlayControl", () => {
    it("labels every control through i18n instead of hardcoded Chinese", () => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<PlayControl />);
        });

        const buttons = pressables(renderer!);

        expect(buttons.map(button => button.props.accessibilityLabel)).toEqual([
            "musicDetail.a11y.toggleRepeatMode",
            "musicDetail.a11y.skipToPrevious",
            "musicDetail.a11y.play",
            "musicDetail.a11y.skipToNext",
            "musicDetail.a11y.playlist",
        ]);
    });

    it("uses the same primary treatment as the mini player: primary fill + onPrimary icon", () => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<PlayControl />);
        });

        const buttons = pressables(renderer!);
        const primaryStyle = StyleSheet.flatten(
            buttons[2].props.style({ pressed: false }),
        );
        const secondaryStyle = StyleSheet.flatten(
            buttons[1].props.style({ pressed: false }),
        );

        expect(primaryStyle.backgroundColor).toBe(COLORS.primary);
        expect(secondaryStyle.backgroundColor).toBeUndefined();
        // 主按钮内部图标走 onPrimary，其余走沉浸层前景色
        expect(buttons[2].findByType("Icon").props.color).toBe(
            COLORS.onPrimary,
        );
        expect(buttons[1].findByType("Icon").props.color).toBe(COLORS.onMedia);
    });
});
