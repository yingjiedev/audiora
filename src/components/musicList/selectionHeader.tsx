import React from "react";
import { StyleSheet, View } from "react-native";
import { PageAction } from "@/components/base/pageSection";
import ThemeText from "@/components/base/themeText";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";

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
    return <View>
        <View style={styles.selectionBar}>
            <ThemeText fontSize="description" fontColor="textSecondary">{t("musicListEditor.selectMusicCount", { count })}</ThemeText>
            <View style={styles.selectionButtons}>
                <PageAction title={t(allSelected ? "common.unselectAll" : "common.selectAll")} variant="text" disabled={disabled} onPress={onToggleAll} />
                {extraAction}
            </View>
        </View>
        {description ? <ThemeText style={styles.description} fontSize="description" fontColor="textSecondary">{description}</ThemeText> : null}
    </View>;
}

const styles = StyleSheet.create({
    selectionBar: { minHeight: 44, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    selectionButtons: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    description: { paddingBottom: spacing.sm },
});
