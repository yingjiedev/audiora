import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
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
import Icon, { IIconName } from "@/components/base/icon";
import { iconSizeConst } from "@/constants/uiConst";

function SelectionAction({ title, accessibilityLabel = title, icon, disabled, danger, onPress }: {
    title: string;
    accessibilityLabel?: string;
    icon: IIconName;
    disabled: boolean;
    danger?: boolean;
    onPress: () => void;
}) {
    const colors = useColors();
    const foreground = danger ? colors.danger : colors.textSecondary ?? colors.text;
    return (
        <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }} disabled={disabled}
            onPress={onPress} style={({ pressed }) => [styles.action, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}>
            <Icon name={icon} size={iconSizeConst.light} color={foreground} />
            <ThemeText fontSize="description" color={foreground} allowFontScaling style={styles.actionText}>{title}</ThemeText>
        </Pressable>
    );
}

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
            <PageAction title={t(allSelected ? "common.unselectAll" : "common.selectAll")} variant="text" disabled={disabled} onPress={onToggleAll} />
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
            <SelectionAction title={t("musicListEditor.nextAction")} accessibilityLabel={t("musicListEditor.addToNextPlay")} icon="motion-play" disabled={disabled}
                onPress={() => run(() => TrackPlayer.addNext(selectedItems), t("toast.addToNextPlay"), t("musicListEditor.actionFailed"))} />
            <SelectionAction title={t("musicListEditor.addToSheet")} icon="folder-plus" disabled={disabled} onPress={() => {
                if (disabled || pending.current) return;
                showPanel("AddToMusicSheet", { musicItem: selectedItems });
                onClear(selectedItems);
            }} />
            <SelectionAction title={t("common.download")} icon="arrow-down-tray" disabled={disabled}
                onPress={() => run(() => downloader.download(selectedItems), t("toast.beginDownload"), t("musicListEditor.actionFailed"))} />
            <SelectionAction title={t("sheetDetail.removeAction")} accessibilityLabel={t("sheetDetail.removeFromSheet")} icon="trash-outline" danger disabled={disabled} onPress={() => {
                if (disabled || pending.current) return;
                showDialog("SimpleDialog", {
                    title: t("sheetDetail.removeFromSheet"),
                    content: t("sheetDetail.removeSelectedContent", { count: selectedItems.length }),
                    onOk: () => run(() => MusicSheet.removeMusic(sheetId, selectedItems), t("sheetDetail.removeSuccess"), t("musicListEditor.actionFailed")),
                });
            }} />
        </View>
    );
}

const styles = StyleSheet.create({
    selectionBar: { minHeight: 44, paddingVertical: spacing.sm, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    actions: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row" },
    action: { flex: 1, minWidth: 44, minHeight: 44, paddingHorizontal: spacing.xxs, paddingVertical: spacing.xs, alignItems: "center", justifyContent: "center", gap: spacing.xxs },
    actionText: { maxWidth: "100%", textAlign: "center" },
});
