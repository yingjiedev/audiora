import React from "react";
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

export default function MainPage() {
    const navigate = useNavigate();
    const { t } = useI18N();
    const listReady = useEnterTransitionEnd();

    return (
        <>
            <AppBar
                withStatusBar
                actions={[
                    {
                        icon: "magnifying-glass",
                        onPress() {
                            navigate(ROUTE_PATH.SEARCH_MUSIC_LIST, {
                                musicList: LocalMusicSheet.getMusicList(),
                            });
                        },
                    },
                ]}
                menu={[
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
                        async onPress() {
                            navigate(ROUTE_PATH.MUSIC_LIST_EDITOR, {
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
                <LocalMusicList />
            ) : (
                <View style={globalStyle.flex1} />
            )}
        </>
    );
}
