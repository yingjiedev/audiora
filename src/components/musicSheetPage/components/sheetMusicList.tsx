import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import Loading from "@/components/base/loading";
import ListEmpty from "@/components/base/listEmpty";
import Header from "./header";
import MusicList from "@/components/musicList";
import Config from "@/core/appConfig";
import globalStyle from "@/constants/globalStyle";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import TrackPlayer, { useCurrentMusic } from "@/core/trackPlayer";
import { RequestStateCode } from "@/constants/commonConst";
import { useRoute } from "@react-navigation/native";
import type { MusicListSelection } from "@/components/musicList/useMusicSelection";
import useContentDimensions, { ContentDimensionsContext } from "@/hooks/useContentDimensions";

interface IMusicListProps {
    onEdit?: () => void;
    editingControls?: React.ReactNode;
    selection?: MusicListSelection;
    sheetInfo: IMusic.IMusicSheetItem | null;
    typeLabel?: string;
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
    const { sheetInfo, typeLabel, musicList, canStar, state, onRetry, onLoadMore, onEdit, editingControls, selection } = props;
    // 高亮正在播放的歌（与本地歌单页行为一致）
    const currentMusic = useCurrentMusic();
    const dimensions = useContentDimensions();
    const split = dimensions.width >= 900;

    return (
        <View style={globalStyle.fwflex1}>
            {!musicList ? (
                state === RequestStateCode.ERROR || state === RequestStateCode.FINISHED ? <ListEmpty state={state} onRetry={onRetry} /> : <Loading />
            ) : (
                <HorizontalSafeAreaView style={[globalStyle.fwflex1, styles.row]}>
                    {split ? <ScrollView testID="sheet-details-pane" style={styles.details}>
                        <ContentDimensionsContext.Provider value={{ width: 280, height: dimensions.height }}>
                            <Header variant="details" typeLabel={typeLabel} canStar={canStar} musicSheet={sheetInfo} musicList={musicList} />
                        </ContentDimensionsContext.Provider>
                    </ScrollView> : null}
                    <View style={globalStyle.flex1}>
                        <ContentDimensionsContext.Provider value={{ width: dimensions.width - (split ? 280 : 0), height: dimensions.height }}>
                            <MusicList
                                showIndex
                                Header={
                                    <Header
                                        variant={split ? "actions" : "all"}
                                        onEdit={onEdit}
                                        editingControls={editingControls}
                                        typeLabel={typeLabel}
                                        canStar={canStar}
                                        musicSheet={sheetInfo}
                                        musicList={musicList}
                                    />
                                }
                                onLoadMore={onLoadMore}
                                onRetry={onRetry}
                                state={state}
                                musicList={musicList}
                                selection={selection}
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
                        </ContentDimensionsContext.Provider>
                    </View>
                </HorizontalSafeAreaView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({ row: { flexDirection: "row" }, details: { width: 280, flexGrow: 0, flexShrink: 0 } });
