import { useAtomValue } from "jotai";

import { useMusicHistory } from "@/core/musicHistory";
import MusicSheet, { useSheetsBase } from "@/core/musicSheet";
import PluginManager, { useSortedPlugins } from "@/core/pluginManager";
import { getPrimaryArtist } from "@/core/randomPlay";
import { useCurrentMusic } from "@/core/trackPlayer";
import { pluginsTopListAtom } from "@/pages/topList/store/atoms";
import { isSameMediaItem } from "@/utils/mediaUtils";
import { useMemo } from "react";

/** 拾音排除的最近播放条数 */
const RECENT_HISTORY_TO_EXCLUDE = 10;
/** 参与偏好歌手计算的最近播放条数 */
const RECENT_HISTORY_FOR_TASTE = 40;

export default function useHomeOverview() {
    const sortedPlugins = useSortedPlugins();
    const currentMusic = useCurrentMusic();
    const history = useMusicHistory();
    const sheets = useSheetsBase();
    const pluginsTopList = useAtomValue(pluginsTopListAtom);

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

    const favoriteSheet = useMemo(
        () =>
            sheets.find(sheet => sheet.id === MusicSheet.defaultSheet.id) ??
            sheets[0] ??
            null,
        [sheets],
    );

    /** 供拾音复用：已缓存的榜单数据，避免重复请求 */
    const topListCache = useMemo(() => {
        const cache: Record<string, IMusic.IMusicSheetGroupItem[]> = {};
        Object.entries(pluginsTopList ?? {}).forEach(([hash, result]) => {
            if (result?.data?.length) {
                cache[hash] = result.data;
            }
        });
        return cache;
    }, [pluginsTopList]);

    /** 供拾音复用：需要排除的最近播放 */
    const recentHistory = useMemo(
        () => history.slice(0, RECENT_HISTORY_TO_EXCLUDE),
        [history],
    );

    /** 供拾音复用：偏好歌手（轻量个性化） */
    const tasteArtists = useMemo(
        () =>
            Array.from(
                new Set(
                    history
                        .slice(0, RECENT_HISTORY_FOR_TASTE)
                        .map(item => getPrimaryArtist(item?.artist))
                        .filter(Boolean),
                ),
            ),
        [history],
    );

    return {
        currentMusic,
        featuredMusic,
        recentMusics,
        historyCount: history.length,
        favoriteSheet,
        topListPlugins,
        topListCache,
        recentHistory,
        tasteArtists,
    };
}
