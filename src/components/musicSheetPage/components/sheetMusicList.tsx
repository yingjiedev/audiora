import React from "react";
import { View } from "react-native";

import Loading from "@/components/base/loading";
import Header from "./header";
import MusicList from "@/components/musicList";
import Config from "@/core/appConfig";
import globalStyle from "@/constants/globalStyle";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import TrackPlayer, { useCurrentMusic } from "@/core/trackPlayer";
import { RequestStateCode } from "@/constants/commonConst";
import { useRoute } from "@react-navigation/native";

interface IMusicListProps {
    sheetInfo: IMusic.IMusicSheetItem | null;
    musicList?: IMusic.IMusicItem[] | null;
    // 是否可收藏
    canStar?: boolean;
    // 状态
    state: RequestStateCode;
    onRetry?: () => void;
    onLoadMore?: () => void;
}
export default function SheetMusicList(props: IMusicListProps) {
    const route = useRoute();
    const { sheetInfo, musicList, canStar, state, onRetry, onLoadMore } = props;
    // 高亮正在播放的歌（与本地歌单页行为一致）
    const currentMusic = useCurrentMusic();

    return (
        <View style={globalStyle.fwflex1}>
            {!musicList ? (
                <Loading />
            ) : (
                <HorizontalSafeAreaView style={globalStyle.fwflex1}>
                    <MusicList
                        showIndex
                        Header={
                            <Header
                                canStar={canStar}
                                musicSheet={sheetInfo}
                                musicList={musicList}
                            />
                        }
                        onLoadMore={onLoadMore}
                        onRetry={onRetry}
                        state={state}
                        musicList={musicList}
                        highlightMusicItem={currentMusic}
                        onItemPress={(musicItem, currentMusicList) => {
                            if (
                                Config.getConfig(
                                    "basic.clickMusicInAlbum",
                                ) === "playMusic"
                            ) {
                                TrackPlayer.play(musicItem, undefined, sheetInfo ? { sheet: sheetInfo, routeName: route.name } : undefined);
                            } else {
                                TrackPlayer.playWithReplacePlayList(
                                    musicItem,
                                    currentMusicList ?? [musicItem],
                                    sheetInfo ? { sheet: sheetInfo, routeName: route.name } : undefined,
                                );
                            }
                        }}
                    />
                </HorizontalSafeAreaView>
            )}
        </View>
    );
}
