import React from "react";
import { StyleSheet, View } from "react-native";
import MediaDetailHeader from "@/components/base/mediaDetailHeader";
import PlayAllBar from "@/components/base/playAllBar";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { usePluginDisplayNameResolver } from "@/core/pluginManager";

interface IHeaderProps {
    sourceId?: string;
    musicSheet: IMusic.IMusicSheetItem | null;
    musicList: IMusic.IMusicItem[] | null;
    canStar?: boolean;
    typeLabel?: string;
}
export default function Header({ musicSheet, musicList, canStar, typeLabel, sourceId }: IHeaderProps) {
    const { t } = useI18N();
    const getDisplayName = usePluginDisplayNameResolver();
    const platform = musicSheet?.platform;
    const count = musicSheet?.worksNum ?? musicList?.length ?? 0;
    const subtitle = [musicSheet?.artist, t("sheetDetail.totalMusicCount", { count })].filter(Boolean).join(" · ");
    return (
        <>
            <MediaDetailHeader title={musicSheet?.title ?? t("common.unknownName")} artwork={musicSheet?.artwork ?? musicSheet?.coverImg}
                typeLabel={typeLabel ?? t("common.sheet")} source={platform ? getDisplayName(platform) : null}
                subtitle={subtitle} description={musicSheet?.description} />
            <View style={styles.actions}><PlayAllBar sourceId={sourceId} canStar={canStar} musicList={musicList} musicSheet={musicSheet} /></View>
        </>
    );
}
const styles = StyleSheet.create({ actions: { paddingHorizontal: spacing.xxxl, paddingBottom: spacing.sm } });
