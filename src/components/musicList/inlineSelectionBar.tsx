import React from "react";
import { View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useI18N } from "@/core/i18n";
import { SelectionBar } from "./selectionHeader";
import type { MusicSelectionController } from "./useMusicSelection";

export default function InlineSelectionBar({ editor, count, paginated = false, style }: {
    editor: MusicSelectionController;
    count: number;
    paginated?: boolean;
    style?: StyleProp<ViewStyle>;
}) {
    const { t } = useI18N();
    return editor.editing ? <View style={style}>
        <SelectionBar count={editor.selectedItems.length} allSelected={editor.allSelected} disabled={!count} onToggleAll={editor.toggleAll}
            description={paginated ? t("musicListEditor.loadedCount", { count }) : undefined} />
    </View> : null;
}
