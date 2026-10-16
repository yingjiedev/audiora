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

export default function LocalMusicList() {
    const musicList = LocalMusicSheet.useMusicList();
    const { t } = useI18N();
    const navigate = useNavigate();

    React.useEffect(() => {
        void LocalMusicSheet.hydrateArtwork(musicList);
    }, [musicList.length]);

    return (
        <HorizontalSafeAreaView style={globalStyle.flex1}>
            <MusicList
                Header={<PageSummary title={t("home.songCount", { count: musicList.length })} description={t("subpage.manageLocal")} action={<PageAction title={t("localMusic.scanLocalMusic")} icon="magnifying-glass" onPress={() => openLocalMusicScanner(navigate)} />} />}
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
