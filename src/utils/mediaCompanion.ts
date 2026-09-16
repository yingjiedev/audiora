/**
 * 音乐附属文件（歌词 / 封面）的命名、查找与清理
 *
 * 约定：附属文件与音频文件放在同一目录，默认与音频同名、仅扩展名不同，
 * 这样第三方播放器（以及本应用的本地文件插件）无需额外配置即可识别。
 */
import { readFile, stat, unlink } from "react-native-fs";
import {
    deleteAndroidSafUri,
    isAndroidSafUri,
    readAndroidSafText,
} from "./androidSaf";
import { getDirectory, removeFileScheme } from "./fileUtils";
import { errorLog } from "./log";
import { getMediaExtraProperty, patchMediaExtra } from "./mediaExtra";

/** 支持的封面扩展名，按顺序作为查找优先级 */
export const COMPANION_COVER_EXTENSIONS = [
    "jpg",
    "jpeg",
    "png",
    "webp",
] as const;

/** 支持的歌词扩展名，按顺序作为查找优先级 */
export const COMPANION_LYRIC_EXTENSIONS = ["lrc", "txt"] as const;

/** 第三方播放器常识别的固定封面名，作为同名封面不存在时的兜底 */
export const COMPANION_COVER_FIXED_NAMES = ["cover", "folder", "front"] as const;

export type ICompanionCoverExtension = (typeof COMPANION_COVER_EXTENSIONS)[number];

/** 封面文件命名方式：与音频同名，或使用固定文件名 cover.xxx */
export type ICompanionCoverNaming = "sameAsAudio" | "fixedName";

export const DEFAULT_COMPANION_COVER_EXTENSION: ICompanionCoverExtension = "jpg";
export const DEFAULT_COMPANION_COVER_NAMING: ICompanionCoverNaming = "sameAsAudio";

/**
 * 去掉扩展名后的路径（保留目录）
 * 例：/sdcard/Music/歌曲-歌手.flac -> /sdcard/Music/歌曲-歌手
 */
export function getBasePathWithoutExtension(filePath: string): string {
    const normalized = removeFileScheme(filePath);
    const lastSlash = normalized.lastIndexOf("/");
    const lastDot = normalized.lastIndexOf(".");
    // lastDot > lastSlash + 1 保证不会把 ".gitignore" 这类隐藏文件的点当成扩展名分隔符
    if (lastDot > lastSlash + 1) {
        return normalized.slice(0, lastDot);
    }
    return normalized;
}

/**
 * 从封面 URL 推断扩展名，无法判断时回退 jpg
 */
export function getCoverExtensionFromUrl(url: string): ICompanionCoverExtension {
    if (typeof url !== "string") {
        return DEFAULT_COMPANION_COVER_EXTENSION;
    }
    try {
        const pathname = url.split(/[?#]/)[0];
        const lastSegment = pathname.split("/").pop() ?? "";
        const extension = lastSegment.split(".").pop()?.toLowerCase();
        if (extension && (COMPANION_COVER_EXTENSIONS as readonly string[]).includes(extension)) {
            return extension as ICompanionCoverExtension;
        }
    } catch {
        // 忽略解析失败，使用默认扩展名
    }
    return DEFAULT_COMPANION_COVER_EXTENSION;
}

/**
 * 计算封面文件落盘路径
 */
export function getCompanionCoverPath(
    audioFilePath: string,
    extension: ICompanionCoverExtension = DEFAULT_COMPANION_COVER_EXTENSION,
    naming: ICompanionCoverNaming = DEFAULT_COMPANION_COVER_NAMING,
): string {
    if (naming === "fixedName") {
        return `${getDirectory(removeFileScheme(audioFilePath))}/cover.${extension}`;
    }
    return `${getBasePathWithoutExtension(audioFilePath)}.${extension}`;
}

/**
 * 计算歌词文件落盘路径
 */
export function getCompanionLyricPath(
    audioFilePath: string,
    format: "lrc" | "txt" = "lrc",
): string {
    return `${getBasePathWithoutExtension(audioFilePath)}.${format}`;
}

/**
 * 同目录封面的候选路径（同名优先，其次固定名）。
 * SAF 授权目录（content://）无法通过文件系统遍历，直接返回空。
 */
export function getCompanionCoverCandidates(audioFilePath: string): string[] {
    if (!audioFilePath || isAndroidSafUri(audioFilePath)) {
        return [];
    }

    const normalized = removeFileScheme(audioFilePath);
    const basePath = getBasePathWithoutExtension(normalized);
    const directory = getDirectory(normalized);

    const candidates: string[] = [];
    for (const extension of COMPANION_COVER_EXTENSIONS) {
        candidates.push(`${basePath}.${extension}`);
    }
    for (const name of COMPANION_COVER_FIXED_NAMES) {
        for (const extension of COMPANION_COVER_EXTENSIONS) {
            candidates.push(`${directory}/${name}.${extension}`);
        }
    }
    return candidates;
}

/**
 * 查找音频同目录下的封面文件，找不到返回 null
 */
export async function findCompanionCoverFile(
    audioFilePath: string,
): Promise<string | null> {
    for (const candidate of getCompanionCoverCandidates(audioFilePath)) {
        try {
            const fileStat = await stat(candidate);
            if (fileStat.isFile() && Number(fileStat.size ?? 0) > 0) {
                return candidate;
            }
        } catch {
            // 继续尝试下一个候选
        }
    }
    return null;
}

/** 去掉扩展名的文件名（不含目录） */
export function getFileNameWithoutExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf(".");
    return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
}

/**
 * 判断文件是否为附属文件（歌词 / 封面），不是则返回 null。
 * 用于扫描阶段把目录里的文件分流出音频与附属文件。
 */
export function getCompanionFileKind(
    fileName: string,
): "lyric" | "cover" | null {
    if (typeof fileName !== "string" || !fileName) {
        return null;
    }
    const extension = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
    if ((COMPANION_LYRIC_EXTENSIONS as readonly string[]).includes(extension)) {
        return "lyric";
    }
    if ((COMPANION_COVER_EXTENSIONS as readonly string[]).includes(extension)) {
        return "cover";
    }
    return null;
}

/** 扫描得到的附属文件：普通目录为绝对路径，SAF 目录为 content:// uri */
export interface ICompanionScanFile {
    /** 可直接用于读取的路径或 uri */
    path: string;
    /** 文件名（含扩展名） */
    name: string;
    /** 父目录标识：普通目录为目录绝对路径，SAF 为父目录 uri */
    directory: string;
}

/**
 * 附属文件索引：目录 -> （小写文件名 -> 路径）
 *
 * 之所以用「目录 + 文件名」而不是完整路径，是为了同时支持普通目录与 SAF：
 * content:// 无法按路径拼接出兄弟文件，只能靠扫描结果里的父目录 uri 关联。
 */
export interface ICompanionIndex {
    byDirectory: Map<string, Map<string, string>>;
}

export interface ICompanionMatchTarget {
    path: string;
    name?: string;
    directory?: string;
}

export interface ICompanionMatch {
    lyricPath: string | null;
    coverPath: string | null;
}

function normalizeDirectoryKey(directory: string) {
    return removeFileScheme(directory ?? "");
}

/** 把扫描到的附属文件整理成可按「目录 + 文件名」查表的索引 */
export function buildCompanionIndex(
    files: ICompanionScanFile[],
): ICompanionIndex {
    const byDirectory = new Map<string, Map<string, string>>();
    for (const file of files ?? []) {
        if (!file?.path) {
            continue;
        }
        const directory = normalizeDirectoryKey(file.directory ?? "");
        const fileName = (file.name || file.path.split("/").pop() || "").toLowerCase();
        if (!directory || !fileName) {
            continue;
        }
        let directoryEntries = byDirectory.get(directory);
        if (!directoryEntries) {
            directoryEntries = new Map<string, string>();
            byDirectory.set(directory, directoryEntries);
        }
        // 同名不同大小写只保留第一个，避免重复扫描时反复覆盖
        if (!directoryEntries.has(fileName)) {
            directoryEntries.set(fileName, file.path);
        }
    }
    return { byDirectory };
}

/**
 * 为一条音频匹配同目录的歌词 / 封面。
 *
 * 优先级与落盘命名一致：先按「父目录 + 音频 basename」找同名文件，
 * 封面再以目录级固定名（cover / folder / front）兜底。
 */
export function matchCompanionFiles(
    index: ICompanionIndex,
    audio: ICompanionMatchTarget,
): ICompanionMatch {
    if (!audio?.path || !index?.byDirectory) {
        return { lyricPath: null, coverPath: null };
    }

    const directory = normalizeDirectoryKey(
        audio.directory ?? getDirectory(removeFileScheme(audio.path)),
    );
    const directoryEntries = index.byDirectory.get(directory);
    if (!directoryEntries) {
        return { lyricPath: null, coverPath: null };
    }

    const firstHit = (fileNames: string[]) => {
        for (const fileName of fileNames) {
            const hit = directoryEntries.get(fileName);
            if (hit) {
                return hit;
            }
        }
        return null;
    };

    const baseName = getFileNameWithoutExtension(
        audio.name || audio.path.split("/").pop() || "",
    ).toLowerCase();

    const lyricPath = firstHit(
        COMPANION_LYRIC_EXTENSIONS.map(extension => `${baseName}.${extension}`),
    );
    // 同名封面不存在时用目录级固定名（cover / folder / front）兜底，
    // 这类封面属于整个目录，多首歌共用
    const coverPath =
        firstHit(COMPANION_COVER_EXTENSIONS.map(extension => `${baseName}.${extension}`)) ??
        firstHit(
            COMPANION_COVER_FIXED_NAMES.flatMap(name =>
                COMPANION_COVER_EXTENSIONS.map(extension => `${name}.${extension}`),
            ),
        );

    return { lyricPath, coverPath };
}

/**
 * 把扫描到的歌词 / 封面重新挂到曲目上，并写回 mediaExtra。
 *
 * 重装或换设备后 MMKV 里的 localLyricPath / localCoverPath 全部丢失，
 * 而默认下载文件名不含 platform / id，导入后会生成新的本地身份，
 * 因此只能在导入时按目录结构重新建立关联（issue #83）。
 *
 * 固定名封面（cover / folder / front）属于整个目录，多首歌会指向同一个文件；
 * 删除侧已按共享封面处理，不会因为其中一首被删而连带删除文件。
 *
 * @returns 成功重建关联的曲目数
 */
export function linkCompanionFiles(
    audioFiles: ICompanionMatchTarget[],
    musicItems: ICommon.IMediaBase[],
    companionFiles: ICompanionScanFile[],
): number {
    if (!companionFiles?.length) {
        return 0;
    }
    const index = buildCompanionIndex(companionFiles);
    let linkedCount = 0;

    musicItems.forEach((musicItem, position) => {
        const audioFile = audioFiles[position];
        if (!audioFile || !musicItem?.platform || !musicItem.id) {
            return;
        }
        const { lyricPath, coverPath } = matchCompanionFiles(index, audioFile);
        if (!lyricPath && !coverPath) {
            return;
        }
        patchMediaExtra(musicItem, {
            ...(lyricPath ? { localLyricPath: lyricPath } : {}),
            ...(coverPath ? { localCoverPath: coverPath } : {}),
        });
        linkedCount += 1;
    });

    return linkedCount;
}

/**
 * 读取附属文本文件内容（歌词）。
 * SAF 授权目录下的文件只能通过 ContentResolver 读取，普通路径走 RNFS。
 */
export async function readCompanionText(rawPath: string): Promise<string> {
    const normalized = removeFileScheme(rawPath);
    if (isAndroidSafUri(normalized)) {
        return await readAndroidSafText(normalized);
    }
    return await readFile(normalized, "utf8");
}

/**
 * 转成可直接用于 <Image /> 的 file:// 地址；SAF uri 原样返回
 */
export function toFileUri(filePath: string): string {
    const normalized = removeFileScheme(filePath);
    if (isAndroidSafUri(normalized)) {
        return normalized;
    }
    return normalized.startsWith("/") ? `file://${normalized}` : normalized;
}

/**
 * 解析本地曲目的附属封面，优先级：同目录封面文件 > mediaExtra 记录的封面路径。
 * 返回 null 表示没有独立封面，由调用方决定是否回退到音频内嵌 tag。
 */
export async function resolveCompanionArtwork(
    rawLocalPath: string,
    musicItem: ICommon.IMediaBase | null,
): Promise<string | null> {
    if (!rawLocalPath) {
        return null;
    }
    const localPath = removeFileScheme(rawLocalPath);
    // content:// 目录无法按路径遍历，跳过同目录查找
    if (!isAndroidSafUri(localPath)) {
        const fileCover = await findCompanionCoverFile(localPath);
        if (fileCover) {
            return toFileUri(fileCover);
        }
    }
    const recordedCover = musicItem
        ? getMediaExtraProperty(musicItem, "localCoverPath")
        : null;
    return typeof recordedCover === "string" && recordedCover
        ? toFileUri(recordedCover)
        : null;
}

function isFileNotFoundError(error: any) {
    const message = `${error?.message ?? error}`.toLowerCase();
    return (
        message.includes("enoent") ||
        message.includes("no such file or directory") ||
        message.includes("file does not exist")
    );
}

export interface IDeleteCompanionOptions {
    /**
     * 封面路径是否仍被其他曲目引用。
     * 引用关系由歌单（core 层）持有，这里只接受回调，避免 utils 反向依赖 core。
     */
    isCoverReferencedByOther?: (coverPath: string) => boolean;
}

/**
 * 判断是否为「目录级共享封面」。
 * 固定名（cover / folder / front）封面属于整个目录，归可能的多首歌曲共用，
 * 删除单曲时不能把它当成该单曲的私有文件一起删掉。
 */
export function isSharedCoverPath(coverPath: string): boolean {
    if (typeof coverPath !== "string" || !coverPath) {
        return false;
    }
    const fileName = removeFileScheme(coverPath).split("/").pop() ?? "";
    const lastDot = fileName.lastIndexOf(".");
    if (lastDot <= 0) {
        return false;
    }
    const nameWithoutExtension = fileName.slice(0, lastDot).toLowerCase();
    const extension = fileName.slice(lastDot + 1).toLowerCase();
    return (
        (COMPANION_COVER_FIXED_NAMES as readonly string[]).includes(nameWithoutExtension) &&
        (COMPANION_COVER_EXTENSIONS as readonly string[]).includes(extension)
    );
}

/**
 * 删除单个附属文件，失败只记日志（文件不存在视为成功）。
 * 封面会先做「目录共享 / 仍被引用」两道保护。
 */
export async function deleteCompanionPath(
    rawPath: string | null | undefined,
    options: IDeleteCompanionOptions = {},
    treatAsCover = false,
): Promise<void> {
    if (typeof rawPath !== "string" || !rawPath) {
        return;
    }

    if (treatAsCover) {
        if (isSharedCoverPath(rawPath)) {
            return;
        }
        if (options.isCoverReferencedByOther?.(rawPath)) {
            return;
        }
    }

    try {
        if (isAndroidSafUri(rawPath)) {
            await deleteAndroidSafUri(rawPath);
        } else {
            await unlink(removeFileScheme(rawPath));
        }
    } catch (error) {
        if (!isFileNotFoundError(error)) {
            errorLog("附属文件清理失败", { path: rawPath, error });
        }
    }
}

/**
 * 删除随下载生成的附属文件（歌词 / 封面）。
 * 路径记录在 mediaExtra 中，SAF 授权目录下的文件走 deleteSafUri。
 * 本函数不会抛错：附属文件清理失败不应阻断删歌主流程。
 */
export async function deleteCompanionFiles(
    musicItem: ICommon.IMediaBase | null,
    options: IDeleteCompanionOptions = {},
): Promise<void> {
    if (!musicItem) {
        return;
    }

    const lyricPath = getMediaExtraProperty(musicItem, "localLyricPath");
    const coverPath = getMediaExtraProperty(musicItem, "localCoverPath");

    // 歌词永远与音频同名，属于当前曲目私有
    await deleteCompanionPath(lyricPath, options, false);
    await deleteCompanionPath(coverPath, options, true);
}
