import React, { useCallback, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import Header, { PlaybackTab } from "./header";
import Body, { SheetBody } from "./body";
import PanelBase from "../../base/panelBase";
import { radius } from "@/constants/designSystem";
import TrackPlayer, { usePlayList } from "@/core/trackPlayer";
import musicHistory, { useMusicHistory } from "@/core/musicHistory";
import { clearSheetPlaybackHistory, ISheetPlaybackEntry, removeSheetPlayback, useSheetPlaybackHistory } from "@/core/sheetPlaybackHistory";
import { moveQueueItem } from "@/core/trackPlayer/reorderQueue";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { closePlayer } from "@/core/playerOverlay";
import downloader from "@/core/downloader";
import { showDialog } from "@/components/dialogs/useDialog";
import { hidePanel, showPanel } from "../../usePanel";

export default function PlayList(props: { initialTab?: PlaybackTab } = {}) {
    const [tab, setTab] = useState<PlaybackTab>(props.initialTab ?? "queue");
    const queue = usePlayList();
    const history = useMusicHistory();
    const sheets = useSheetPlaybackHistory();
    const { height } = useWindowDimensions();
    const { t } = useI18N();
    const navigate = useNavigate();
    const musics = tab === "queue" ? queue : history;
    const move = useCallback((item: IMusic.IMusicItem, offset: number) => {
        const items = tab === "queue" ? TrackPlayer.playList : musicHistory.history;
        const order = moveQueueItem(items, item, offset);
        if (order === items) {
            return;
        }
        if (tab === "queue") {
            TrackPlayer.reorderPlayList(order);
        } else {
            musicHistory.setHistory(order);
        }
    }, [tab]);
    const clear = () => showDialog("SimpleDialog", {
        title: t("common.clear"),
        content: t(`panel.playList.clear.${tab}`),
        onOk: () => {
            if (tab === "queue") {
                return TrackPlayer.clearPlayList();
            } else if (tab === "history") {
                return musicHistory.clearMusic();
            }
            clearSheetPlaybackHistory();
        },
    });
    const openSheet = (entry: ISheetPlaybackEntry) => {
        hidePanel();
        closePlayer();
        const { sheet, routeName } = entry;
        if (routeName === "local-sheet-detail") {
            navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, { id: sheet.id });
        } else if (routeName === "album-detail") {
            navigate(ROUTE_PATH.ALBUM_DETAIL, { albumItem: sheet as IAlbum.IAlbumItem });
        } else if (routeName === "top-list-detail") {
            navigate(ROUTE_PATH.TOP_LIST_DETAIL, { topList: sheet, pluginHash: sheet.platform });
        } else {
            navigate(ROUTE_PATH.PLUGIN_SHEET_DETAIL, { sheetInfo: sheet });
        }
    };

    return (
        <PanelBase
            height={height * 0.62}
            borderTopRadius={radius.xl}
            keyboardAvoidBehavior="none"
            renderBody={loading => (
                <View style={styles.bodyRoot}>
                    <Header
                        tab={tab}
                        counts={{ queue: queue.length, history: history.length, sheets: sheets.length }}
                        onSelectTab={setTab}
                        onDownload={() => downloader.download(musics)}
                        onAdd={() => showPanel("AddToMusicSheet", { musicItem: musics })}
                        onClear={clear}
                    />
                    <View style={styles.list}>
                        {tab === "sheets" ? (
                            <SheetBody entries={sheets} onOpen={openSheet} onRemove={removeSheetPlayback} />
                        ) : (
                            <Body
                                key={tab}
                                loading={loading}
                                queue={tab === "queue"}
                                musics={musics}
                                onPlay={item => TrackPlayer.play(item)}
                                onRemove={item => tab === "queue" ? TrackPlayer.remove(item) : musicHistory.removeMusic(item)}
                                onMove={move}
                            />
                        )}
                    </View>
                </View>
            )}
        />
    );
}

const styles = StyleSheet.create({
    bodyRoot: {
        flex: 1,
        width: "100%",
        minHeight: 0,
    },
    list: { flex: 1, minHeight: 0 },
});
