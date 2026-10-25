import React from "react";
import { StyleSheet, View } from "react-native";
import MediaDetailHeader from "@/components/base/mediaDetailHeader";
import PlayAllBar from "@/components/base/playAllBar";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { usePluginDisplayNameResolver } from "@/core/pluginManager";

interface IHeaderProps {
    onEdit?: () => void;
    editingControls?: React.ReactNode;
    musicSheet: IMusic.IMusicSheetItem | null;
    musicList: IMusic.IMusicItem[] | null;
    canStar?: boolean;
    typeLabel?: string;
    variant?: "all" | "details" | "actions";
}
export default function Header({ musicSheet, musicList, canStar, typeLabel, onEdit, editingControls, variant = "all" }: IHeaderProps) {
    const { t } = useI18N();
    const getDisplayName = usePluginDisplayNameResolver();
    const platform = musicSheet?.platform;
    const count = musicSheet?.worksNum ?? musicList?.length ?? 0;
    const subtitle = [musicSheet?.artist, t("sheetDetail.totalMusicCount", { count })].filter(Boolean).join(" · ");
    return (
        <>
            {variant !== "actions" ? <MediaDetailHeader title={musicSheet?.title ?? t("common.unknownName")} artwork={musicSheet?.artwork ?? musicSheet?.coverImg}
                typeLabel={typeLabel ?? t("common.sheet")} source={platform ? getDisplayName(platform) : null}
                subtitle={subtitle} description={musicSheet?.description} prominent={variant === "details"} /> : null}
            {variant !== "details" ? <View style={styles.actions}>{editingControls ?? <PlayAllBar onEdit={onEdit} canStar={canStar} musicList={musicList} musicSheet={musicSheet} />}</View> : null}
        </>
    );
}
const styles = StyleSheet.create({ actions: { paddingHorizontal: spacing.xxxl, paddingBottom: spacing.sm } });
