import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SongRow } from "./body";
import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";

const song = { id: "one", platform: "demo", title: "Song", artist: "Artist" } as IMusic.IMusicItem;
let mockCurrent: IMusic.IMusicItem | null = song;
let mockPaused = false;
const mockGestures: Array<Record<string, (...args: any[]) => void>> = [];
jest.mock("react-native-gesture-handler", () => ({
    Gesture: { Pan: () => {
        const handlers: Record<string, (...args: any[]) => void> = {};
        mockGestures.push(handlers);
        const gesture = {
            activateAfterLongPress: () => gesture,
            onStart: (callback: (...args: any[]) => void) => {
                handlers.start = callback; return gesture;
            },
            onUpdate: (callback: (...args: any[]) => void) => {
                handlers.update = callback; return gesture;
            },
            onEnd: (callback: (...args: any[]) => void) => {
                handlers.end = callback; return gesture;
            },
            onFinalize: (callback: (...args: any[]) => void) => {
                handlers.finalize = callback; return gesture;
            },
        };
        return gesture;
    } },
    GestureDetector: "GestureDetector",
    ScrollView: "ScrollView",
}));
jest.mock("react-native-reanimated", () => ({
    __esModule: true,
    default: { View: "AnimatedView" },
    runOnJS: (callback: (...args: any[]) => void) => callback,
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedStyle: (callback: () => unknown) => callback(),
}));
jest.mock("@shopify/flash-list", () => ({ FlashList: "FlashList" }));
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/fastImage", () => "FastImage");
jest.mock("@/components/base/loading", () => "Loading");
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: 1 } }));
jest.mock("@/core/trackPlayer", () => ({ useCurrentMusic: () => mockCurrent, useMusicState: () => mockPaused }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/hooks/useColors", () => () => ({ text: "#10172D", textSecondary: "#777777", success: "#188A51", card: "#FFFFFF" }));
jest.mock("@/hooks/useMotion", () => () => ({ duration: () => 160 }));
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value / 2 }));
jest.mock("@/utils/mediaUtils", () => ({ getMediaUniqueKey: (item: IMusic.IMusicItem) => `${item.platform}@${item.id}`, isSameMediaItem: (a: IMusic.IMusicItem, b: IMusic.IMusicItem) => a?.id === b?.id && a?.platform === b?.platform }));
jest.mock("@/utils/trackUtils", () => ({ musicIsPaused: (paused: boolean) => paused }));

describe("playback drawer song row", () => {
    beforeEach(() => {
        mockGestures.length = 0; mockCurrent = song; mockPaused = false;
    });

    function render(item = song) {
        const handlers = { onPlay: jest.fn(), onRemove: jest.fn(), onMove: jest.fn(), onDragging: jest.fn() };
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<SongRow item={item} {...handlers} />);
        });
        return { renderer, handlers };
    }

    it("separates play, removal, and accessible reorder actions", () => {
        const { renderer, handlers } = render();
        act(() => renderer.root.findByProps({ accessibilityLabel: "Song - Artist" }).props.onPress());
        const remove = renderer.root.findAllByProps({ accessibilityLabel: "panel.playList.remove" }).find(node => typeof node.props.onPress === "function")!;
        act(() => remove.props.onPress());
        const reorder = renderer.root.findByProps({ accessibilityLabel: "panel.playList.reorder" });
        act(() => reorder.props.onAccessibilityAction({ nativeEvent: { actionName: "decrement" } }));
        expect(handlers.onPlay).toHaveBeenCalledTimes(1);
        expect(handlers.onRemove).toHaveBeenCalledWith(song);
        expect(handlers.onMove).toHaveBeenCalledWith(song, -1);
        act(() => renderer.unmount());
    });

    it("commits completed dragging but ignores cancellation and releases scrolling", () => {
        const { renderer, handlers } = render();
        const gesture = mockGestures[0];
        act(() => gesture.finalize());
        expect(handlers.onDragging).not.toHaveBeenCalled();
        act(() => {
            gesture.start(); gesture.update({ translationY: 100 }); gesture.end({ translationY: 100 }, false); gesture.finalize();
        });
        expect(handlers.onMove).not.toHaveBeenCalled();
        expect(handlers.onDragging.mock.calls).toEqual([[true], [false]]);
        act(() => {
            gesture.start(); gesture.end({ translationY: 100 }, true); gesture.finalize();
        });
        expect(handlers.onMove).toHaveBeenCalledWith(song, 2);
        act(() => renderer.unmount());
        expect(handlers.onDragging).toHaveBeenLastCalledWith(false);
    });

    it("shows a real VIP flag and reflects the current song's paused state", () => {
        mockPaused = true;
        const { renderer } = render({ ...song, fee: 1 });
        expect(renderer.root.findAllByType(Icon).some(node => node.props.name === "pause" && node.props.color === "#188A51")).toBe(true);
        expect(renderer.root.findAllByType(ThemeText).some(node => node.props.children === "VIP")).toBe(true);
        act(() => renderer.unmount());
        const free = render(song);
        expect(free.renderer.root.findAllByType(ThemeText).some(node => node.props.children === "VIP")).toBe(false);
        act(() => free.renderer.unmount());
    });
});
