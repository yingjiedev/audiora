import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { BackHandler } from "react-native";
import SheetDetail from "./index";
import MusicItem from "@/components/mediaItem/musicItem";
import Checkbox from "@/components/base/checkbox";
import ThemeText from "@/components/base/themeText";
import TrackPlayer from "@/core/trackPlayer";
import MusicSheet from "@/core/musicSheet";
import downloader from "@/core/downloader";
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import Toast from "@/utils/toast";

const songs = [
    { id: "one", platform: "source", title: "First", artist: "Artist" },
    { id: "two", platform: "source", title: "Second", artist: "Artist" },
] as IMusic.IMusicItem[];
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockPlayerOpen = false;
const mockSheet = { id: "favorite", title: "Favorites", musicList: songs };
jest.mock("@shopify/flash-list", () => {
    const ReactModule = require("react");
    return {
        FlashList: ReactModule.forwardRef((props: any, ref: any) => {
            ReactModule.useImperativeHandle(ref, () => ({ scrollToIndex: jest.fn() }));
            return ReactModule.createElement("FlashList", props,
                props.ListHeaderComponent,
                props.data.map((item: IMusic.IMusicItem, index: number) =>
                    ReactModule.createElement(ReactModule.Fragment, { key: `${item.platform}@${item.id}` }, props.renderItem({ item, index })),
                ),
            );
        }),
    };
});
jest.mock("@/components/base/appBar", () => (props: any) => {
    const ReactModule = require("react");
    return ReactModule.createElement("AppBar", props,
        ReactModule.createElement("Back", { accessibilityLabel: "back", onPress: props.onBackPress ?? mockGoBack }),
        props.actionComponent,
        props.menu?.map((item: any) => ReactModule.createElement("MenuItem", { key: item.title, accessibilityLabel: item.title, onPress: item.onPress })),
    );
});
jest.mock("@/core/router", () => ({ useParams: () => ({ id: "favorite" }), useNavigate: () => mockNavigate, ROUTE_PATH: { MUSIC_LIST_EDITOR: "editor", SEARCH_MUSIC_LIST: "search" } }));
jest.mock("@react-navigation/native", () => ({
    useRoute: () => ({ name: "local-sheet-detail" }),
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
    useFocusEffect: (callback: () => (() => void) | undefined) => require("react").useEffect(callback, [callback]),
}));
jest.mock("@/hooks/useHasCustomBackground", () => ({ LocalBackgroundContext: require("react").createContext(false) }));
jest.mock("@/components/base/verticalSafeAreaView", () => require("react-native").View);
jest.mock("@/components/base/horizontalSafeAreaView", () => require("react-native").View);
jest.mock("@/components/base/statusBar", () => "StatusBar");
jest.mock("@/components/base/customBackground", () => "CustomBackground");
jest.mock("@/components/base/mediaDetailHeader", () => "MediaDetailHeader");
jest.mock("@/components/base/listEmpty", () => "ListEmpty");
jest.mock("@/components/base/listFooter", () => "ListFooter");
jest.mock("@/core/playerOverlay", () => ({ isPlayerOpen: () => mockPlayerOpen }));
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { playWithReplacePlayList: jest.fn(), addNext: jest.fn(async () => {}) }, useCurrentMusic: () => null }));
jest.mock("@/core/musicSheet", () => ({ __esModule: true, default: {
    removeMusic: jest.fn(async () => {}), defaultSheet: { id: "favorite" }, getSheetMeta: jest.fn(),
    favorites: { groupFor: jest.fn(), toggle: jest.fn(async () => {}) },
}, useSheetItem: () => mockSheet, useFavorite: () => false, useSheetIsStarred: () => false }));
jest.mock("@/core/localMusicSheet", () => ({ __esModule: true, default: { useIsLocal: () => false } }));
jest.mock("@/core/downloader", () => ({ __esModule: true, default: { download: jest.fn() } }));
jest.mock("@/core/pluginManager", () => ({ usePluginDisplayNameResolver: () => (name: string) => name }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string, args?: { count: number }) => args?.count === undefined ? key : `${key}:${args.count}` }) }));
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: jest.fn() }));
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/fastImage", () => "FastImage");
jest.mock("@/components/base/badge", () => "Badge");
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { success: jest.fn(), warn: jest.fn() } }));
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: 1 } }));
jest.mock("@/constants/commonConst", () => ({ RequestStateCode: { IDLE: 0, PARTLY_DONE: 1 }, SortType: { None: 0, Title: 1, Artist: 2, Album: 3, Newest: 4, Oldest: 5 } }));
jest.mock("@/hooks/useColors", () => () => ({ text: "black", textSecondary: "gray", primary: "blue", onPrimary: "white", appBarText: "black", card: "white" }));
jest.mock("@/utils/artwork", () => ({ resolveArtwork: () => undefined }));
jest.mock("@/utils/musicVideo", () => ({ canPlayMusicVideo: () => false }));
jest.mock("@/utils/mediaUtils", () => ({ getMediaUniqueKey: (item: IMusic.IMusicItem) => `${item.platform}@${item.id}`, isSameMediaItem: () => false }));

describe("local playlist inline editing", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    const button = (label: string) => renderer.root.findAllByProps({ accessibilityLabel: label }).find(node => typeof node.props.onPress === "function")!;
    const press = async (label: string) => {
        await act(async () => {
            await button(label).props.onPress();
        });
    };
    const rows = () => renderer.root.findAllByType(MusicItem);
    beforeEach(() => {
        jest.clearAllMocks();
        mockPlayerOpen = false;
        act(() => {
            renderer = TestRenderer.create(<SheetDetail />);
        });
    });
    afterEach(() => {
        act(() => renderer.unmount());
        jest.restoreAllMocks();
    });

    it("keeps the source list mounted and adds selection before the existing numbers", async () => {
        await press("aggregate.bySource");
        const originalList = renderer.root.findByType("FlashList" as any);
        const originalRows = rows();
        await press("common.edit");
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(renderer.root.findByType("FlashList" as any)).toBe(originalList);
        expect(rows()).toEqual(originalRows);
        expect(rows().map(row => row.props.index)).toEqual([1, 2]);
        expect(rows().every(row => row.props.left && row.props.checked === false && row.props.actions.length === 0)).toBe(true);
        const main = button("First - Artist");
        expect(main.props.accessibilityRole).toBe("checkbox");
        const contentOrder = main.findAll(node => node.type === Checkbox || node.type === ThemeText);
        expect(contentOrder[0].type).toBe(Checkbox);
        expect(contentOrder[1].props.children).toBe(1);
        await press("First - Artist");
        expect(button("First - Artist").props.accessibilityState.checked).toBe(true);
        expect(TrackPlayer.playWithReplacePlayList).not.toHaveBeenCalled();
        expect(renderer.root.findAllByProps({ children: "musicListEditor.selectMusicCount:1" }).length).toBeGreaterThan(0);
        expect(rows()[0].findAllByType("Icon" as any).find(node => node.props.name === "check")?.props.color).toBe("white");
        await press("common.selectAll");
        expect(rows().every(row => row.props.checked)).toBe(true);
        await press("common.unselectAll");
        expect(rows().every(row => row.props.checked === false)).toBe(true);
        await press("common.done");
        expect(renderer.root.findByType("FlashList" as any)).toBe(originalList);
        expect(rows().every(row => row.props.checked === undefined && !row.props.left)).toBe(true);
        await press("Second - Artist");
        expect(TrackPlayer.playWithReplacePlayList).toHaveBeenCalledWith(songs[1], songs, { sheet: mockSheet, routeName: "local-sheet-detail" });
    });

    it("edits original sources from grouped favorites and restores the grouped view on completion", async () => {
        expect(rows().every(row => row.props.source)).toBe(true);
        await press("common.edit");
        expect(rows().map(row => row.props.musicItem)).toEqual(songs);
        expect(rows().every(row => !row.props.source && row.props.checked === false)).toBe(true);
        await press("First - Artist");
        expect(rows()[0].props.checked).toBe(true);
        await press("common.done");
        expect(rows().every(row => row.props.source && row.props.checked === undefined)).toBe(true);
        expect(TrackPlayer.playWithReplacePlayList).not.toHaveBeenCalled();
    });

    it("uses the menu to enter selection and keeps manual reordering available separately", async () => {
        await press("sheetDetail.manualSortMusic");
        expect(mockNavigate).toHaveBeenCalledWith("editor", { musicList: songs, musicSheet: mockSheet });
        mockNavigate.mockClear();
        await press("sheetDetail.batchEditMusic");
        expect(rows()[0].props.checked).toBe(false);
        await press("back");
        expect(rows()[0].props.checked).toBeUndefined();
        expect(mockGoBack).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("exits editing on hardware back while allowing an open player to handle back first", async () => {
        const listener = jest.spyOn(BackHandler, "addEventListener");
        await press("common.edit");
        const back = listener.mock.calls.find(([event]) => event === "hardwareBackPress")![1];
        const event = { type: "hardwareBackPress", timeStamp: 1 };
        mockPlayerOpen = true;
        expect(back(event)).toBe(false);
        expect(rows()[0].props.checked).toBe(false);
        mockPlayerOpen = false;
        act(() => {
            expect(back(event)).toBe(true);
        });
        expect(rows()[0].props.checked).toBeUndefined();
        expect(mockGoBack).not.toHaveBeenCalled();
    });

    it("disables empty actions and passes only selected songs to next-play, add and download", async () => {
        await press("common.edit");
        for (const label of ["musicListEditor.addToNextPlay", "musicListEditor.addToSheet", "common.download", "sheetDetail.removeFromSheet"]) {
            expect(button(label).props.disabled).toBe(true);
            await press(label);
        }
        expect(TrackPlayer.addNext).not.toHaveBeenCalled();
        expect(showDialog).not.toHaveBeenCalled();
        await press("Second - Artist");
        await press("musicListEditor.addToNextPlay");
        expect(TrackPlayer.addNext).toHaveBeenCalledWith([songs[1]]);
        expect(rows().every(row => row.props.checked === false)).toBe(true);
        await press("First - Artist");
        await press("musicListEditor.addToSheet");
        expect(showPanel).toHaveBeenCalledWith("AddToMusicSheet", { musicItem: [songs[0]] });
        await press("Second - Artist");
        await press("common.download");
        expect(downloader.download).toHaveBeenCalledWith([songs[1]]);
        expect(rows().every(row => row.props.checked === false)).toBe(true);
    });

    it("removes only the confirmed selection and retains it when removal fails", async () => {
        await press("common.edit");
        await press("First - Artist");
        await press("sheetDetail.removeFromSheet");
        expect(MusicSheet.removeMusic).not.toHaveBeenCalled();
        expect(showDialog).toHaveBeenLastCalledWith("SimpleDialog", expect.objectContaining({ content: "sheetDetail.removeSelectedContent:1" }));
        (MusicSheet.removeMusic as jest.Mock).mockRejectedValueOnce(new Error("disk"));
        await act(async () => {
            (showDialog as jest.Mock).mock.calls.at(-1)[1].onOk();
        });
        expect(MusicSheet.removeMusic).toHaveBeenCalledWith("favorite", [songs[0]]);
        expect(Toast.warn).toHaveBeenCalledWith("musicListEditor.actionFailed");
        expect(rows()[0].props.checked).toBe(true);
        await press("sheetDetail.removeFromSheet");
        await act(async () => {
            (showDialog as jest.Mock).mock.calls.at(-1)[1].onOk();
        });
        expect(Toast.success).toHaveBeenCalledWith("sheetDetail.removeSuccess");
        expect(rows().every(row => row.props.checked === false)).toBe(true);
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("blocks duplicate submissions, retains selection on failure and allows retry", async () => {
        let reject!: (error: Error) => void;
        (TrackPlayer.addNext as jest.Mock).mockImplementationOnce(() => new Promise<void>((_resolve, fail) => {
            reject = fail;
        }));
        await press("common.edit");
        await press("First - Artist");
        const submit = button("musicListEditor.addToNextPlay").props.onPress;
        act(() => {
            submit(); submit();
        });
        expect(TrackPlayer.addNext).toHaveBeenCalledTimes(1);
        expect(button("sheetDetail.removeFromSheet").props.disabled).toBe(true);
        await act(async () => {
            reject(new Error("queue"));
        });
        expect(Toast.warn).toHaveBeenCalledWith("musicListEditor.actionFailed");
        expect(rows()[0].props.checked).toBe(true);
        await press("musicListEditor.addToNextPlay");
        expect(TrackPlayer.addNext).toHaveBeenCalledTimes(2);
        expect(rows()[0].props.checked).toBe(false);
    });

    it("keeps songs selected during an in-flight operation out of that submission", async () => {
        let complete!: () => void;
        (TrackPlayer.addNext as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => {
            complete = resolve;
        }));
        await press("common.edit");
        await press("First - Artist");
        act(() => {
            button("musicListEditor.addToNextPlay").props.onPress();
        });
        await press("Second - Artist");
        await act(async () => {
            complete();
        });
        expect(TrackPlayer.addNext).toHaveBeenCalledWith([songs[0]]);
        expect(rows().map(row => row.props.checked)).toEqual([false, true]);
    });
});
