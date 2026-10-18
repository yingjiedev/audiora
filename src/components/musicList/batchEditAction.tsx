import React from "react";
import { StyleSheet, View } from "react-native";
import { PageAction } from "@/components/base/pageSection";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";

export default function BatchEditAction({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
    const { t } = useI18N();
    return <View style={styles.toolbar}>
        <PageAction title={t("common.batchEdit")} icon="pencil-square" disabled={disabled} onPress={onPress} />
    </View>;
}

const styles = StyleSheet.create({
    toolbar: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.xs, flexDirection: "row", justifyContent: "flex-end" },
});
