import { IIconName } from "@/components/base/icon.tsx";

import { showPanel } from "@/components/panels/usePanel";
import { PageAction } from "@/components/base/pageSection";
import { spacing } from "@/constants/designSystem";
import downloader from "@/core/downloader";
import { useI18N } from "@/core/i18n";
import { useParams } from "@/core/router";
import TrackPlayer from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";

import Toast from "@/utils/toast";
import { produce } from "immer";
import { useAtom, useSetAtom } from "jotai";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { editingMusicListAtom, musicListChangedAtom } from "../store/atom";

export default function Bottom() {
    const { musicSheet } = useParams<"music-list-editor">();
    const [editingMusicList, setEditingMusicList] =
        useAtom(editingMusicListAtom);
    const setMusicListChanged = useSetAtom(musicListChangedAtom);
    const { t } = useI18N();
    const colors = useColors();

    const selectedEditorItems = useMemo(
        () => editingMusicList.filter(_ => _.checked),
        [editingMusicList],
    );

    const selectedItems = useMemo(
        () => selectedEditorItems.map(_ => _.musicItem),
        [selectedEditorItems],
    );

    function resetSelectedIndices() {
        setEditingMusicList(
            editingMusicList.map(_ => ({
                musicItem: _.musicItem,
                checked: false,
            })),
        );
    }

    return (
        <View style={[style.wrapper, { backgroundColor: colors.card }]}>
            <BottomIcon
                disabled={!selectedItems.length}
                icon="motion-play"
                title={t("musicListEditor.addToNextPlay")}
                onPress={async () => {
                    TrackPlayer.addNext(selectedItems);
                    resetSelectedIndices();
                    Toast.success(t("toast.addToNextPlay"));
                }}
            />
            <BottomIcon
                disabled={!selectedItems.length}
                icon="folder-plus"
                title={t("musicListEditor.addToSheet")}
                onPress={() => {
                    if (selectedItems.length) {
                        showPanel("AddToMusicSheet", {
                            musicItem: selectedItems,
                        });
                        resetSelectedIndices();
                    }
                }}
            />
            <BottomIcon
                disabled={!selectedItems.length}
                icon="arrow-down-tray"
                title={t("common.download")}
                onPress={() => {
                    if (selectedItems.length) {
                        downloader.download(selectedItems);
                        Toast.success(
                            t("toast.beginDownload"),
                        );
                        resetSelectedIndices();
                    }
                }}
            />
            <BottomIcon
                disabled={!selectedItems.length}
                icon="trash-outline"
                title={t("common.delete")}
                danger
                unavailable={!musicSheet?.id}
                onPress={() => {
                    if (selectedItems.length && musicSheet?.id) {
                        setEditingMusicList(
                            produce(prev => prev.filter(_ => !_.checked)),
                        );
                        setMusicListChanged(true);
                        Toast.warn(t("toast.rememberToSave"));
                    }
                }}
            />
        </View>
    );
}

interface IBottomIconProps { icon: IIconName; title: string; onPress: () => void; disabled?: boolean; unavailable?: boolean; danger?: boolean; }
function BottomIcon({ icon, title, onPress, disabled, unavailable, danger }: IBottomIconProps) {
    return <View style={style.item}><PageAction title={title} icon={icon} onPress={onPress} disabled={disabled || unavailable} variant={danger ? "danger" : "tonal"} /></View>;
}
const style = StyleSheet.create({ wrapper: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.md, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, item: { flexGrow: 1, flexBasis: "45%", minWidth: 0 } });
