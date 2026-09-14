/**
 * 音乐附属文件（歌词 / 封面）的命名、查找与清理
 *
 * 约定：附属文件与音频文件放在同一目录，默认与音频同名、仅扩展名不同，
 * 这样第三方播放器（以及本应用的本地文件插件）无需额外配置即可识别。
 */
import { stat, unlink } from "react-native-fs";
import { deleteAndroidSafUri, isAndroidSafUri } from "./androidSaf";
import { getDirectory, removeFileScheme } from "./fileUtils";
import { errorLog } from "./log";
import { getMediaExtraProperty } from "./mediaExtra";

/** 支持的封面扩展名，按顺序作为查找优先级 */
export const COMPANION_COVER_EXTENSIONS = [
    "jpg",
    "jpeg",
    "png",
    "webp",
] as const;

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

function isFileNotFoundError(error: any) {
    const message = `${error?.message ?? error}`.toLowerCase();
    return (
        message.includes("enoent") ||
        message.includes("no such file or directory") ||
        message.includes("file does not exist")
    );
}

/**
 * 删除随下载生成的附属文件（歌词 / 封面）。
 * 路径记录在 mediaExtra 中，SAF 授权目录下的文件走 deleteSafUri。
 * 本函数不会抛错：附属文件清理失败不应阻断删歌主流程。
 */
export async function deleteCompanionFiles(
    musicItem: ICommon.IMediaBase | null,
): Promise<void> {
    if (!musicItem) {
        return;
    }

    const companionPaths = [
        getMediaExtraProperty(musicItem, "localLyricPath"),
        getMediaExtraProperty(musicItem, "localCoverPath"),
    ];

    for (const rawPath of companionPaths) {
        if (typeof rawPath !== "string" || !rawPath) {
            continue;
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
}
