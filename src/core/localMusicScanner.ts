import { supportLocalMediaType } from "@/constants/mediaConst";
import {
    getLegacyPathFromAndroidDocumentId,
    scanAndroidSafDirectoryFiles,
} from "@/utils/androidSaf";
import { getDirectory } from "@/utils/fileUtils";
import {
    getCompanionFileKind,
    type ICompanionScanFile,
} from "@/utils/mediaCompanion";
import { readDir, stat } from "react-native-fs";

export interface ILocalMediaFile {
    path: string;
    name: string;
    legacyPath?: string;
    /** 父目录标识：普通目录为目录绝对路径，SAF 为父目录 uri */
    directory?: string;
}

export interface ILocalMediaScanResult {
    /** 可导入的音频文件 */
    audioFiles: ILocalMediaFile[];
    /** 同目录的歌词 / 封面，用于导入时重建附属文件关联 */
    companionFiles: ICompanionScanFile[];
}

function normalizeLocalPath(filePath: string) {
    return filePath.startsWith("file://") ? filePath.slice(7) : filePath;
}

export function isSupportedLocalMedia(filePath: string) {
    const normalizedPath = filePath.toLowerCase();
    return supportLocalMediaType.some(extension =>
        normalizedPath.endsWith(extension),
    );
}

/**
 * 扫描本地目录（含 Android SAF 授权目录）。
 *
 * 返回值不再只有音频：歌词 / 封面一起返回，导入流程才能把它们重新关联到曲目上
 * （重装后 MMKV 里的 localLyricPath / localCoverPath 已丢失，见 issue #83）。
 */
export async function scanLocalMediaPaths(
    inputPaths: string[],
    shouldContinue: () => boolean = () => true,
): Promise<ILocalMediaScanResult> {
    const safDirectories = inputPaths.filter(path => path.startsWith("content://"));
    const pendingPaths = inputPaths
        .filter(path => !path.startsWith("content://"))
        .map(normalizeLocalPath);
    const audioFiles: ILocalMediaFile[] = [];
    const companionFiles: ICompanionScanFile[] = [];
    const visitedDirectories = new Set<string>();

    for (const directoryUri of safDirectories) {
        if (!shouldContinue()) {
            throw new Error("Import Broken");
        }
        const files = await scanAndroidSafDirectoryFiles(directoryUri);
        files.forEach(file => {
            if (!file?.uri) {
                return;
            }
            const directory = file.parentUri || directoryUri;
            const name = file.name || file.uri.split("/").pop() || file.uri;
            const isAudio =
                file.kind === "audio" || isSupportedLocalMedia(name);
            if (isAudio) {
                audioFiles.push({
                    path: file.uri,
                    name,
                    directory,
                    legacyPath: getLegacyPathFromAndroidDocumentId(
                        file.documentId,
                    ) ?? undefined,
                });
                return;
            }
            if (file.kind === "lyric" || file.kind === "cover") {
                companionFiles.push({ path: file.uri, name, directory });
            }
        });
    }

    while (pendingPaths.length) {
        if (!shouldContinue()) {
            throw new Error("Import Broken");
        }

        const currentPath = pendingPaths.shift() as string;
        try {
            const currentStat = await stat(currentPath);
            if (currentStat.isFile()) {
                if (isSupportedLocalMedia(currentPath)) {
                    audioFiles.push({
                        path: currentPath,
                        name: currentPath.split("/").pop() ?? currentPath,
                        directory: getDirectory(currentPath),
                    });
                }
                continue;
            }
            if (!currentStat.isDirectory() || visitedDirectories.has(currentPath)) {
                continue;
            }

            visitedDirectories.add(currentPath);
            const children = await readDir(currentPath);
            children.forEach(child => {
                if (child.isDirectory()) {
                    pendingPaths.push(child.path);
                    return;
                }
                if (!child.isFile()) {
                    return;
                }
                const name = child.name || child.path.split("/").pop() || "";
                if (isSupportedLocalMedia(child.path)) {
                    audioFiles.push({
                        path: child.path,
                        name,
                        directory: getDirectory(child.path),
                    });
                    return;
                }
                if (getCompanionFileKind(name)) {
                    companionFiles.push({
                        path: child.path,
                        name,
                        directory: getDirectory(child.path),
                    });
                }
            });
        } catch {
            // Ignore entries that disappeared or became inaccessible mid-scan.
        }
    }

    return {
        audioFiles: [
            ...new Map(audioFiles.map(file => [file.path, file])).values(),
        ],
        companionFiles: [
            ...new Map(companionFiles.map(file => [file.path, file])).values(),
        ],
    };
}
