import React from "react";
import { StyleSheet, View } from "react-native";
import MediaDetailHeader from "@/components/base/mediaDetailHeader";
import PlayAllBar from "@/components/base/playAllBar";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { useSheetItem } from "@/core/musicSheet";
import { useParams } from "@/core/router";

export default function Header({ onEdit, editingControls }: { onEdit?: () => void; editingControls?: React.ReactNode }) {
    const { id = "favorite" } = useParams<"local-sheet-detail">();
    const sheet = useSheetItem(id);
    const { t } = useI18N();
    return (
        <>
            <MediaDetailHeader title={sheet?.title ?? t("common.unknownName")} artwork={sheet?.coverImg}
                typeLabel={t("common.sheet")} source={t("common.local")}
                subtitle={t("sheetDetail.totalMusicCount", { count: sheet?.musicList?.length ?? 0 })} description={sheet?.description} />
            <View style={styles.actions}>{editingControls ?? <PlayAllBar musicList={sheet?.musicList ?? []} musicSheet={sheet} onEdit={onEdit} />}</View>
        </>
    );
}
const styles = StyleSheet.create({ actions: { paddingHorizontal: spacing.xxxl, paddingBottom: spacing.sm } });
