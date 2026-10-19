import React from "react";
import { StyleSheet, View } from "react-native";
import MediaDetailHeader from "@/components/base/mediaDetailHeader";
import PlayAllBar from "@/components/base/playAllBar";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { useSheetItem } from "@/core/musicSheet";
import { useParams } from "@/core/router";

interface HeaderProps {
    musicList?: IMusic.IMusicItem[];
    groupCount?: number;
    onEdit?: () => void;
    editingControls?: React.ReactNode;
}

export default function Header({ musicList, groupCount, onEdit, editingControls }: HeaderProps) {
    const { id = "favorite" } = useParams<"local-sheet-detail">();
    const sheet = useSheetItem(id);
    const { t } = useI18N();
    const sourceCount = sheet?.musicList?.length ?? 0;
    const subtitle = groupCount === undefined
        ? t("sheetDetail.totalMusicCount", { count: sourceCount })
        : t("aggregate.collectionCount", { groups: groupCount, sources: sourceCount });

    return (
        <>
            <MediaDetailHeader
                title={sheet?.title ?? t("common.unknownName")}
                artwork={sheet?.coverImg}
                typeLabel={t("common.sheet")}
                source={t("common.local")}
                subtitle={subtitle}
                description={sheet?.description}
            />
            <View style={styles.actions}>
                {editingControls ?? (
                    <PlayAllBar
                        musicList={musicList ?? sheet?.musicList ?? []}
                        actionMusicList={sheet?.musicList ?? []}
                        musicSheet={sheet}
                        onEdit={onEdit}
                    />
                )}
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    actions: { paddingHorizontal: spacing.xxxl, paddingBottom: spacing.sm },
});
