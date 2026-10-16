import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { FlatList } from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";
import MusicItemOptions from "./musicItemOptions";
import TrackPlayer from "@/core/trackPlayer";
import { hidePanel, showPanel } from "../usePanel";

jest.mock("../base/panelBase", () => ({ renderBody }: { renderBody: () => React.ReactNode }) => renderBody());
jest.mock("@/components/base/fastImage", () => "MockImage");
jest.mock("@/components/base/icon", () => "MockIcon");
jest.mock("@/components/base/themeText", () => "MockText");
jest.mock("@/components/base/divider", () => "MockDivider");
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: 1 } }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 12 }) }));
jest.mock("@/hooks/useColors", () => () => ({ text: "black", listActive: "white" }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/core/localMusicSheet", () => ({ __esModule: true, default: { isLocalMusic: () => false } }));
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: { addNext: jest.fn() }, useCurrentMusic: () => null }));
jest.mock("@/core/pluginManager", () => ({ __esModule: true, default: { getByMedia: () => undefined } }));
jest.mock("@/core/appConfig", () => ({ __esModule: true, default: {}, useAppConfig: () => undefined }));
jest.mock("@/core/mediaCache", () => ({ __esModule: true, default: { setMediaCache: jest.fn() } }));
jest.mock("@/core/musicHistory", () => ({}));
jest.mock("@/core/musicSheet", () => ({}));
jest.mock("@/core/downloader", () => ({}));
jest.mock("@/core/lyricManager", () => ({}));
jest.mock("@/core/router", () => ({ ROUTE_PATH: { MUSIC_DETAIL: "detail" } }));
jest.mock("@/utils/mediaUtils", () => ({ getPlatformMediaId: (item: IMusic.IMusicItem) => item.id }));
jest.mock("@/utils/mediaExtra", () => ({ getMediaExtraProperty: () => undefined }));
jest.mock("@/utils/artwork", () => ({ hasAssociatedArtwork: () => false, resolveArtwork: () => "" }));
jest.mock("@/utils/musicVideo", () => ({ canPlayMusicVideo: () => false }));
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { success: jest.fn() } }));
jest.mock("@/utils/log", () => ({ devLog: jest.fn() }));
jest.mock("@/utils/motion", () => ({ motionDuration: () => 0, motionEasing: () => undefined }));
jest.mock("@/components/dialogs/useDialog", () => ({}));
jest.mock("@/components/mvPlayer/useMvPlayer", () => ({}));
jest.mock("expo-screen-orientation", () => ({}));
jest.mock("../usePanel", () => ({ hidePanel: jest.fn(), showPanel: jest.fn() }));

const music: IMusic.IMusicItem = { id: "song-id", mid: "song-mid", platform: "source", title: "Song", artist: "Artist", album: "Album", duration: 180, artwork: "" };

describe("MusicItemOptions menu", () => {
    it("excludes hidden rows from list geometry and keeps visible actions working", () => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<MusicItemOptions musicItem={music} />);
        });
        const list = renderer!.root.findByType(FlatList);
        expect(list.props.getItemLayout).toBeUndefined();
        expect(list.props.data.every((option: { show?: boolean }) => option.show !== false)).toBe(true);
        expect(list.props.data.some((option: { icon: string }) => option.icon === "play-circle-outline")).toBe(false);
        expect(list.props.data.some((option: { icon: string }) => option.icon === "share")).toBe(true);
        const info = list.props.data.find((option: { icon: string }) => option.icon === "identification");
        act(() => info.onPress());
        expect(JSON.parse((Clipboard.setString as jest.Mock).mock.calls.at(-1)[0])).toEqual({ platform: "source", id: "song-id", songmid: "song-mid" });
        act(() => list.props.data.find((option: { icon: string }) => option.icon === "motion-play").onPress());
        expect(TrackPlayer.addNext).toHaveBeenCalledWith(music);
        expect(hidePanel).toHaveBeenCalled();
        act(() => list.props.data.find((option: { icon: string }) => option.icon === "folder-plus").onPress());
        expect(showPanel).toHaveBeenCalledWith("AddToMusicSheet", { musicItem: music });
        act(() => renderer!.unmount());
    });
});
