import React, { useMemo } from "react";
import { PageSummary } from "@/components/base/pageSection";
import { View } from "react-native";
import useEnterTransitionEnd from "@/hooks/useEnterTransitionEnd";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import StatusBar from "@/components/base/statusBar";
import musicHistory, { useMusicHistory } from "@/core/musicHistory";
import MusicList from "@/components/musicList";
import { musicHistorySheetId, RequestStateCode } from "@/constants/commonConst";
import AppBar from "@/components/base/appBar";
import useOpenMusicListEditor from "@/components/musicList/useOpenMusicListEditor";
import { useI18N } from "@/core/i18n";
import MusicSelectionProvider from "@/components/musicList/musicSelectionProvider";
import useInlineMusicSelection from "@/components/musicList/useInlineMusicSelection";
import InlineSelectionBar from "@/components/musicList/inlineSelectionBar";
import { SelectionDoneAction } from "@/components/musicList/selectionHeader";
import { getMediaUniqueKey } from "@/utils/mediaUtils";
import { spacing } from "@/constants/designSystem";

export default function History() {
    return <VerticalSafeAreaView style={globalStyle.fwflex1}>
        <MusicSelectionProvider><HistoryContent /></MusicSelectionProvider>
    </VerticalSafeAreaView>;
}

function HistoryContent() {
    const musicHistoryList = useMusicHistory();

    const openEditor = useOpenMusicListEditor();
    const { t } = useI18N();
    const removal = useMemo(() => ({ onRemove: (items: IMusic.IMusicItem[]) => {
        const removed = new Set(items.map(getMediaUniqueKey));
        return musicHistory.setHistory(musicHistory.history.filter(item => !removed.has(getMediaUniqueKey(item))));
    } }), []);
    const editor = useInlineMusicSelection("history", musicHistoryList, { removal });

    // 历史列表可能很长，首帧全量渲染会卡掉进入动画，等转场结束再挂
    const listReady = useEnterTransitionEnd();

    return (
        <>
            <StatusBar />
            <AppBar
                onBackPress={editor.editing ? editor.finish : undefined}
                actionComponent={editor.editing ? <SelectionDoneAction onPress={editor.finish} /> : undefined}
                menu={editor.editing ? [] : [
                    {
                        icon: "trash-outline",
                        title: t("history.clearHistory"),
                        onPress() {
                            if (musicHistoryList.length) {
                                musicHistory.clearMusic();
                            }
                        },
                    },
                    {
                        icon: "pencil-square",
                        title: t("common.edit"),
                        onPress: editor.start,
                    },
                    {
                        icon: "bars-3",
                        title: t("sheetDetail.manualSortMusic"),
                        onPress() {
                            openEditor({
                                musicList: musicHistoryList,
                                musicSheet: {
                                    id: musicHistorySheetId,
                                    title: t("history.title"),
                                },
                            });
                        },
                    },
                ]}>
                {t("history.title")}
            </AppBar>
            {listReady ? (
                <MusicList
                    Header={<View><PageSummary title={t("home.songCount", { count: musicHistoryList.length })} description={t("myMusic.historyHint")} />
                        <InlineSelectionBar style={{ paddingHorizontal: spacing.xxxl }} editor={editor} count={musicHistoryList.length} /></View>}
                    selection={editor.selection}
                    musicList={musicHistoryList}
                    showIndex
                    state={RequestStateCode.IDLE}
                    musicSheet={{
                        id: musicHistorySheetId,
                        title: t("history.title"),
                        musicList: musicHistoryList,
                    } as IMusic.IMusicSheetItem}
                />
            ) : (
                <View style={globalStyle.flex1} />
            )}
        </>
    );
}
