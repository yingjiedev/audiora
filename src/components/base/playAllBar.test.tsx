import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, View } from "react-native";
import PlayAllBar from "./playAllBar";
import { iconSizeConst } from "@/constants/uiConst";
import TrackPlayer from "@/core/trackPlayer";
import { showPanel } from "../panels/usePanel";
import MusicSheet from "@/core/musicSheet";
import RoundActionButton from "./roundActionButton";
import { MusicRepeatMode } from "@/constants/repeatModeConst";
import { darkColors, lightColors } from "@/constants/colorPalette";
import { resolveThemeColors } from "@/utils/themeColors";
import { blendOver, contrastRatio } from "@/utils/colorContrast";

const mockNavigate = jest.fn();
let mockStarred = false;
let mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
jest.mock("./icon", () => "MockIcon");
jest.mock("./themeText", () => "MockText");
jest.mock("@/core/router", () => ({ ROUTE_PATH: { MUSIC_LIST_EDITOR: "editor" }, useNavigate: () => mockNavigate }));
jest.mock("@react-navigation/native", () => ({ useRoute: () => ({ name: "sheet" }) }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("@/core/musicSheet", () => ({ __esModule: true, default: { starMusicSheet: jest.fn(), unstarMusicSheet: jest.fn() }, useSheetIsStarred: () => mockStarred }));
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { repeatMode: "list", playWithReplacePlayList: jest.fn() } }));
jest.mock("../panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { success: jest.fn() } }));

const music: IMusic.IMusicItem = { id: "1", platform: "source", title: "Song", artist: "Artist", album: "Album", duration: 180, artwork: "" };

describe("PlayAllBar touch targets and behavior", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStarred = false;
        mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
        Object.assign(TrackPlayer, { repeatMode: "list" });
    });

    it("uses a small round play control and visible secondary labels without stretching", async () => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<PlayAllBar musicList={[music]} musicSheet={{ id: "sheet", title: "List" } as IMusic.IMusicSheetItem} />);
        });
        const findButton = (label: string) => renderer!.root.findAllByProps({ accessibilityLabel: label }).find(node => typeof node.props.onPress === "function")!;
        const add = findButton("musicListEditor.addToSheet");
        const edit = findButton("common.edit");
        for (const button of [add, edit]) {
            const style = StyleSheet.flatten(button.props.style({ pressed: false }));
            expect(style.minWidth).toBeGreaterThanOrEqual(44);
            expect(style.minHeight).toBeGreaterThanOrEqual(44);
            expect(style.width).toBeUndefined();
            expect(style.backgroundColor).toBeUndefined();
            const icon = button.findByType("MockIcon" as any);
            expect(icon.props.size).toBe(iconSizeConst.light);
            expect(icon.props.style).toBeUndefined();
            expect(button.findByType("MockText" as any).props.children).toBe(button.props.accessibilityLabel);
        }
        expect(add.findByType("MockIcon" as any).props.name).toBe("plus");
        expect(edit.findByType("MockIcon" as any).props.name).toBe("pencil-outline");
        const play = findButton("playAllBar.title");
        const playStyle = StyleSheet.flatten(play.props.style({ pressed: false }));
        expect(playStyle.flex).toBeUndefined();
        expect(playStyle.backgroundColor).toBeUndefined();
        const circle = play.findByType(RoundActionButton);
        expect(circle.props).toMatchObject({ size: 32, iconName: "play", variant: "solid" });
        expect(circle.props.onPress).toBeUndefined();
        await act(async () => {
            await add.props.onPress();
        });
        expect(showPanel).toHaveBeenCalledWith("AddToMusicSheet", { musicItem: [music], newSheetDefaultName: "List" });
        await act(async () => {
            await edit.props.onPress();
        });
        expect(mockNavigate).toHaveBeenCalledWith("editor", { musicList: [music], musicSheet: { title: "List", id: "sheet" } });
        act(() => findButton("playAllBar.title").props.onPress());
        expect(TrackPlayer.playWithReplacePlayList).toHaveBeenCalledWith(music, [music], { sheet: { id: "sheet", title: "List" }, routeName: "sheet" });
        act(() => renderer!.unmount());
    });

    it("disables play all for an empty list", () => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<PlayAllBar musicList={[]} />);
        });
        const play = renderer!.root.findAllByProps({ accessibilityLabel: "playAllBar.title" }).find(node => typeof node.props.onPress === "function")!;
        expect(play.props.disabled).toBe(true);
        expect(StyleSheet.flatten(play.props.style({ pressed: false })).opacity).toBe(0.45);
        act(() => play.props.onPress());
        expect(TrackPlayer.playWithReplacePlayList).not.toHaveBeenCalled();
        act(() => renderer!.unmount());
    });

    it.each([false, true])("preserves the playlist favorite toggle when selected=%s", async starred => {
        mockStarred = starred;
        const sheet = { id: "sheet", title: "List" } as IMusic.IMusicSheetItem;
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<PlayAllBar musicList={[music]} musicSheet={sheet} canStar />);
        });
        const label = starred ? "playAllBar.unstar" : "playAllBar.star";
        const button = renderer!.root.findAllByProps({ accessibilityLabel: label }).find(node => node.props.accessibilityRole === "button" && typeof node.props.onPress === "function")!;
        expect(button.props.accessibilityState).toEqual({ selected: starred });
        expect(button.findByType("MockText" as any).props.children).toBe(starred ? "playAllBar.savedAction" : "playAllBar.saveAction");
        await act(async () => {
            await button.props.onPress();
        });
        expect(starred ? MusicSheet.unstarMusicSheet : MusicSheet.starMusicSheet).toHaveBeenCalledWith(sheet);
        act(() => renderer!.unmount());
    });

    it("keeps shuffle playback scoped to the current playlist", () => {
        Object.assign(TrackPlayer, { repeatMode: MusicRepeatMode.SHUFFLE });
        const random = jest.spyOn(Math, "random").mockReturnValue(0.9);
        const second = { ...music, id: "2", title: "Second song" };
        let renderer: TestRenderer.ReactTestRenderer;
        try {
            act(() => {
                renderer = TestRenderer.create(<PlayAllBar musicList={[music, second]} />);
            });
            const play = renderer!.root.findAllByProps({ accessibilityLabel: "playAllBar.title" }).find(node => typeof node.props.onPress === "function")!;
            act(() => play.props.onPress());
            expect(TrackPlayer.playWithReplacePlayList).toHaveBeenCalledWith(second, [music, second], undefined);
            act(() => renderer!.unmount());
        } finally {
            random.mockRestore();
        }
    });

    it.each([
        ["light", lightColors, false],
        ["dark", darkColors, true],
        ["custom", { ...lightColors, primary: "#B68CFF", card: "rgba(255,255,255,0.8)" }, false],
    ] as const)("uses readable toolbar colors in %s", (_name, palette, dark) => {
        mockColors = resolveThemeColors({ ...palette, background: palette.pageBackground }, dark);
        mockStarred = true;
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<PlayAllBar musicList={[music]} musicSheet={{ id: "sheet", title: "List" } as IMusic.IMusicSheetItem} canStar />);
        });
        const defaultPage = dark ? darkColors.pageBackground : lightColors.pageBackground;
        const page = blendOver(mockColors.pageBackground ?? defaultPage, defaultPage);
        const card = blendOver(mockColors.card ?? palette.card, page);
        const round = renderer!.root.findByType(RoundActionButton);
        const fill = round.findAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.backgroundColor)!;
        const background = blendOver(StyleSheet.flatten(fill.props.style).backgroundColor as string, page);
        expect(contrastRatio(round.findByType("MockIcon" as any).props.color, background)).toBeGreaterThanOrEqual(4.5);
        for (const actualSurface of [page, card]) {
            expect(contrastRatio(blendOver(mockColors.primaryText, actualSurface), actualSurface)).toBeGreaterThanOrEqual(4.5);
            const texts = renderer!.root.findAllByType("MockText" as any).filter(node => node.props.color);
            texts.forEach(text => expect(contrastRatio(blendOver(text.props.color, actualSurface), actualSurface)).toBeGreaterThanOrEqual(4.5));
        }
        act(() => renderer!.unmount());
    });
});
