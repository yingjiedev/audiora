import React, { memo, useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import MusicItem, { MUSIC_ITEM_HEIGHT } from "@/components/mediaItem/musicItem";
import { produce } from "immer";
import { useAtom, useSetAtom } from "jotai";
import { IEditorMusicItem, editingMusicListAtom, musicListChangedAtom } from "../store/atom";
import SortableFlatList from "@/components/base/SortableFlatList";

import SelectionCheckbox from "@/components/musicList/selectionCheckbox";
import SharedMusicList from "@/components/musicList";
import useColors from "@/hooks/useColors";
import Empty from "@/components/base/empty";
import ListFooter from "@/components/base/listFooter";
import { PageAction } from "@/components/base/pageSection";
import { spacing } from "@/constants/designSystem";
import { MusicListSource } from "@/core/musicListSource";
import { RequestStateCode } from "@/constants/commonConst";
import { getMediaUniqueKey } from "@/utils/mediaUtils";
import { useI18N } from "@/core/i18n";
import timeformat from "@/utils/timeformat";

interface IMusicEditorItemProps {
    index: number;
    editorMusicItem: IEditorMusicItem;
    canEdit?: boolean;
}
function MusicEditorItemView(props: IMusicEditorItemProps) {
    const { editorMusicItem, canEdit, index } = props;
    const setEditingMusicList = useSetAtom(editingMusicListAtom);

    const onPress = useCallback(() => {
        setEditingMusicList(
            produce(draft => {
                const item = draft.find(entry => getMediaUniqueKey(entry.musicItem) === getMediaUniqueKey(editorMusicItem.musicItem));
                if (item) item.checked = !item.checked;
            }),
        );
    }, [editorMusicItem.musicItem, setEditingMusicList]);

    return (
        <MusicItem
            musicItem={editorMusicItem.musicItem}
            index={index + 1}
            checked={!!editorMusicItem.checked}
            titleTagSubText={typeof editorMusicItem.musicItem.duration === "number" ? timeformat(editorMusicItem.musicItem.duration) : undefined}
            left={<SelectionCheckbox checked={!!editorMusicItem.checked} />}
            actions={[]}
            containerStyle={style.musicItem}
            itemPaddingLeft={spacing.xxxl}
            itemPaddingRight={canEdit ? rpx(100) : undefined}
            onItemPress={onPress}
        />
    );
}

const MusicEditorItem = memo(
    MusicEditorItemView,
    (prev, curr) =>
        prev.editorMusicItem === curr.editorMusicItem &&
        prev.index === curr.index && prev.canEdit === curr.canEdit,
);

/** 音乐列表 */
export default function MusicList(props: { source?: MusicListSource; state: RequestStateCode; canEdit: boolean }) {
    const { source, state, canEdit } = props;
    const { t } = useI18N();
    const [editingMusicList, setEditingMusicList] =
        useAtom(editingMusicListAtom);
    const setMusicListChanged = useSetAtom(musicListChangedAtom);

    const renderItem = useCallback(
        ({ index, item }: any) => {
            return <MusicEditorItem editorMusicItem={item} index={index!} canEdit={canEdit} />;
        },
        [canEdit],
    );
    const colors = useColors();
    const musicList = useMemo(() => editingMusicList.map(item => item.musicItem), [editingMusicList]);
    const selectedKeys = useMemo(() => new Set(editingMusicList.filter(item => item.checked).map(item => getMediaUniqueKey(item.musicItem))), [editingMusicList]);
    const onToggle = useCallback((musicItem: IMusic.IMusicItem) => {
        const key = getMediaUniqueKey(musicItem);
        setEditingMusicList(previous => previous.map(item => getMediaUniqueKey(item.musicItem) === key ? { ...item, checked: !item.checked } : item));
    }, [setEditingMusicList]);
    const selection = useMemo(() => ({ selectedKeys, onToggle }), [selectedKeys, onToggle]);

    if (!canEdit) {
        const listState = source ? state : RequestStateCode.FINISHED;
        return <SharedMusicList
            musicList={musicList}
            showIndex
            selection={selection}
            state={listState}
            onLoadMore={() => source?.loadMore()}
            onRetry={() => source?.loadMore(true)}
            Footer={source && editingMusicList.length ? <View style={style.footer}>
                {listState === RequestStateCode.PARTLY_DONE ? <PageAction title={t("musicListEditor.loadMore")} variant="text" onPress={() => source.loadMore()} />
                    : <ListFooter state={listState} onRetry={() => source.loadMore(true)} />}
            </View> : null}
        />;
    }

    return editingMusicList?.length ? (
        <SortableFlatList
            activeBackgroundColor={colors.placeholder}
            data={editingMusicList}
            renderItem={renderItem}
            itemHeight={MUSIC_ITEM_HEIGHT}
            onSortEnd={newData => {
                setEditingMusicList(newData);
                setMusicListChanged(true);
            }}
        />
    ) : (
        <Empty />
    );
}

const style = StyleSheet.create({
    footer: { padding: spacing.md, alignItems: "center" },
    // The sortable wrapper lays out children horizontally, including the drag preview.
    musicItem: {
        flex: 1,
        minWidth: 0,
    },
});
