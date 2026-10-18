import React from "react";

import { ROUTE_PATH, useNavigate } from "@/core/router";
import AppBar from "@/components/base/appBar";
import { useI18N } from "@/core/i18n";
import useOpenMusicListEditor from "@/components/musicList/useOpenMusicListEditor";

interface INavBarProps {
    sourceId: string;
    navTitle: string;
    musicList: IMusic.IMusicItem[] | null;
}

export default function (props: INavBarProps) {
    const navigate = useNavigate();
    const openEditor = useOpenMusicListEditor();
    const { t } = useI18N();
    const { navTitle, musicList = [], sourceId } = props;

    return (
        <AppBar
            actions={[
                {
                    icon: "magnifying-glass",
                    onPress() {
                        navigate(ROUTE_PATH.SEARCH_MUSIC_LIST, {
                            musicList: musicList,
                        });
                    },
                },
            ]}
            menu={[
                {
                    icon: "pencil-square",
                    title: t("common.batchEdit"),
                    onPress() {
                        openEditor({
                            sourceId,
                            musicList: musicList,
                            musicSheet: {
                                title: navTitle,
                            },
                        });
                    },
                },
            ]}>
            {navTitle}
        </AppBar>
    );
}
