/**
 * 下载完成后写入的附属文件（歌词 / 封面）
 *
 * 设计要点：
 * 1. 与音频文件同目录存放，默认同名不同扩展名，第三方播放器可直接识别；
 * 2. 封面先下载到 .part 临时文件再移动，避免半张图被当成成品；
 * 3. 两个写入都 best-effort：失败只记日志，绝不影响已经落盘的音频文件。
 *    （下载后处理的整体隔离见 issue #64，这里先保证新增逻辑不会拖垮任务）
 */
import { IAppConfig } from "@/types/core/config";
import type { IPluginManager } from "@/types/core/pluginManager";
import { removeFileScheme } from "@/utils/fileUtils";
import { formatLyricsByTimestamp } from "@/utils/lrcParser";
import { errorLog } from "@/utils/log";
import {
    getCompanionCoverPath,
    getCompanionLyricPath,
    getCoverExtensionFromUrl,
} from "@/utils/mediaCompanion";
import { autoDecryptLyric } from "@/utils/musicDecrypter";
import { downloadFile, exists, moveFile, stat, unlink, writeFile } from "react-native-fs";
import musicMetadataManager from "./musicMetadataManager";

type ILyricOrderItem = "original" | "translation" | "romanization";

export interface ICompanionFileConfig {
    /** 是否保存独立歌词文件 */
    downloadLyricFile: boolean;
    /** 歌词文件扩展名 */
    lyricFileFormat: "lrc" | "txt";
    /** 歌词内容顺序 */
    lyricOrder: ILyricOrderItem[];
    /** 是否保留逐字时间戳 */
    enableWordByWord: boolean;
    /** 是否保存独立封面文件 */
    downloadCoverFile: boolean;
    /** 封面文件命名方式 */
    coverFileNaming: "sameAsAudio" | "fixedName";
}

export interface ICompanionFilesResult {
    lyricPath: string | null;
    coverPath: string | null;
}

export function getCompanionFileConfig(
    configService: IAppConfig,
): ICompanionFileConfig {
    return {
        downloadLyricFile: configService.getConfig("basic.downloadLyricFile") ?? false,
        lyricFileFormat: configService.getConfig("basic.lyricFileFormat") ?? "lrc",
        lyricOrder: configService.getConfig("basic.lyricOrder") ?? [
            "romanization",
            "original",
            "translation",
        ],
        enableWordByWord:
            configService.getConfig("basic.enableWordByWordLyric") ?? false,
        downloadCoverFile: configService.getConfig("basic.downloadCoverFile") ?? false,
        coverFileNaming:
            configService.getConfig("basic.downloadCoverFileNaming") ?? "sameAsAudio",
    };
}

async function writeLyricFile(
    musicItem: IMusic.IMusicItem,
    audioFilePath: string,
    config: ICompanionFileConfig,
    pluginManager: IPluginManager,
): Promise<string | null> {
    try {
        const plugin = pluginManager.getByName(musicItem.platform);
        if (!plugin) {
            return null;
        }

        const lyricSource = await plugin.methods.getLyric(musicItem);
        if (!lyricSource) {
            return null;
        }

        const rawLrc = lyricSource.rawLrc
            ? await autoDecryptLyric(lyricSource.rawLrc, config.enableWordByWord)
            : undefined;
        const translation = lyricSource.translation
            ? await autoDecryptLyric(lyricSource.translation, config.enableWordByWord)
            : undefined;
        const romanization = lyricSource.romanization
            ? await autoDecryptLyric(lyricSource.romanization, config.enableWordByWord)
            : undefined;

        if (!rawLrc) {
            return null;
        }

        const lyricContent = formatLyricsByTimestamp(
            rawLrc,
            translation,
            romanization,
            config.lyricOrder,
            { enableWordByWord: config.enableWordByWord },
        );

        if (!lyricContent) {
            return null;
        }

        const lyricFilePath = getCompanionLyricPath(audioFilePath, config.lyricFileFormat);
        await writeFile(removeFileScheme(lyricFilePath), lyricContent, "utf8");
        return lyricFilePath;
    } catch (error) {
        errorLog("歌词文件下载失败", {
            musicItem: musicItem.title,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

async function writeCoverFile(
    musicItem: IMusic.IMusicItem,
    audioFilePath: string,
    config: ICompanionFileConfig,
): Promise<string | null> {
    let tempPath: string | null = null;
    try {
        // 与音乐标签写入共用同一套封面解析策略：优先 musicItem.artwork，其次插件 getMusicInfo
        const coverUrl = await musicMetadataManager.getCoverUrl(musicItem);
        if (!coverUrl) {
            return null;
        }

        const extension = getCoverExtensionFromUrl(coverUrl);
        const coverFilePath = getCompanionCoverPath(
            audioFilePath,
            extension,
            config.coverFileNaming,
        );
        tempPath = `${coverFilePath}.part`;

        try {
            if (await exists(tempPath)) {
                await unlink(tempPath);
            }
        } catch {
            // 临时文件不存在时无需处理
        }

        const result = await downloadFile({
            fromUrl: coverUrl,
            toFile: tempPath,
            headers: {},
        }).promise;

        if (result.statusCode < 200 || result.statusCode >= 300) {
            throw new Error(`封面下载失败，状态码 ${result.statusCode}`);
        }

        const fileStat = await stat(tempPath);
        if (!Number(fileStat.size ?? 0)) {
            throw new Error("封面下载结果为空文件");
        }

        const targetPath = removeFileScheme(coverFilePath);
        if (await exists(targetPath)) {
            await unlink(targetPath);
        }
        await moveFile(tempPath, targetPath);
        tempPath = null;
        return coverFilePath;
    } catch (error) {
        errorLog("封面文件下载失败", {
            musicItem: musicItem.title,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    } finally {
        if (tempPath) {
            await unlink(tempPath).catch(() => {});
        }
    }
}

/**
 * 写入下载附属文件（歌词 / 封面）
 *
 * @param musicItem 原始音乐条目（平台、id 用于取插件与封面）
 * @param audioFilePath 已落盘的音频文件路径（SAF 场景下为应用内部临时路径）
 * @returns 实际写入的文件路径，未启用或失败为 null
 */
export async function writeCompanionFiles(
    musicItem: IMusic.IMusicItem,
    audioFilePath: string,
    configService: IAppConfig,
    pluginManager: IPluginManager,
): Promise<ICompanionFilesResult> {
    const config = getCompanionFileConfig(configService);

    if (!config.downloadLyricFile && !config.downloadCoverFile) {
        return { lyricPath: null, coverPath: null };
    }

    const lyricPath = config.downloadLyricFile
        ? await writeLyricFile(musicItem, audioFilePath, config, pluginManager)
        : null;
    const coverPath = config.downloadCoverFile
        ? await writeCoverFile(musicItem, audioFilePath, config)
        : null;

    return { lyricPath, coverPath };
}
