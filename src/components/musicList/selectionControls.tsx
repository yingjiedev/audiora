import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { PageAction } from "@/components/base/pageSection";
import ThemeText from "@/components/base/themeText";
import Icon, { IIconName } from "@/components/base/icon";
import { spacing } from "@/constants/designSystem";
import { iconSizeConst } from "@/constants/uiConst";
import { useI18N } from "@/core/i18n";
import type { MusicSelectionActions } from "@/core/musicListEditor";
import useColors from "@/hooks/useColors";
import TrackPlayer from "@/core/trackPlayer";
import downloader from "@/core/downloader";
import { showPanel } from "@/components/panels/usePanel";
import { showDialog } from "@/components/dialogs/useDialog";
import Toast from "@/utils/toast";

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

export function SelectionDoneAction({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
    const { t } = useI18N();
    const colors = useColors();
    return <PageAction title={t("common.done")} variant="text" textColor={colors.appBarText ?? colors.text} disabled={disabled} onPress={onPress} />;
}

export function SelectionBar({ count, allSelected, disabled, onToggleAll, description, extraAction }: {
    count: number;
    allSelected: boolean;
    disabled: boolean;
    onToggleAll: () => void;
    description?: string;
    extraAction?: React.ReactNode;
}) {
    const { t } = useI18N();
    return (
        <View>
            <View style={styles.selectionBar}>
                <ThemeText fontSize="description" fontColor="textSecondary">{t("musicListEditor.selectMusicCount", { count })}</ThemeText>
                <View style={styles.selectionButtons}>
                    <PageAction title={t(allSelected ? "common.unselectAll" : "common.selectAll")} variant="text" disabled={disabled} onPress={onToggleAll} />
                    {extraAction}
                </View>
            </View>
            {description ? <ThemeText style={styles.description} fontSize="description" fontColor="textSecondary">{description}</ThemeText> : null}
        </View>
    );
}

interface SelectionRemoval {
    onRemove: (items: IMusic.IMusicItem[]) => void | Promise<void>;
    /** Staged changes can remind the user to save instead of claiming persistence. */
    successMessage?: string;
}

/** Shared toolbar: scenes supply capabilities and persistence, never their own buttons. */
export function SelectionActions({ selectedItems, onClear, actions = {}, removal }: {
    selectedItems: IMusic.IMusicItem[];
    onClear: (items: IMusic.IMusicItem[]) => void;
    actions?: MusicSelectionActions;
    removal?: SelectionRemoval;
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
    const run = async (action: () => void | Promise<void>, success: string) => {
        if (!mounted.current || pending.current || !selectedItems.length) return;
        pending.current = true;
        setBusy(true);
        try {
            await action();
            if (mounted.current) {
                onClear(selectedItems);
                Toast.success(success);
            }
        } catch {
            if (mounted.current) Toast.warn(t("musicListEditor.actionFailed"));
        } finally {
            pending.current = false;
            if (mounted.current) setBusy(false);
        }
    };
    const showRemove = !!removal && actions.remove !== false;
    if (actions.addNext === false && actions.addToSheet === false && actions.download === false && !showRemove) return null;

    return (
        <View style={[styles.actions, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            {actions.addNext !== false ? <SelectionAction title={t("musicListEditor.nextAction")} accessibilityLabel={t("musicListEditor.addToNextPlay")} icon="motion-play" disabled={disabled}
                onPress={() => run(() => TrackPlayer.addNext(selectedItems), t("toast.addToNextPlay"))} /> : null}
            {actions.addToSheet !== false ? <SelectionAction title={t("musicListEditor.addToSheet")} icon="folder-plus" disabled={disabled} onPress={() => {
                if (disabled || pending.current) return;
                showPanel("AddToMusicSheet", { musicItem: selectedItems });
                onClear(selectedItems);
            }} /> : null}
            {actions.download !== false ? <SelectionAction title={t("common.download")} icon="arrow-down-tray" disabled={disabled}
                onPress={() => run(() => downloader.download(selectedItems), t("toast.beginDownload"))} /> : null}
            {showRemove ? <SelectionAction title={t("sheetDetail.removeAction")} accessibilityLabel={t("sheetDetail.removeFromSheet")} icon="trash-outline" danger disabled={disabled} onPress={() => {
                if (disabled || pending.current) return;
                showDialog("SimpleDialog", {
                    title: t("sheetDetail.removeFromSheet"),
                    content: t("sheetDetail.removeSelectedContent", { count: selectedItems.length }),
                    onOk: () => run(() => removal!.onRemove(selectedItems), removal!.successMessage ?? t("sheetDetail.removeSuccess")),
                });
            }} /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    selectionBar: { minHeight: 44, paddingVertical: spacing.sm, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    selectionButtons: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    description: { paddingBottom: spacing.sm },
    actions: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row" },
    action: { flex: 1, minWidth: 44, minHeight: 44, paddingHorizontal: spacing.xxs, paddingVertical: spacing.xs, alignItems: "center", justifyContent: "center", gap: spacing.xxs },
    actionText: { maxWidth: "100%", textAlign: "center" },
});
