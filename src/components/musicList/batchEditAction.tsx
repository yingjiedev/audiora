import React from "react";
import { Pressable, StyleSheet } from "react-native";
import Icon from "@/components/base/icon";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import { iconSizeConst } from "@/constants/uiConst";

/** Compact control only; the owning page decides its placement. */
export default function BatchEditAction({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
    const { t } = useI18N();
    const colors = useColors();
    return <Pressable accessibilityRole="button" accessibilityLabel={t("common.batchEdit")} accessibilityState={{ disabled }}
        disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}>
        <Icon pointerEvents="none" name="pencil-square" size={iconSizeConst.light} color={colors.textSecondary} />
    </Pressable>;
}

const styles = StyleSheet.create({
    action: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
