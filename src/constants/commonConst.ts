import { motionDuration, motionEasing } from "@/utils/motion";

export const internalSymbolKey = Symbol.for("$");
// 加入播放列表的时间；app内使用，无法被序列化
export const timeStampSymbol = Symbol.for("time-stamp");
// 加入播放列表的辅助顺序
export const sortIndexSymbol = Symbol.for("sort-index");
export const internalSerializeKey = "$";
export const localMusicSheetId = "local-music-sheet";
export const musicHistorySheetId = "history-music-sheet";

export const localPluginPlatform = "本地";
export const localPluginHash = "local-plugin-hash";

export const internalFakeSoundKey = "fake-key";

const emptyFunction = () => {};
Object.freeze(emptyFunction);
export { emptyFunction };

export enum RequestStateCode {
    /** 空闲 */
    IDLE = 0b00000000,
    PENDING_FIRST_PAGE = 0b00000010,
    LOADING = 0b00000010,
    /** 检索中 */
    PENDING_REST_PAGE = 0b00000011,
    /** 部分结束 */
    PARTLY_DONE = 0b00000100,
    /** 全部结束 */
    FINISHED = 0b0001000,
    /** 出错了 */
    ERROR = 0b10000000,
}

export const StorageKeys = {
    /** @deprecated */
    MediaMetaKeys: "media-meta-keys",
    PluginMetaKey: "plugin-meta",
    MediaCache: "media-cache",
    LocalMusicSheet: "local-music-sheet",
};

export const CacheControl = {
    Cache: "cache",
    NoCache: "no-cache",
    NoStore: "no-store",
};

export { supportLocalMediaType } from "./mediaConst";

// Motion durations/easings now live in `designSystem.motion` (single source of
// truth). These presets only map the legacy names onto the tokens so existing
// call sites keep compiling; new code should use `useMotion()` instead.
export const timingConfig = {
    animationFast: {
        duration: motionDuration("fast"),
        easing: motionEasing.decelerate,
    },
    animationNormal: {
        duration: motionDuration("normal"),
        easing: motionEasing.decelerate,
    },
    animationSlow: {
        duration: motionDuration("slow"),
        easing: motionEasing.decelerate,
    },
};

export const enum SortType {
    // 未排序
    None = "None",
    // 按标题排序
    Title = "title",
    // 按作者排序
    Artist = "artist",
    // 按专辑名排序
    Album = "album",
    // 按时间排序
    Newest = "time",
    // 按时间逆序
    Oldest = "time-rev",
}

export const enum ResumeMode {
    Append = "append",
    Overwrite = "overwrite",
    OverwriteDefault = "overwrite-default",
}
