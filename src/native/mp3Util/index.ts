import { NativeModules } from "react-native";

export interface IBasicMeta {
    album?: string;
    artist?: string;
    author?: string;
    duration?: string;
    title?: string;
    /** 平均码率，单位 bps */
    bitrate?: number;
    /** 采样率，单位 Hz */
    sampleRate?: number;
    /** 位深，单位 bit；系统无法可靠获取时为空 */
    bitDepth?: number;
    /** 编码格式小写短名，如 mp3 / aac / flac / alac / wav / vorbis */
    codec?: string;
    /** 声道数 */
    channelCount?: number;
}

export interface IWritableMeta extends IBasicMeta {
    lyric?: string;
    comment?: string;
}

interface IMp3Util {
    getBasicMeta: (fileName: string) => Promise<IBasicMeta>;
    getMediaMeta: (fileNames: string[]) => Promise<IBasicMeta[]>;
    getMediaCoverImg: (mediaPath: string) => Promise<string>;
    /** 读取内嵌歌词 */
    getLyric: (mediaPath: string) => Promise<string>;
    /** 写入meta信息 */
    setMediaTag: (filePath: string, meta: IWritableMeta) => Promise<void>;
    getMediaTag: (filePath: string) => Promise<IWritableMeta>;
}

const Mp3Util = NativeModules.Mp3Util;

export default Mp3Util as IMp3Util;
