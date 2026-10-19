import React, { useRef, useState } from "react";
import { iconSizeConst } from "@/constants/uiConst";
import { useCurrentMusic } from "@/core/trackPlayer";
import Icon from "@/components/base/icon.tsx";
import MusicSheet, { useFavorite } from "@/core/musicSheet";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import Toast from "@/utils/toast";

export default function HeartIcon() {
    const musicItem = useCurrentMusic();
    const { t } = useI18N();
    const colors = useColors();
    const isFavorite = useFavorite(musicItem);
    const grouped = !!musicItem && !!MusicSheet.favorites.groupFor(musicItem);
    const pending = useRef(false);
    const [busy, setBusy] = useState(false);
    return (
        <Icon
            name={isFavorite ? "heart" : "heart-outline"}
            size={iconSizeConst.normal}
            color={isFavorite ? colors.mediaFavorite : colors.onMedia ?? colors.text}
            accessibilityRole="button"
            accessibilityLabel={t(isFavorite ? (grouped ? "aggregate.unfavoriteGroup" : "musicDetail.a11y.unfavorite") : "musicDetail.a11y.favorite")}
            accessibilityState={{ selected: isFavorite, disabled: busy }}
            onPress={async () => {
                if (!musicItem || pending.current) return;
                pending.current = true; setBusy(true);
                try {
                    await MusicSheet.favorites.toggle(musicItem);
                } catch {
                    Toast.warn(t("aggregate.updateFailed"));
                } finally {
                    pending.current = false; setBusy(false);
                }
            }}
        />
    );
}
