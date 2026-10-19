import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useRoute } from "@react-navigation/native";
import PillTabBar from "@/components/base/pillTabBar";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import GroupedMusicList from "@/components/musicList/groupedMusicList";
import MusicList from "@/components/musicList";
import type { MusicListSelection } from "@/components/musicList/useMusicSelection";
import globalStyle from "@/constants/globalStyle";
import { RequestStateCode } from "@/constants/commonConst";
import { useI18N } from "@/core/i18n";
import { useSheetItem } from "@/core/musicSheet";
import TrackPlayer, { useCurrentMusic } from "@/core/trackPlayer";
import { useParams } from "@/core/router";
import { favoriteDisplayGroups } from "@/core/favoriteGroupsModel";
import useFavoriteGroupActions from "@/components/musicList/useFavoriteGroupActions";
import Header from "./header";

interface Props {
    onEdit?: () => void;
    selection?: MusicListSelection;
    editingControls?: React.ReactNode;
}

export default function SheetMusicList({ onEdit, selection, editingControls }: Props) {
    const { id = "favorite" } = useParams<"local-sheet-detail">();
    const musicSheet = useSheetItem(id);
    const currentMusic = useCurrentMusic();
    const route = useRoute();
    const { t } = useI18N();
    const [view, setView] = useState(0);
    const { state, actions } = useFavoriteGroupActions();
    const groups = useMemo(
        () => favoriteDisplayGroups(musicSheet?.musicList ?? [], state),
        [musicSheet?.musicList, state],
    );
    const tabs = id === "favorite" && !selection ? (
        <PillTabBar
            routes={[
                { key: "grouped", title: t("aggregate.bySong") },
                { key: "sources", title: t("aggregate.bySource") },
            ]}
            index={view}
            onIndexChange={setView}
        />
    ) : null;
    const showGroupedFavorites = id === "favorite" && view === 0 && !selection;

    return (
        <HorizontalSafeAreaView style={globalStyle.flex1}>
            {showGroupedFavorites ? (
                <GroupedMusicList
                    groups={groups}
                    musicSheet={musicSheet}
                    state={RequestStateCode.FINISHED}
                    favoriteActions={actions}
                    renderHeader={selected => (
                        <View>
                            <Header musicList={selected} groupCount={groups.length} onEdit={onEdit} />
                            {tabs}
                        </View>
                    )}
                    onPlay={(item, list) => {
                        TrackPlayer.playWithReplacePlayList(item, list, {
                            sheet: musicSheet,
                            routeName: route.name,
                        });
                    }}
                />
            ) : (
                <MusicList
                    Header={(
                        <View>
                            <Header onEdit={onEdit} editingControls={editingControls} />
                            {tabs}
                        </View>
                    )}
                    musicList={musicSheet?.musicList}
                    musicSheet={musicSheet}
                    showIndex
                    state={RequestStateCode.IDLE}
                    highlightMusicItem={currentMusic}
                    selection={selection}
                />
            )}
        </HorizontalSafeAreaView>
    );
}
