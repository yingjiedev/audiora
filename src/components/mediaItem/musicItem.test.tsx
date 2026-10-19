import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, View } from "react-native";
import MusicItem, { MUSIC_ITEM_HEIGHT } from "./musicItem";
import TrackPlayer from "@/core/trackPlayer";
import MusicSheet from "@/core/musicSheet";
import { showPanel } from "@/components/panels/usePanel";
import Toast from "@/utils/toast";
import Badge from "@/components/base/badge";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import { lightColors, darkColors } from "@/constants/colorPalette";
import { resolveThemeColors } from "@/utils/themeColors";
import { contrastRatio } from "@/utils/colorContrast";

const song = { id: "one", platform: "plugin", title: "Song", artist: "Artist", album: "Album", duration: 180 } as IMusic.IMusicItem;
let mockFavorite = false;
let mockCurrent: IMusic.IMusicItem | null = null;
let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { play: jest.fn(), addNext: jest.fn() }, useCurrentMusic: () => mockCurrent }));
jest.mock("@/core/musicSheet", () => {
    const addMusic = jest.fn(async (_sheetId: string, _item: IMusic.IMusicItem) => {});
    const removeMusic = jest.fn(async (_sheetId: string, _item: IMusic.IMusicItem) => {});
    return { __esModule: true, default: { defaultSheet: { id: "favorite" }, addMusic, removeMusic,
        favorites: { groupFor: () => undefined, toggle: jest.fn(item => mockFavorite ? removeMusic("favorite", item) : addMusic("favorite", item)) },
    }, useFavorite: () => mockFavorite };
});
jest.mock("@/core/localMusicSheet", () => ({ __esModule: true, default: { useIsLocal: () => false } }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string, args?: { count: number }) => key === "listening.playCount" ? `播放 ${args?.count} 次` : key }) }));
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/fastImage", () => "FastImage");
jest.mock("@/components/base/badge", () => "Badge");
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { success: jest.fn(), warn: jest.fn() } }));
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: 1 } }));
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("@/utils/artwork", () => ({ resolveArtwork: () => undefined }));
jest.mock("@/core/pluginManager", () => ({ __esModule: true, default: { getByMedia: () => ({ supportedMethods: new Set(["getMvSource"]) }) } }));
jest.mock("@/utils/mediaUtils", () => ({ isSameMediaItem: (a: IMusic.IMusicItem, b: IMusic.IMusicItem) => !!b && a.id === b.id && a.platform === b.platform }));

describe("shared song row interactions", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    beforeEach(() => {
        jest.clearAllMocks(); mockFavorite = false; mockCurrent = null;
        mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
    });
    afterEach(() => act(() => renderer?.unmount()));
    function render(props: Partial<React.ComponentProps<typeof MusicItem>> = {}) {
        act(() => {
            renderer = TestRenderer.create(<MusicItem musicItem={song} {...props} />);
        });
    }
    function button(label: string) {
        return renderer.root.findAllByProps({ accessibilityLabel: label }).find(node => typeof node.props.onPress === "function")!;
    }

    it("keeps row playback separate from next-play and contextual menu actions", () => {
        const sheet = { id: "sheet", title: "Sheet", platform: "plugin" } as IMusic.IMusicSheetItem;
        render({ musicSheet: sheet });
        const play = button("Song - Artist");
        const next = button("musicListEditor.addToNextPlay");
        const more = button("musicDetail.a11y.more");
        expect(play.parent).not.toBe(next.parent);
        expect(play.findAll(node => node.props.accessibilityLabel === "musicListEditor.addToNextPlay")).toHaveLength(0);
        act(() => {
            next.props.onPress(); more.props.onPress();
        });
        expect(TrackPlayer.play).not.toHaveBeenCalled();
        expect(TrackPlayer.addNext).toHaveBeenCalledWith(song);
        expect(showPanel).toHaveBeenCalledWith("MusicItemOptions", { musicItem: song, musicSheet: sheet });
        act(() => play.props.onPress());
        expect(TrackPlayer.play).toHaveBeenCalledWith(song);
    });
    it("preserves caller playback and long-press handlers", () => {
        const onItemPress = jest.fn(); const onItemLongPress = jest.fn();
        render({ onItemPress, onItemLongPress });
        act(() => {
            button("Song - Artist").props.onPress(); button("Song - Artist").props.onLongPress();
        });
        expect(onItemPress).toHaveBeenCalledWith(song);
        expect(onItemLongPress).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.play).not.toHaveBeenCalled();
    });
    it("allows editing mode to select the row without playback actions", () => {
        const select = jest.fn();
        render({ left: <View testID="selection" />, actions: [], onItemPress: select });
        expect(renderer.root.findAll(node => node.props.accessibilityLabel === "musicDetail.a11y.more")).toHaveLength(0);
        expect(renderer.root.findByProps({ testID: "selection" })).toBeDefined();
        act(() => button("Song - Artist").props.onPress());
        expect(select).toHaveBeenCalledWith(song);
    });
    it("compacts both row and hit area while preserving normal rows and playback", () => {
        const play = jest.fn();
        render({ density: "compact", actions: [], onItemPress: play });
        const outer = StyleSheet.flatten(renderer.root.findAllByType(View)[0].props.style);
        const main = StyleSheet.flatten(button("Song - Artist").props.style({ pressed: false }));
        expect(outer.minHeight).toBeGreaterThanOrEqual(44);
        expect(main.minHeight).toBeGreaterThanOrEqual(44);
        expect(main.minHeight).toBeLessThan(MUSIC_ITEM_HEIGHT);
        expect(outer.paddingLeft).toBe(0);
        expect(outer.paddingRight).toBe(0);
        expect(renderer.root.findAllByType(ThemeText).find(node => node.props.children === "Song")?.props.fontSize).toBe("subTitle");
        expect(renderer.root.findAllByType(ThemeText).find(node => node.props.fontSize === "tag")).toBeDefined();
        act(() => button("Song - Artist").props.onPress());
        expect(play).toHaveBeenCalledWith(song);
        act(() => renderer.update(<MusicItem musicItem={song} />));
        expect(StyleSheet.flatten(button("Song - Artist").props.style({ pressed: false })).minHeight).toBe(MUSIC_ITEM_HEIGHT);
        expect(renderer.root.findAllByType(ThemeText).find(node => node.props.children === "Song")?.props.fontSize).toBe("content");
    });
    it("adds and removes the actual song in favorites without playing it", async () => {
        render({ actions: ["favorite"] });
        await act(async () => button("musicDetail.a11y.favorite").props.onPress());
        expect(MusicSheet.addMusic).toHaveBeenCalledWith("favorite", song);
        mockFavorite = true;
        act(() => renderer.update(<MusicItem musicItem={song} actions={["favorite"]} />));
        await act(async () => button("musicDetail.a11y.unfavorite").props.onPress());
        expect(MusicSheet.removeMusic).toHaveBeenCalledWith("favorite", song);
        expect(TrackPlayer.play).not.toHaveBeenCalled();
    });
    it("ignores repeated favorite taps while saving", async () => {
        let complete!: () => void;
        (MusicSheet.addMusic as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => {
            complete = resolve;
        }));
        render({ actions: ["favorite"] });
        const toggle = button("musicDetail.a11y.favorite").props.onPress;
        let pending!: Promise<void>;
        act(() => {
            pending = toggle(); toggle();
        });
        expect(MusicSheet.addMusic).toHaveBeenCalledTimes(1);
        expect(button("musicDetail.a11y.favorite").props.disabled).toBe(true);
        await act(async () => {
            complete(); await pending;
        });
        expect(button("musicDetail.a11y.favorite").props.disabled).toBe(false);
    });
    it("recovers from favorite persistence failure", async () => {
        (MusicSheet.addMusic as jest.Mock).mockRejectedValueOnce(new Error("disk"));
        render({ actions: ["favorite"] });
        await act(async () => button("musicDetail.a11y.favorite").props.onPress());
        expect(Toast.warn).toHaveBeenCalledWith("panel.addToMusicSheet.toast.fail");
        expect(button("musicDetail.a11y.favorite").props.disabled).toBe(false);
    });
    it("tracks the current song by platform and id and only shows real badges", () => {
        mockCurrent = { ...song };
        render({ musicItem: { ...song, fee: 1, mv: 42 } });
        expect(button("Song - Artist").props.accessibilityState.selected).toBe(true);
        expect(renderer.root.findAllByType(Badge).map(node => node.props.children)).toEqual(["VIP", "MV"]);
        mockCurrent = { ...song, platform: "another" };
        act(() => renderer.update(<MusicItem musicItem={song} />));
        expect(button("Song - Artist").props.accessibilityState.selected).toBe(false);
        expect(renderer.root.findAllByType(Badge)).toHaveLength(0);
    });
    it("simplifies discovery metadata without changing library rows or favorite actions", async () => {
        const previewSong = { ...song, fee: 1, mv: 42, qualities: { "320k": {} } };
        render({ musicItem: previewSong, showCover: true, density: "compact", presentation: "discovery", actions: ["favorite"] });
        expect(renderer.root.findAllByType(Badge)).toHaveLength(0);
        const artist = renderer.root.findAllByType(ThemeText).find(node => Array.isArray(node.props.children) && node.props.children.join("") === "Artist");
        expect(artist?.props.fontSize).toBe("description");
        const cover = renderer.root.findByType("FastImage" as any);
        const previewWidth = StyleSheet.flatten(cover.props.style).width;
        await act(async () => button("musicDetail.a11y.favorite").props.onPress());
        expect(MusicSheet.addMusic).toHaveBeenCalledWith("favorite", previewSong);
        expect(TrackPlayer.play).not.toHaveBeenCalled();
        act(() => renderer.update(<MusicItem musicItem={previewSong} showCover />));
        expect(renderer.root.findAllByType(Badge).map(node => node.props.children)).toEqual(["HQ", "VIP", "MV"]);
        expect(StyleSheet.flatten(renderer.root.findByType("FastImage" as any).props.style).width).toBeLessThan(previewWidth);
        const texts = renderer.root.findAllByType(ThemeText);
        expect(texts.some(node => Array.isArray(node.props.children) && node.props.children.join("") === "Artist · Album")).toBe(true);
    });
    it("highlights matching title words without losing suffixes", () => {
        render({ musicItem: { ...song, title: "Song (Live)" }, highlightText: "Song" });
        const texts = renderer.root.findAllByType(ThemeText);
        expect(texts.some(node => node.props.children === "Song" && node.props.fontColor === "primary")).toBe(true);
        expect(texts.some(node => node.props.children === " (Live)" && node.props.fontColor === "text")).toBe(true);
    });
    function layOutSource(x = 120) {
        const anchor = renderer.root.findAllByType(View).find(node => typeof node.props.onLayout === "function")!;
        act(() => anchor.props.onLayout({ nativeEvent: { layout: { x, y: 0, width: 44, height: 0 } } }));
    }
    it("keeps source selection separate from playback and metadata within the existing row", () => {
        const onChoose = jest.fn();
        render({ source: { name: "小狗音乐", count: 2, onPress: onChoose }, titleTagSubText: "03:00" });
        const outer = StyleSheet.flatten(renderer.root.findAllByType(View)[0].props.style);
        expect(outer.minHeight).toBe(MUSIC_ITEM_HEIGHT);
        layOutSource();
        const choose = button("aggregate.chooseSource");
        const play = button("Song - Artist");
        expect(play.findAll(node => node.props.accessibilityLabel === "aggregate.chooseSource")).toHaveLength(0);
        expect(StyleSheet.flatten(choose.props.style)).toMatchObject({ left: 120, height: 44, width: 44, position: "absolute" });
        act(() => choose.props.onPress());
        expect(onChoose).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.play).not.toHaveBeenCalled();
        expect(TrackPlayer.addNext).not.toHaveBeenCalled();
        expect(renderer.root.findAllByType(ThemeText).some(node => node.props.children === "小狗音乐")).toBe(true);
        expect(renderer.root.findAllByType(ThemeText).some(node => node.props.children === 2)).toBe(true);
        act(() => play.props.onPress());
        expect(TrackPlayer.play).toHaveBeenCalledWith(song);
    });
    it("keeps single-source attribution visible and marks actual playback without a switch button", () => {
        render({ musicItem: { ...song, fee: 1, mv: 42 }, source: { name: "QQ音乐", count: 1, playing: true } });
        expect(renderer.root.findAllByType(Badge)).toHaveLength(0);
        expect(renderer.root.findAllByProps({ accessibilityLabel: "aggregate.chooseSource" })).toHaveLength(0);
        expect(renderer.root.findAllByType(Icon).some(node => node.props.name === "speaker-wave")).toBe(true);
        const source = renderer.root.findAllByType(ThemeText).find(node => node.props.children === "QQ音乐")!;
        expect(source.props.accessibilityLabel).toBe("aggregate.playingSource");
        expect(source.props.fontColor).toBe("primary");
        expect(StyleSheet.flatten(source.props.style).maxWidth).toBe("42%");
    });
    it("reserves the count beside a truncated long title and follows layout changes", () => {
        render({ musicItem: { ...song, title: "A very long song title (Live version)" }, source: { name: "Long source name", count: 24, onPress: jest.fn() } });
        layOutSource(160);
        const title = renderer.root.findAllByType(ThemeText).find(node => node.props.numberOfLines === 1 && Array.isArray(node.props.children))!;
        expect(StyleSheet.flatten(title.props.style).flexShrink).toBe(1);
        expect(StyleSheet.flatten(button("aggregate.chooseSource").props.style).left).toBe(160);
        layOutSource(100);
        expect(StyleSheet.flatten(button("aggregate.chooseSource").props.style).left).toBe(100);
    });
    it.each([lightColors, darkColors, { ...lightColors, primary: "#ac52bd" }])("keeps the numeric control readable in light, dark and custom themes", palette => {
        mockColors = resolveThemeColors({ ...palette, background: palette.pageBackground }, palette === darkColors);
        render({ source: { name: "Source", count: 2, onPress: jest.fn() } });
        layOutSource();
        const number = renderer.root.findAllByType(ThemeText).find(node => node.props.children === 2)!;
        const background = StyleSheet.flatten(number.parent!.props.style).backgroundColor;
        expect(contrastRatio(number.props.color, background)).toBeGreaterThanOrEqual(4.5);
    });

    it("keeps replay counts and aggregate source controls independent when both props are present", () => {
        const chooseSource = jest.fn();
        render({ presentation: "favorites", playCount: 128, sourceName: "Favorite source",
            source: { name: "Playback source", count: 2, onPress: chooseSource }, actions: [],
        });
        layOutSource();
        expect(renderer.root.findByProps({ testID: "music-play-count" }).findByType(ThemeText).props.children).toBe("99+");
        const sourceButton = button("aggregate.chooseSource");
        expect(sourceButton).toBeDefined();
        expect(button("Song - Artist").props.accessibilityHint).toBe("Album · Favorite source · 播放 128 次 · aggregate.currentSource");
        act(() => sourceButton.props.onPress());
        expect(chooseSource).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.play).not.toHaveBeenCalled();
        act(() => button("Song - Artist").props.onPress());
        expect(TrackPlayer.play).toHaveBeenCalledWith(song);
    });

    it.each([[1, "1"], [12, "12"], [99, "99"], [100, "99+"], [1234, "99+"]])("caps the favorite badge for %s plays while preserving the full spoken total", (count, displayed) => {
        render({ presentation: "favorites", density: "compact", playCount: count, sourceName: "My source" });
        const badge = renderer.root.findByProps({ testID: "music-play-count" });
        expect(badge.findByType(ThemeText).props.children).toBe(displayed);
        expect(badge.findByType("Icon" as any).props.name).toBe("play");
        expect(badge.props.onPress).toBeUndefined();
        expect(badge.props.importantForAccessibility).toBe("no-hide-descendants");
        expect(button("Song - Artist").props.accessibilityHint).toBe(`Album · My source · 播放 ${count} 次`);
    });

    it.each([undefined, 0, -1, NaN, Infinity])("hides empty or invalid play counts: %s", count => {
        render({ presentation: "favorites", playCount: count });
        expect(renderer.root.findAllByProps({ testID: "music-play-count" })).toHaveLength(0);
        expect(button("Song - Artist").props.accessibilityHint).toBe("Album · 播放 0 次");
    });

    it("keeps a long favorite title truncatable beside the badge and isolates favorite taps", async () => {
        const longSong = { ...song, title: "A long title that must leave space for its play counter", artist: "A long artist", album: "An actual album" };
        render({ musicItem: longSong, presentation: "favorites", density: "compact", playCount: 128, sourceName: "Renamed source", actions: ["favorite"] });
        const badge = renderer.root.findByProps({ testID: "music-play-count" });
        const heading = badge.parent!;
        const title = heading.findAllByType(ThemeText).find(node => node.props.numberOfLines === 1)!;
        expect(StyleSheet.flatten(title.props.style)).toMatchObject({ flexShrink: 1, minWidth: 0 });
        expect(StyleSheet.flatten(badge.props.style).flexShrink).toBe(0);
        const text = renderer.root.findAllByType(ThemeText).map(node => React.Children.toArray(node.props.children).filter(child => typeof child === "string").join(""));
        expect(text).toContain("A long artist · An actual album");
        expect(text).toContain(" | Renamed source");
        await act(async () => button("musicDetail.a11y.favorite").props.onPress());
        expect(MusicSheet.addMusic).toHaveBeenCalledWith("favorite", longSong);
        expect(TrackPlayer.play).not.toHaveBeenCalled();
        act(() => button(`${longSong.title} - ${longSong.artist}`).props.onPress());
        expect(TrackPlayer.play).toHaveBeenCalledWith(longSong);
    });

    it("omits absent and duplicate album metadata and leaves other presentations unchanged", () => {
        render({ musicItem: { ...song, artist: "", album: "Song" }, presentation: "favorites", playCount: 12, sourceName: "  Source  " });
        expect(button("Song").props.accessibilityHint).toBe("Source · 播放 12 次");
        expect(renderer.root.findAllByType(ThemeText).some(node => node.props.children === "Source")).toBe(true);
        act(() => renderer.update(<MusicItem musicItem={{ ...song, album: "" }} presentation="favorites" sourceName=" " />));
        expect(button("Song - Artist").props.accessibilityHint).toBe("播放 0 次");
        for (const presentation of ["library", "discovery"] as const) {
            act(() => renderer.update(<MusicItem musicItem={song} presentation={presentation} playCount={12} sourceName="Source" />));
            expect(renderer.root.findAllByProps({ testID: "music-play-count" })).toHaveLength(0);
            expect(button("Song - Artist").props.accessibilityHint).toBeUndefined();
        }
    });

    it.each([
        ["light", lightColors, false],
        ["dark", darkColors, true],
        ["custom", { ...lightColors, primary: "#FFCC00" }, false],
        ["transparent", { ...darkColors, primary: "rgba(116,89,199,0.4)", card: "rgba(18,18,18,0.22)" }, true],
    ] as const)("uses readable theme colors for the count in %s", (_name, palette, dark) => {
        mockColors = resolveThemeColors({ ...palette, background: palette.pageBackground }, dark);
        render({ presentation: "favorites", playCount: 99 });
        const badge = renderer.root.findByProps({ testID: "music-play-count" });
        const fill = StyleSheet.flatten(badge.props.style).backgroundColor;
        expect(fill).toBe(mockColors.tonalSurface);
        for (const foreground of [badge.findByType(ThemeText).props.color, badge.findByType("Icon" as any).props.color]) {
            expect(foreground).toBe(mockColors.onTonal);
            expect(contrastRatio(foreground, fill)).toBeGreaterThanOrEqual(4.5);
        }
    });
});
