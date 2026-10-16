/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, View } from "react-native";
import { createStore, Provider } from "jotai";
import MusicList from "./musicList";
import MusicItem from "@/components/mediaItem/musicItem";
import SortableFlatList from "@/components/base/SortableFlatList";
import TrackPlayer from "@/core/trackPlayer";
import { editingMusicListAtom, musicListChangedAtom } from "../store/atom";

jest.mock("@shopify/flash-list", () => {
    const ReactModule = require("react");
    return {
        FlashList: ReactModule.forwardRef((props: any, ref: any) => {
            ReactModule.useImperativeHandle(ref, () => ({ scrollToOffset: jest.fn() }));
            return ReactModule.createElement("FlashList", props,
                props.data.map((item: any, index: number) =>
                    ReactModule.createElement(ReactModule.Fragment, { key: item.musicItem.id }, props.renderItem({ item, index })),
                ),
            );
        }),
    };
});
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { play: jest.fn() }, useCurrentMusic: () => null }));
jest.mock("@/core/musicSheet", () => ({ __esModule: true, default: {}, useFavorite: () => false }));
jest.mock("@/core/localMusicSheet", () => ({ __esModule: true, default: { useIsLocal: () => false } }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/fastImage", () => "FastImage");
jest.mock("@/components/base/badge", () => "Badge");
jest.mock("@/components/base/empty", () => "Empty");
jest.mock("@/utils/toast", () => ({ __esModule: true, default: {} }));
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: 1 } }));
jest.mock("@/hooks/useTextColor", () => () => "black");
jest.mock("@/hooks/useColors", () => () => ({ text: "black", textSecondary: "gray", placeholder: "lightgray" }));
jest.mock("@/utils/artwork", () => ({ resolveArtwork: () => undefined }));
jest.mock("@/utils/musicVideo", () => ({ canPlayMusicVideo: () => false }));
jest.mock("@/utils/mediaUtils", () => ({ isSameMediaItem: () => false }));

const songs = [
    { id: "one", platform: "plugin", title: "First song", artist: "First artist" },
    { id: "two", platform: "plugin", title: "Second song", artist: "Second artist" },
] as IMusic.IMusicItem[];

describe("music list editor rows", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    let store: ReturnType<typeof createStore>;
    beforeEach(() => {
        jest.clearAllMocks();
        store = createStore();
        store.set(editingMusicListAtom, songs.map(musicItem => ({ musicItem, checked: false })));
        act(() => {
            renderer = TestRenderer.create(<Provider store={store}><MusicList /></Provider>, {
                createNodeMock: () => ({ setNativeProps: jest.fn() }),
            });
        });
    });
    afterEach(() => act(() => renderer.unmount()));

    it("gives normal rows and the drag preview the available width inside the horizontal sortable wrapper", () => {
        const assertRows = (count: number) => {
            const rows = renderer.root.findAllByType(MusicItem);
            expect(rows).toHaveLength(count);
            for (const row of rows) {
                const layout = StyleSheet.flatten(row.findAllByType(View)[0].props.style);
                expect(layout.flex).toBe(1);
                expect(layout.minWidth).toBe(0);
                expect(row.findAllByProps({ accessibilityLabel: `${row.props.musicItem.title} - ${row.props.musicItem.artist}` }).length).toBeGreaterThan(0);
                expect(layout.paddingRight).toBeGreaterThan(0);
            }
        };
        assertRows(2);
        const handle = renderer.root.findAll(node => typeof node.props.onTouchStart === "function" && !node.props.onTouchMove)[0];
        act(() => handle.props.onTouchStart());
        assertRows(3);
        expect(renderer.root.findByType("FlashList" as any).props.scrollEnabled).toBe(false);
        act(() => renderer.root.findByType("FlashList" as any).props.onTouchCancel());
        assertRows(2);
    });

    it("selects the correct songs before and after sorting without starting playback", () => {
        const select = (label: string) => act(() => {
            renderer.root.findAllByProps({ accessibilityLabel: label }).find(node => typeof node.props.onPress === "function")!.props.onPress();
        });
        select("First song - First artist");
        expect(store.get(editingMusicListAtom).map(item => item.checked)).toEqual([true, false]);
        expect(store.get(musicListChangedAtom)).toBe(false);
        act(() => renderer.root.findByType(SortableFlatList).props.onSortEnd([...store.get(editingMusicListAtom)].reverse()));
        expect(store.get(editingMusicListAtom).map(item => item.musicItem.id)).toEqual(["two", "one"]);
        expect(store.get(musicListChangedAtom)).toBe(true);
        select("Second song - Second artist");
        expect(store.get(editingMusicListAtom).map(item => item.checked)).toEqual([true, true]);
        expect(TrackPlayer.play).not.toHaveBeenCalled();
    });
});
