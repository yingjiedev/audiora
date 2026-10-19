import React from "react";

import { ROUTE_PATH, useNavigate } from "@/core/router";
import AppBar from "@/components/base/appBar";
import { useI18N } from "@/core/i18n";
import { useActiveMusicSelection } from "@/components/musicList/selectionContext";
import { SelectionDoneAction } from "@/components/musicList/selectionHeader";

interface INavBarProps {
    onEdit: () => void;
    navTitle: string;
    musicList: IMusic.IMusicItem[] | null;
}

export default function (props: INavBarProps) {
    const navigate = useNavigate();
    const editor = useActiveMusicSelection();
    const { t } = useI18N();
    const { navTitle, musicList = [], onEdit } = props;

    return (
        <AppBar
            onBackPress={editor?.finish}
            actionComponent={editor ? <SelectionDoneAction onPress={editor.finish} /> : undefined}
            actions={editor ? [] : [
                {
                    icon: "magnifying-glass",
                    onPress() {
                        navigate(ROUTE_PATH.SEARCH_MUSIC_LIST, {
                            musicList: musicList,
                        });
                    },
                },
            ]}
            menu={editor ? [] : [
                {
                    icon: "pencil-square",
                    title: t("common.batchEdit"),
                    onPress: onEdit,
                },
            ]}>
            {navTitle}
        </AppBar>
    );
}
