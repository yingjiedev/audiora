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
import { errorLog, devLog } from "@/utils/log";
import {
    deleteCompanionPath,
    getCompanionCoverPath,
    getCompanionLyricPath,
    getCoverExtensionFromUrl,
    isSharedCoverPath,
} from "@/utils/mediaCompanion";
import { getMediaExtraProperty } from "@/utils/mediaExtra";
import { autoDecryptLyric } from "@/utils/musicDecrypter";
import { downloadFile, exists, moveFile, stat, unlink, writeFile } from "react-native-fs";
import LocalMusicSheet from "./localMusicSheet";
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

/**
 * 生成临时文件后缀。
 * 这里刻意不引入 nanoid：它依赖 nanoid 的 ESM 构建，当前 jest 的
 * transformIgnorePatterns 没有放行该包，会导致引用链上的测试无法加载。
 */
const createTempSuffix = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const coerceError = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

/** 失败日志统一带上平台、id 与文件路径，方便同名歌曲 / SAF 场景定位（issue #64） */
const logCompanionError = (
    scene: string,
    musicItem: IMusic.IMusicItem,
    error: unknown,
    extra: Record<string, unknown> = {},
) => {
    errorLog(scene, {
        title: musicItem.title,
        platform: musicItem.platform,
        id: musicItem.id,
        error: coerceError(error),
        ...extra,
    });
};

async function writeLyricFile(
    musicItem: IMusic.IMusicItem,
    audioFilePath: string,
    config: ICompanionFileConfig,
    pluginManager: IPluginManager,
): Promise<string | null> {
    const targetPath = getCompanionLyricPath(audioFilePath, config.lyricFileFormat);
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

        const lyricFilePath = targetPath;
        await writeFile(removeFileScheme(lyricFilePath), lyricContent, "utf8");
        return lyricFilePath;
    } catch (error) {
        logCompanionError("歌词文件下载失败", musicItem, error, {
            audioFilePath,
            lyricsFilePath: targetPath,
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
    let coverFilePath: string | null = null;
    try {
        // 与音乐标签写入共用同一套封面解析策略：优先 musicItem.artwork，其次插件 getMusicInfo
        const coverUrl = await musicMetadataManager.getCoverUrl(musicItem);
        if (!coverUrl) {
            return null;
        }

        const extension = getCoverExtensionFromUrl(coverUrl);
        coverFilePath = getCompanionCoverPath(
            audioFilePath,
            extension,
            config.coverFileNaming,
        );
        const targetPath = removeFileScheme(coverFilePath);

        // 固定名封面是目录级资源（cover/folder/front），无法确认创建者时不覆盖，
        // 否则会替换掉用户自己放的图片；与音频同名的封面则由本应用完全拥有，可以直接覆盖
        if (isSharedCoverPath(coverFilePath) && (await exists(targetPath))) {
            devLog(
                "warn",
                "目录级封面已存在，跳过写入以避免覆盖用户文件",
                { path: coverFilePath },
            );
            return null;
        }

        // 并发下载到同一目录时避免多个任务共用同一个 .part 临时文件
        tempPath = `${coverFilePath}.${createTempSuffix()}.part`;

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

        if (await exists(targetPath)) {
            await unlink(targetPath);
        }
        await moveFile(tempPath, targetPath);
        tempPath = null;
        return coverFilePath;
    } catch (error) {
        logCompanionError("封面文件下载失败", musicItem, error, {
            audioFilePath,
            coverFilePath,
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

/** 读取当前记录在案的附属文件路径（重新下载前必须先取，否则旧文件会失去追踪） */
export function readCompanionPaths(
    musicItem: ICommon.IMediaBase,
): ICompanionFilesResult {
    return {
        lyricPath: getMediaExtraProperty(musicItem, "localLyricPath") ?? null,
        coverPath: getMediaExtraProperty(musicItem, "localCoverPath") ?? null,
    };
}

/**
 * 合并「本次下载结果」与「既有记录」，返回应写入 mediaExtra 的路径。
 *
 * 规则：
 * - 本次成功且路径与旧记录不同 → 删除旧文件后采用新路径；
 * - 本次没有生成（开关关闭 / 下载失败 / 扩展名变化）→ 保留旧记录，不做无主清除，
 *   否则删歌时就再也找不到旧文件了（issue #63 review）；
 * - 封面删除同样遵循目录共享与其他曲目引用的保护。
 */
export async function reconcileCompanionPaths(
    musicItem: IMusic.IMusicItem,
    previous: ICompanionFilesResult,
    next: ICompanionFilesResult,
): Promise<ICompanionFilesResult> {
    const isCoverReferencedByOther = (coverPath: string) =>
        LocalMusicSheet.isCoverPathUsedByOtherTrack(coverPath, musicItem);

    await deleteIfReplaced(previous.lyricPath, next.lyricPath, false);
    await deleteIfReplaced(previous.coverPath, next.coverPath, true, {
        isCoverReferencedByOther,
    });

    return {
        lyricPath: next.lyricPath ?? previous.lyricPath,
        coverPath: next.coverPath ?? previous.coverPath,
    };
}

async function deleteIfReplaced(
    previousPath: string | null,
    nextPath: string | null,
    treatAsCover: boolean,
    options: Parameters<typeof deleteCompanionPath>[1] = {},
) {
    if (!previousPath) {
        return;
    }
    // 本次没有产出新文件：保留旧记录，由后续删歌流程负责清理
    if (!nextPath) {
        return;
    }
    if (removeFileScheme(nextPath) === removeFileScheme(previousPath)) {
        return;
    }
    await deleteCompanionPath(previousPath, options, treatAsCover);
}
