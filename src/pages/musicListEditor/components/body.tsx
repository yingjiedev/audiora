import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { PageAction } from "@/components/base/pageSection";
import { SelectionBar } from "@/components/musicList/selectionControls";
import { spacing } from "@/constants/designSystem";
import { useAtom } from "jotai";
import { editingMusicListAtom } from "../store/atom";
import MusicList from "./musicList";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import { useI18N } from "@/core/i18n";
import { MusicListSource } from "@/core/musicListSource";
import { RequestStateCode } from "@/constants/commonConst";

export default function Body({ source, state, canEdit, canSave, onSave }: {
    source?: MusicListSource;
    state: RequestStateCode;
    canEdit: boolean;
    canSave: boolean;
    onSave: () => void;
}) {
    const { t } = useI18N();
    const [editingMusicList, setEditingMusicList] = useAtom(editingMusicListAtom);
    const selectedCount = useMemo(() => editingMusicList.filter(item => item.checked).length, [editingMusicList]);
    const allSelected = editingMusicList.length > 0 && selectedCount === editingMusicList.length;
    return <HorizontalSafeAreaView style={globalStyle.flex1}>
        <View style={styles.controls}>
            <SelectionBar count={selectedCount} allSelected={allSelected} disabled={!editingMusicList.length}
                onToggleAll={() => setEditingMusicList(previous => previous.map(item => ({ ...item, checked: !allSelected })))}
                description={source ? t("musicListEditor.loadedCount", { count: editingMusicList.length }) : undefined}
                extraAction={canEdit ? <PageAction title={t("common.save")} variant="text" disabled={!canSave} onPress={onSave} /> : undefined} />
        </View>
        <MusicList source={source} state={state} canEdit={canEdit} />
    </HorizontalSafeAreaView>;
}

const styles = StyleSheet.create({
    controls: { paddingHorizontal: spacing.xxxl },
});
