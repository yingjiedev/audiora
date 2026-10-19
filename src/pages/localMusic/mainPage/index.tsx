import React, { useMemo } from "react";
import { View } from "react-native";
import LocalMusicSheet from "@/core/localMusicSheet";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import LocalMusicList from "./localMusicList";
import { localMusicSheetId } from "@/constants/commonConst";
import AppBar from "@/components/base/appBar";
import { useI18N } from "@/core/i18n";
import globalStyle from "@/constants/globalStyle";
import useEnterTransitionEnd from "@/hooks/useEnterTransitionEnd";
import { openLocalMusicScanner } from "../scanMusic";
import useOpenMusicListEditor from "@/components/musicList/useOpenMusicListEditor";
import MusicSelectionProvider from "@/components/musicList/musicSelectionProvider";
import useInlineMusicSelection from "@/components/musicList/useInlineMusicSelection";
import { SelectionDoneAction } from "@/components/musicList/selectionHeader";
import { getMediaUniqueKey } from "@/utils/mediaUtils";

export default function MainPage() {
    return <MusicSelectionProvider><LocalMusicContent /></MusicSelectionProvider>;
}

function LocalMusicContent() {
    const navigate = useNavigate();
    const openEditor = useOpenMusicListEditor();
    const { t } = useI18N();
    const listReady = useEnterTransitionEnd();
    const musicList = LocalMusicSheet.useMusicList();
    const removal = useMemo(() => ({ onRemove: (items: IMusic.IMusicItem[]) => {
        const removed = new Set(items.map(getMediaUniqueKey));
        return LocalMusicSheet.updateMusicList(LocalMusicSheet.getMusicList().filter(item => !removed.has(getMediaUniqueKey(item))));
    } }), []);
    const editor = useInlineMusicSelection("local-music", musicList, { removal });

    return (
        <>
            <AppBar
                withStatusBar
                onBackPress={editor.editing ? editor.finish : undefined}
                actionComponent={editor.editing ? <SelectionDoneAction onPress={editor.finish} /> : undefined}
                actions={editor.editing ? [] : [
                    {
                        icon: "magnifying-glass",
                        onPress() {
                            navigate(ROUTE_PATH.SEARCH_MUSIC_LIST, {
                                musicList: LocalMusicSheet.getMusicList(),
                            });
                        },
                    },
                ]}
                menu={editor.editing ? [] : [
                    {
                        icon: "magnifying-glass",
                        title: t("localMusic.scanLocalMusic"),
                        onPress() {
                            openLocalMusicScanner(navigate);
                        },
                    },
                    {
                        icon: "pencil-square",
                        title: t("common.batchEdit"),
                        onPress: editor.start,
                    },
                    {
                        icon: "bars-3",
                        title: t("sheetDetail.manualSortMusic"),
                        async onPress() {
                            openEditor({
                                musicList: LocalMusicSheet.getMusicList(),
                                musicSheet: {
                                    id: localMusicSheetId,
                                },
                            });
                        },
                    },
                    // 隐藏“下载列表”入口
                ]}>
                {t("home.localMusic")}
            </AppBar>
            {listReady ? (
                <LocalMusicList musicList={musicList} editor={editor} />
            ) : (
                <View style={globalStyle.flex1} />
            )}
        </>
    );
}
