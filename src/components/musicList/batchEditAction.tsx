import React from "react";
import { StyleSheet, View } from "react-native";
import { PageAction } from "@/components/base/pageSection";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import useOpenMusicListEditor from "./useOpenMusicListEditor";
import type { MusicSelectionActions } from "@/core/musicListEditor";

export default function BatchEditAction({ musicList, sourceId, title, actions }: {
    musicList: IMusic.IMusicItem[];
    sourceId: string;
    title: string;
    actions?: MusicSelectionActions;
}) {
    const openEditor = useOpenMusicListEditor();
    const { t } = useI18N();
    if (!musicList.length) return null;
    return <View style={styles.toolbar}>
        <PageAction title={t("common.batchEdit")} icon="pencil-square" onPress={() => openEditor({
            musicList,
            musicSheet: { title },
            sourceId,
            actions,
        })} />
    </View>;
}

const styles = StyleSheet.create({
    toolbar: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.xs, flexDirection: "row", justifyContent: "flex-end" },
});
