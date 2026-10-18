import React from "react";
import { PageAction, PageSummary } from "@/components/base/pageSection";
import MusicList from "@/components/musicList";
import LocalMusicSheet from "@/core/localMusicSheet";
import { localMusicSheetId, localPluginPlatform, RequestStateCode } from "@/constants/commonConst";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import globalStyle from "@/constants/globalStyle";
import { useI18N } from "@/core/i18n";
import { openLocalMusicScanner } from "../scanMusic";
import { useNavigate } from "@/core/router";
import type { MusicSelectionController } from "@/components/musicList/useMusicSelection";
import InlineSelectionBar from "@/components/musicList/inlineSelectionBar";
import { View } from "react-native";

export default function LocalMusicList({ musicList, editor }: { musicList: IMusic.IMusicItem[]; editor: MusicSelectionController }) {
    const { t } = useI18N();
    const navigate = useNavigate();

    React.useEffect(() => {
        void LocalMusicSheet.hydrateArtwork(musicList);
    }, [musicList.length]);

    return (
        <HorizontalSafeAreaView style={globalStyle.flex1}>
            <MusicList
                Header={<View><PageSummary title={t("home.songCount", { count: musicList.length })} description={t("subpage.manageLocal")} action={!editor.editing ? <PageAction title={t("localMusic.scanLocalMusic")} icon="magnifying-glass" onPress={() => openLocalMusicScanner(navigate)} /> : undefined} />
                    <InlineSelectionBar editor={editor} count={musicList.length} /></View>}
                selection={editor.selection}
                musicList={musicList}
                showIndex
                state={RequestStateCode.IDLE}
                musicSheet={{
                    id: localMusicSheetId,
                    title: t("common.local"),
                    platform: localPluginPlatform,
                    musicList: musicList,
                }}
            />
        </HorizontalSafeAreaView>
    );
}
