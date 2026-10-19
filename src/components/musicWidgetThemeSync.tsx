import { useEffect } from "react";
import useColors from "@/hooks/useColors";
import { syncMusicWidgetColors } from "@/service/musicWidget";

export default function MusicWidgetThemeSync() {
    const colors = useColors();
    useEffect(() => {
        syncMusicWidgetColors(colors);
    }, [colors]);
    return null;
}
