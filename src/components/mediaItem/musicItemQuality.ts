import type { BadgeType } from "../base/badge";
import { getQualityKeys } from "@/utils/qualities";
import { mapLocalQuality, resolveLocalAudioMeta } from "@/utils/localQuality";

// master/atmos_plus/atmos/dolby/vinyl 不计入显示，只认以下五级
const qualityBadgeDisplayMap: Record<
    string,
    { type: BadgeType; text: string }
> = {
    hires: { type: "hires", text: "HR" },
    flac24bit: { type: "flac24bit", text: "SQ+" },
    flac: { type: "flac24bit", text: "SQ" },
    "320k": { type: "quality", text: "HQ" },
    "192k": { type: "quality", text: "LQ" },
    "128k": { type: "quality", text: "LQ" },
    "96k": { type: "quality", text: "LQ" },
};

export function getQualityBadge(
    musicItem: IMusic.IMusicItem,
    localMusicItem?: IMusic.IMusicItem,
): { type: BadgeType; text: string } | null {
    if (localMusicItem) {
        const mappedLocalQuality = mapLocalQuality(
            resolveLocalAudioMeta(musicItem, localMusicItem),
        );
        return mappedLocalQuality
            ? qualityBadgeDisplayMap[mappedLocalQuality] ?? null
            : null;
    }

    const qualities = musicItem.qualities;
    if (qualities) {
        const keys = getQualityKeys();
        for (let index = keys.length - 1; index >= 0; index--) {
            const key = keys[index];
            if (qualities[key] && qualityBadgeDisplayMap[key]) {
                return qualityBadgeDisplayMap[key];
            }
        }
    }
    return null;
}
