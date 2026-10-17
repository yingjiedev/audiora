import React, { memo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import MusicItem, { MUSIC_ITEM_HEIGHT } from "@/components/mediaItem/musicItem";
import { produce } from "immer";
import { useAtom, useSetAtom } from "jotai";
import { IEditorMusicItem, editingMusicListAtom, musicListChangedAtom } from "../store/atom";
import SortableFlatList from "@/components/base/SortableFlatList";

import CheckBox from "@/components/base/checkbox";
import useColors from "@/hooks/useColors";
import Empty from "@/components/base/empty";
import { FlashList } from "@shopify/flash-list";
import ListEmpty from "@/components/base/listEmpty";
import ListFooter from "@/components/base/listFooter";
import { PageAction } from "@/components/base/pageSection";
import { spacing } from "@/constants/designSystem";
import { MusicListSource } from "@/core/musicListSource";
import { RequestStateCode } from "@/constants/commonConst";
import { getMediaUniqueKey } from "@/utils/mediaUtils";
import { useI18N } from "@/core/i18n";

interface IMusicEditorItemProps {
    index: number;
    editorMusicItem: IEditorMusicItem;
    canEdit?: boolean;
}
function MusicEditorItemView(props: IMusicEditorItemProps) {
    const { editorMusicItem, canEdit } = props;
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
            left={
                <View style={style.checkBox} accessibilityRole="checkbox" accessibilityState={{ checked: !!editorMusicItem.checked }}>
                    <CheckBox checked={editorMusicItem.checked} />
                </View>
            }
            actions={[]}
            containerStyle={style.musicItem}
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

    if (!canEdit) {
        const listState = source ? state : RequestStateCode.FINISHED;
        return <FlashList
            data={editingMusicList}
            renderItem={renderItem}
            keyExtractor={item => getMediaUniqueKey(item.musicItem)}
            onEndReached={() => source?.loadMore()}
            onEndReachedThreshold={0.1}
            ListEmptyComponent={<ListEmpty state={listState} onRetry={() => source?.loadMore(true)} />}
            ListFooterComponent={source && editingMusicList.length ? <View style={style.footer}>
                {listState === RequestStateCode.PARTLY_DONE ? <PageAction title={t("musicListEditor.loadMore")} onPress={() => source.loadMore()} />
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
    checkBox: {
        height: "100%",
        justifyContent: "center",
        marginRight: rpx(16),
    },
});
