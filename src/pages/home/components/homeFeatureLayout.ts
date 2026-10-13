import rpx from "@/utils/rpx";
import { elevation } from "@/constants/designSystem";

/** Match the companion to the selected listening card without stretching the record layout. */
export const homeFeatureLayout = {
    window: { minimumHeight: rpx(344), artworkHeight: rpx(192), footerHeight: rpx(152) },
    record: { minimumHeight: rpx(256), artworkHeight: rpx(128), footerHeight: rpx(128) },
} as const;

/** Keep perimeter light outside the rounded material clipping layers. */
export function homeRecordShadow(halo: string, shadow: string) {
    return [
        { ...elevation.featured.halo, color: halo },
        { ...elevation.featured.ambient, color: shadow },
    ];
}

export const homeRecordShadowInset = Math.max(
    elevation.featured.halo.blurRadius + elevation.featured.halo.spreadDistance,
    elevation.featured.ambient.blurRadius + elevation.featured.ambient.offsetY,
);
