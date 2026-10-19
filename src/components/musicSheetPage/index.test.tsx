import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { BackHandler } from "react-native";
import MusicSheetPage from ".";
import MusicItem from "@/components/mediaItem/musicItem";
import { PageAction } from "@/components/base/pageSection";
import { RequestStateCode } from "@/constants/commonConst";
import TrackPlayer from "@/core/trackPlayer";

const mockNavigate = jest.fn();
let mockPlayerOpen = false;
jest.mock("@/utils/motion", () => ({ motionDuration: jest.fn(), motionEasing: {} }));
jest.mock("@react-navigation/native", () => ({
    useRoute: () => ({ name: "album-detail" }),
    useFocusEffect: (callback: any) => require("react").useEffect(callback, [callback]),
}));
jest.mock("@/core/router", () => ({ useNavigate: () => mockNavigate, ROUTE_PATH: { SEARCH_MUSIC_LIST: "search" } }));
jest.mock("@/core/playerOverlay", () => ({ isPlayerOpen: () => mockPlayerOpen }));
jest.mock("@/core/pluginManager", () => ({ usePluginDisplayNameResolver: () => (platform: string) => platform }));
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { play: jest.fn(), addNext: jest.fn() }, useCurrentMusic: () => null }));
jest.mock("@/core/downloader", () => ({ __esModule: true, default: { download: jest.fn() } }));
jest.mock("@/core/appConfig", () => ({ __esModule: true, default: { getConfig: () => "playMusic" } }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string, args?: { count: number }) => `${key}${args?.count ?? ""}` }) }));
jest.mock("@/hooks/useColors", () => () => ({ text: "black", textSecondary: "gray", card: "white", border: "gray" }));
jest.mock("@/components/panels/usePanel", () => ({ showPanel: jest.fn() }));
jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: jest.fn() }));
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { success: jest.fn(), warn: jest.fn() } }));
jest.mock("@/components/base/appBar", () => (props: any) => require("react").createElement("AppBar", props, props.actionComponent));
jest.mock("@/components/base/verticalSafeAreaView", () => require("react-native").View);
jest.mock("@/components/base/horizontalSafeAreaView", () => require("react-native").View);
jest.mock("@/components/base/statusBar", () => "StatusBar");
jest.mock("@/components/base/mediaDetailHeader", () => "MediaDetailHeader");
jest.mock("@/components/base/playAllBar", () => (props: any) => require("react").createElement("Edit", { onPress: props.onEdit }));
jest.mock("@/components/base/pageSection", () => ({ PageAction: "PageAction" }));
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/listEmpty", () => "ListEmpty");
jest.mock("@/components/base/listFooter", () => "ListFooter");
jest.mock("@/components/mediaItem/musicItem", () => "MusicItem");
jest.mock("@shopify/flash-list", () => ({ FlashList: (props: any) => {
    const R = require("react");
    return R.createElement("FlashList", props, props.ListHeaderComponent,
        props.data.map((item: any, index: number) => R.createElement(R.Fragment, { key: item.id }, props.renderItem({ item, index }))), props.ListFooterComponent);
} }));

const first = { id: "first", platform: "A", title: "First", artist: "Artist" } as IMusic.IMusicItem;
const second = { ...first, id: "second", title: "Second" };
const sheet = { id: "remote", platform: "A", title: "Album" };

describe("inline selection on a remote music sheet", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    let back: () => boolean;
    const loadMore = jest.fn();
    const renderPage = (tracks = [first], state = RequestStateCode.PARTLY_DONE) => <MusicSheetPage navTitle="Album" sheetInfo={sheet} musicList={tracks} state={state} onLoadMore={loadMore} />;
    beforeEach(() => {
        jest.clearAllMocks(); mockPlayerOpen = false;
        jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
            back = handler as () => boolean;
            return { remove: jest.fn() };
        });
        act(() => {
            renderer = TestRenderer.create(renderPage());
        });
    });
    afterEach(() => {
        act(() => renderer.unmount());
        jest.restoreAllMocks();
    });

    it("keeps the original list mounted through selection, pagination and Done without navigating", () => {
        const originalList = renderer.root.findByType("FlashList" as any);
        act(() => renderer.root.findByType("Edit" as any).props.onPress());
        expect(renderer.root.findByType("FlashList" as any)).toBe(originalList);
        act(() => renderer.root.findByType(MusicItem).props.onItemPress());
        expect(renderer.root.findByType(MusicItem).props.checked).toBe(true);
        expect(TrackPlayer.play).not.toHaveBeenCalled();
        act(() => originalList.props.onEndReached());
        expect(loadMore).toHaveBeenCalledTimes(1);
        act(() => renderer.update(renderPage([first, second], RequestStateCode.FINISHED)));
        expect(renderer.root.findByType("FlashList" as any)).toBe(originalList);
        expect(renderer.root.findAllByType(MusicItem).map(row => row.props.checked)).toEqual([true, false]);
        expect(renderer.root.findAllByProps({ accessibilityLabel: "sheetDetail.removeFromSheet" })).toHaveLength(0);
        act(() => renderer.root.findAllByType(PageAction).find(button => button.props.title === "common.done")!.props.onPress());
        expect(renderer.root.findByType("FlashList" as any)).toBe(originalList);
        expect(renderer.root.findAllByType(MusicItem).every(row => row.props.checked === undefined)).toBe(true);
        expect(mockNavigate).not.toHaveBeenCalled();
        act(() => renderer.root.findAllByType(MusicItem)[1].props.onItemPress());
        expect(TrackPlayer.play).toHaveBeenCalledWith(second, undefined, expect.anything());
    });

    it("exits selection on header or hardware Back and gives an open player priority", () => {
        act(() => renderer.root.findByType("AppBar" as any).props.menu[0].onPress());
        mockPlayerOpen = true;
        expect(back()).toBe(false);
        expect(renderer.root.findByType(MusicItem).props.checked).toBe(false);
        mockPlayerOpen = false;
        act(() => expect(back()).toBe(true));
        expect(renderer.root.findByType(MusicItem).props.checked).toBeUndefined();
        act(() => renderer.root.findByType("Edit" as any).props.onPress());
        act(() => renderer.root.findByType("AppBar" as any).props.onBackPress());
        expect(renderer.root.findByType(MusicItem).props.checked).toBeUndefined();
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
