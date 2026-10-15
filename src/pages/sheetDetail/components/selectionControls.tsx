import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { PageAction } from "@/components/base/pageSection";
import ThemeText from "@/components/base/themeText";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import TrackPlayer from "@/core/trackPlayer";
import MusicSheet from "@/core/musicSheet";
import downloader from "@/core/downloader";
import { showPanel } from "@/components/panels/usePanel";
import { showDialog } from "@/components/dialogs/useDialog";
import Toast from "@/utils/toast";

export function SelectionBar({ count, allSelected, disabled, onToggleAll }: {
    count: number;
    allSelected: boolean;
    disabled: boolean;
    onToggleAll: () => void;
}) {
    const { t } = useI18N();
    return (
        <View style={styles.selectionBar}>
            <ThemeText fontSize="description" fontColor="textSecondary">{t("musicListEditor.selectMusicCount", { count })}</ThemeText>
            <PageAction title={t(allSelected ? "common.unselectAll" : "common.selectAll")} disabled={disabled} onPress={onToggleAll} />
        </View>
    );
}

export function SelectionActions({ sheetId, selectedItems, onClear }: {
    sheetId: string;
    selectedItems: IMusic.IMusicItem[];
    onClear: (items: IMusic.IMusicItem[]) => void;
}) {
    const { t } = useI18N();
    const colors = useColors();
    const pending = useRef(false);
    const mounted = useRef(true);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const disabled = busy || !selectedItems.length;
    const run = async (action: () => void | Promise<void>, success: string, failure: string) => {
        if (pending.current || !selectedItems.length) return;
        pending.current = true;
        setBusy(true);
        try {
            await action();
            if (mounted.current) {
                onClear(selectedItems);
                Toast.success(success);
            }
        } catch {
            if (mounted.current) Toast.warn(failure);
        } finally {
            pending.current = false;
            if (mounted.current) setBusy(false);
        }
    };
    return (
        <View style={[styles.actions, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <View style={styles.action}><PageAction title={t("musicListEditor.addToNextPlay")} icon="motion-play" disabled={disabled}
                onPress={() => run(() => TrackPlayer.addNext(selectedItems), t("toast.addToNextPlay"), t("musicListEditor.actionFailed"))} /></View>
            <View style={styles.action}><PageAction title={t("musicListEditor.addToSheet")} icon="folder-plus" disabled={disabled} onPress={() => {
                if (disabled || pending.current) return;
                showPanel("AddToMusicSheet", { musicItem: selectedItems });
                onClear(selectedItems);
            }} /></View>
            <View style={styles.action}><PageAction title={t("common.download")} icon="arrow-down-tray" disabled={disabled}
                onPress={() => run(() => downloader.download(selectedItems), t("toast.beginDownload"), t("musicListEditor.actionFailed"))} /></View>
            <View style={styles.action}><PageAction title={t("common.delete")} icon="trash-outline" variant="danger" disabled={disabled} onPress={() => {
                if (disabled || pending.current) return;
                showDialog("SimpleDialog", {
                    title: t("common.delete"),
                    content: t("sheetDetail.removeSelectedContent", { count: selectedItems.length }),
                    onOk: () => run(() => MusicSheet.removeMusic(sheetId, selectedItems), t("toast.deleteSuccess"), t("toast.deleteFailed")),
                });
            }} /></View>
        </View>
    );
}

const styles = StyleSheet.create({
    selectionBar: { minHeight: 44, paddingVertical: spacing.sm, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    actions: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    action: { flexGrow: 1, flexBasis: "45%", minWidth: 0 },
});
