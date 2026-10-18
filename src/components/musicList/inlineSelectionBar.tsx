import React from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { SelectionBar } from "./selectionHeader";
import type { MusicSelectionController } from "./useMusicSelection";

export default function InlineSelectionBar({ editor, count, paginated = false }: {
    editor: MusicSelectionController;
    count: number;
    paginated?: boolean;
}) {
    const { t } = useI18N();
    return editor.editing ? <View style={styles.controls}>
        <SelectionBar count={editor.selectedItems.length} allSelected={editor.allSelected} disabled={!count} onToggleAll={editor.toggleAll}
            description={paginated ? t("musicListEditor.loadedCount", { count }) : undefined} />
    </View> : null;
}

const styles = StyleSheet.create({ controls: { paddingHorizontal: spacing.xxxl } });
