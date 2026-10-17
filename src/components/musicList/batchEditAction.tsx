import React from "react";
import { StyleSheet, View } from "react-native";
import { PageAction } from "@/components/base/pageSection";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";

export default function BatchEditAction({ musicList, sourceId, title }: {
    musicList: IMusic.IMusicItem[];
    sourceId: string;
    title: string;
}) {
    const navigate = useNavigate();
    const { t } = useI18N();
    if (!musicList.length) return null;
    return <View style={styles.toolbar}>
        <PageAction title={t("common.batchEdit")} icon="pencil-square" onPress={() => navigate(ROUTE_PATH.MUSIC_LIST_EDITOR, {
            musicList,
            musicSheet: { title },
            sourceId,
            selectionOnly: true,
        })} />
    </View>;
}

const styles = StyleSheet.create({
    toolbar: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.xs, flexDirection: "row", justifyContent: "flex-end" },
});
