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
export default function Body() {
    const { musicSheet } = useParams<"music-list-editor">();
    const { t } = useI18N();
    const [editingMusicList, setEditingMusicList] = useAtom(editingMusicListAtom);
    const [musicListChanged, setMusicListChanged] = useAtom(musicListChangedAtom);
    const selectedItems = useMemo(() => editingMusicList.filter(item => item.checked), [editingMusicList]);
    const allSelected = editingMusicList.length > 0 && selectedItems.length === editingMusicList.length;
    const save = async () => {
        if (!musicListChanged || !musicSheet?.id) return;
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
                <PageAction title={t("common.save")} variant="primary" disabled={!musicListChanged || !musicSheet?.id} onPress={save} />
            </View>
        </View>
        <MusicList />
    </HorizontalSafeAreaView>;
}
const styles = StyleSheet.create({
    header: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.md, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs },
});
