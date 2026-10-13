import { useCallback, useState } from "react";

import { useI18N } from "@/core/i18n";
import type { Plugin } from "@/core/pluginManager";
import { buildShiYinQueue, SHIYIN_QUEUE_SIZE } from "@/core/randomPlay";
import TrackPlayer from "@/core/trackPlayer";
import Toast from "@/utils/toast";

export interface IShiYinSource {
    /** 支持 getTopLists 的插件 */
    topListPlugins: Plugin[];
    /** pluginHash -> 榜单分组，复用首页/榜单页已缓存的数据 */
    topListCache?: Record<string, IMusic.IMusicSheetGroupItem[]>;
    /** 需要排除的歌曲，通常是最近播放 */
    excludeMusicItems?: IMusic.IMusicItem[];
    /** 偏好歌手，命中会加权 */
    preferredArtists?: string[];
}

/**
 * 拾音：拉榜单建池 → 去重加权 → 抽样打散 → 直接开播。
 * 所有数据由外部注入，方便测试，也避免在首页渲染期访问播放器状态。
 */
export default function useShiYin(source: IShiYinSource) {
    const { t } = useI18N();
    const [loading, setLoading] = useState(false);

    const start = useCallback(
        async (forceRefresh = false) => {
            if (loading) {
                return;
            }
            const topListPlugins = source.topListPlugins ?? [];

            if (!topListPlugins.length) {
                Toast.warn(t("toast.shiyinNoSource"));
                return;
            }

            setLoading(true);
            try {
                const result = await buildShiYinQueue({
                    plugins: topListPlugins,
                    topListCache: source.topListCache ?? {},
                    excludeMusicItems: [
                        ...(source.excludeMusicItems ?? []),
                        ...TrackPlayer.playList,
                    ],
                    preferredArtists: source.preferredArtists ?? [],
                    forceRefresh,
                    queueSize: SHIYIN_QUEUE_SIZE,
                });

                if (!result.musicList.length) {
                    // 池子为空 = 榜单压根没拉到（插件 / 网络）；池子有歌却挑不出，
                    // 只可能是去重把候选吃光了。两种失败要分开提示，否则没法排查。
                    const emptyToast = result.poolSize
                        ? "toast.shiyinNoMusic"
                        : "toast.shiyinPoolEmpty";
                    Toast.warn(t(emptyToast));
                    return;
                }

                await TrackPlayer.playWithReplacePlayList(
                    result.musicList[0],
                    result.musicList,
                );
                Toast.success(
                    t("toast.shiyinStarted", { count: result.musicList.length }),
                );
            } catch {
                Toast.warn(t("toast.shiyinNoMusic"));
            } finally {
                setLoading(false);
            }
        },
        [loading, source, t],
    );

    return { loading, start };
}
