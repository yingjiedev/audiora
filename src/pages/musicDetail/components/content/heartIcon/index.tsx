import React from "react";
import { iconSizeConst } from "@/constants/uiConst";
import { useCurrentMusic } from "@/core/trackPlayer";
import Icon from "@/components/base/icon.tsx";
import MusicSheet, { useFavorite } from "@/core/musicSheet";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";

export default function () {
    const musicItem = useCurrentMusic();
    const { t } = useI18N();
    const colors = useColors();

    const isFavorite = useFavorite(musicItem);

    return isFavorite ? (
        <Icon
            name="heart"
            size={iconSizeConst.normal}
            color="red"
            accessibilityRole="button"
            accessibilityLabel={t("musicDetail.a11y.unfavorite")}
            accessibilityState={{ selected: true }}
            onPress={() => {
                if (!musicItem) {
                    return;
                }
                MusicSheet.removeMusic(MusicSheet.defaultSheet.id, musicItem);
            }}
        />
    ) : (
        <Icon
            name="heart-outline"
            size={iconSizeConst.normal}
            color={colors.onMedia ?? colors.text}
            accessibilityRole="button"
            accessibilityLabel={t("musicDetail.a11y.favorite")}
            accessibilityState={{ selected: false }}
            onPress={() => {
                if (musicItem) {
                    MusicSheet.addMusic(MusicSheet.defaultSheet.id, musicItem);
                }
            }}
        />
    );
}
