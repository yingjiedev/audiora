import rpx from "@/utils/rpx";

/** Match the companion to the selected listening card without stretching the record layout. */
export const homeFeatureLayout = {
    window: { minimumHeight: rpx(344), artworkHeight: rpx(192), footerHeight: rpx(152) },
    record: { minimumHeight: rpx(256), artworkHeight: rpx(128), footerHeight: rpx(128) },
} as const;
