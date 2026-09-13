import { useMusicHistory } from "@/core/musicHistory";
import PluginManager, { useSortedPlugins } from "@/core/pluginManager";
import { useCurrentMusic } from "@/core/trackPlayer";
import { isSameMediaItem } from "@/utils/mediaUtils";
import { useMemo } from "react";

export default function useHomeOverview() {
    const sortedPlugins = useSortedPlugins();
    const currentMusic = useCurrentMusic();
    const history = useMusicHistory();

    const enabledPlugins = useMemo(
        () =>
            sortedPlugins.filter(plugin =>
                PluginManager.isPluginEnabled(plugin),
            ),
        [sortedPlugins],
    );

    const topListPlugins = useMemo(
        () =>
            enabledPlugins.filter(plugin =>
                plugin.supportedMethods.has("getTopLists"),
            ),
        [enabledPlugins],
    );

    const featuredMusic = currentMusic ?? history[0] ?? null;

    const recentMusics = useMemo(
        () =>
            history
                .filter(item =>
                    currentMusic ? !isSameMediaItem(item, currentMusic) : true,
                )
                .slice(0, 3),
        [currentMusic, history],
    );

    return {
        currentMusic,
        featuredMusic,
        recentMusics,
        topListPlugins,
    };
}
