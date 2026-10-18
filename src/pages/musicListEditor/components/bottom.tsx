import React, { useCallback, useMemo } from "react";
import { useAtom, useSetAtom } from "jotai";
import { SelectionActions } from "@/components/musicList/selectionControls";
import { canEditMusicList } from "@/core/musicListEditor";
import { useI18N } from "@/core/i18n";
import { useParams } from "@/core/router";
import { getMediaUniqueKey } from "@/utils/mediaUtils";
import { editingMusicListAtom, musicListChangedAtom } from "../store/atom";

export default function Bottom() {
    const params = useParams<"music-list-editor">();
    const [editingMusicList, setEditingMusicList] = useAtom(editingMusicListAtom);
    const setMusicListChanged = useSetAtom(musicListChangedAtom);
    const { t } = useI18N();
    const selectedItems = useMemo(() => editingMusicList.filter(item => item.checked).map(item => item.musicItem), [editingMusicList]);
    const clear = useCallback((items: IMusic.IMusicItem[]) => {
        const completed = new Set(items.map(getMediaUniqueKey));
        setEditingMusicList(previous => previous.map(item => completed.has(getMediaUniqueKey(item.musicItem)) ? { ...item, checked: false } : item));
    }, [setEditingMusicList]);

    return <SelectionActions actions={params.actions} selectedItems={selectedItems} onClear={clear}
        removal={canEditMusicList(params) ? {
            onRemove: items => {
                const removed = new Set(items.map(getMediaUniqueKey));
                setEditingMusicList(previous => previous.filter(item => !removed.has(getMediaUniqueKey(item.musicItem))));
                setMusicListChanged(true);
            },
            successMessage: t("toast.rememberToSave"),
        } : undefined} />;
}
