import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { PageAction } from "@/components/base/pageSection";
import ThemeText from "@/components/base/themeText";
import { spacing } from "@/constants/designSystem";
import { useAtom } from "jotai";
import { editingMusicListAtom, musicListChangedAtom } from "../store/atom";
import Toast from "@/utils/toast";
import MusicList from "./musicList";
import { useParams } from "@/core/router";
import { localMusicSheetId, musicHistorySheetId } from "@/constants/commonConst";
import LocalMusicSheet from "@/core/localMusicSheet";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import musicHistory from "@/core/musicHistory";
import MusicSheet from "@/core/musicSheet";
import { useI18N } from "@/core/i18n";
import { MusicListSource } from "@/core/musicListSource";
import { RequestStateCode } from "@/constants/commonConst";
export default function Body(props: { source?: MusicListSource; state: RequestStateCode }) {
    const { musicSheet, sourceId, selectionOnly } = useParams<"music-list-editor">();
    const canEdit = !!musicSheet?.id && !sourceId && !selectionOnly;
    const { t } = useI18N();
    const [editingMusicList, setEditingMusicList] = useAtom(editingMusicListAtom);
    const [musicListChanged, setMusicListChanged] = useAtom(musicListChangedAtom);
    const selectedItems = useMemo(() => editingMusicList.filter(item => item.checked), [editingMusicList]);
    const allSelected = editingMusicList.length > 0 && selectedItems.length === editingMusicList.length;
    const save = async () => {
        if (!canEdit || !musicListChanged || !musicSheet?.id) return;
        const tracks = editingMusicList.map(item => item.musicItem);
        if (musicSheet.id === localMusicSheetId) await LocalMusicSheet.updateMusicList(tracks);
        else if (musicSheet.id === musicHistorySheetId) await musicHistory.setHistory(tracks);
        else await MusicSheet.manualSort(musicSheet.id, tracks);
        Toast.success(t("toast.saveSuccess")); setMusicListChanged(false);
    };
    return <HorizontalSafeAreaView style={globalStyle.flex1}>
        <View style={styles.header}>
            <ThemeText fontSize="description" fontColor="textSecondary">{t("musicListEditor.selectMusicCount", { count: selectedItems.length })}</ThemeText>
            <View style={styles.actions}>
                <PageAction title={t(allSelected ? "common.unselectAll" : "common.selectAll")} disabled={!editingMusicList.length}
                    onPress={() => setEditingMusicList(editingMusicList.map(item => ({ ...item, checked: !allSelected })))} />
                {canEdit ? <PageAction title={t("common.save")} variant="primary" disabled={!musicListChanged} onPress={save} /> : null}
            </View>
        </View>
        {sourceId ? <ThemeText style={styles.summary} fontSize="description" fontColor="textSecondary">
            {t("musicListEditor.loadedCount", { count: editingMusicList.length })}
        </ThemeText> : null}
        <MusicList source={props.source} state={props.state} canEdit={canEdit} />
    </HorizontalSafeAreaView>;
}
const styles = StyleSheet.create({
    summary: { paddingHorizontal: spacing.xxxl, paddingBottom: spacing.md },
    header: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.md, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs },
});
