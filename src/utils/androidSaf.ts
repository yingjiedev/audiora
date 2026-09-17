import {
    EncodingType,
    StorageAccessFramework,
} from "expo-file-system/legacy";
import NativeUtils from "@/native/utils";

const JSON_MIME_TYPE = "application/json";
const DEFAULT_MUSIC_DIRECTORY = "Music/Audiora";

/**
 * `.lrc` 故意用一个 Android `MimeTypeMap` 不认识的自定义 MIME。
 *
 * DocumentsProvider 落盘时会走 framework 的 `FileUtils.splitFileName`：
 * 若「给定 MIME」与「文件名扩展名推出的 MIME」不一致，它会用
 * `getExtensionFromMimeType(给定 MIME)` 作为扩展名**追加**到文件名后面。
 * Android 不认识 `.lrc`（推出来是 null），所以传 `text/plain` 会得到
 * `歌曲-歌手.lrc.txt`；传一个它同样不认识的 MIME 时该扩展名取不到，
 * 文件名被原样保留。详见 issue #83 的验收记录。
 */
const LRC_MIME_TYPE = "text/x-lrc";

/**
 * 授权目录扫描结果。
 * 除了音频，还会返回同目录的歌词 / 封面，导入时才能重建附属文件关联。
 */
export interface IAndroidSafFile {
    uri: string;
    name: string;
    /** audio | lyric | cover */
    kind?: string;
    /** 直接父目录的 uri，用于把附属文件与音频配对 */
    parentUri?: string;
    documentId?: string;
}

export function getLegacyPathFromAndroidDocumentId(documentId?: string) {
    if (!documentId) {
        return null;
    }
    if (documentId.startsWith("primary:")) {
        return `/storage/emulated/0/${documentId.slice("primary:".length)}`;
    }
    if (documentId.startsWith("raw:")) {
        return documentId.slice("raw:".length);
    }
    return null;
}

export function isAndroidSafUri(uri?: string | null) {
    return uri?.startsWith("content://") ?? false;
}

export function getDefaultMusicDirectoryUri() {
    return StorageAccessFramework.getUriForDirectoryInRoot(
        DEFAULT_MUSIC_DIRECTORY,
    );
}

export function getAndroidSafDirectoryLabel(uri?: string | null) {
    if (!isAndroidSafUri(uri)) {
        return DEFAULT_MUSIC_DIRECTORY;
    }
    const treeMatch = uri?.match(/\/tree\/([^/]+)/);
    if (!treeMatch) {
        return DEFAULT_MUSIC_DIRECTORY;
    }
    try {
        return decodeURIComponent(treeMatch[1]).replace(/^primary:/, "");
    } catch {
        return DEFAULT_MUSIC_DIRECTORY;
    }
}

export async function requestAndroidDirectoryAccess(
    initialDirectoryUri: string | null = getDefaultMusicDirectoryUri(),
) {
    const permission =
        await StorageAccessFramework.requestDirectoryPermissionsAsync(
            initialDirectoryUri,
        );
    return permission.granted ? permission.directoryUri : null;
}

/** 扫描授权目录，返回音频及其同目录的歌词 / 封面 */
export function scanAndroidSafDirectoryFiles(
    directoryUri: string,
): Promise<IAndroidSafFile[]> {
    return NativeUtils.scanSafDirectoryFiles(directoryUri);
}

export function androidSafUriExists(uri: string) {
    return NativeUtils.safUriExists(uri);
}

export function getMimeTypeForFile(fileName: string) {
    const extension = fileName.split(".").pop()?.toLowerCase();
    switch (extension) {
    case "mp3": return "audio/mpeg";
    case "flac": return "audio/flac";
    case "m4a": return "audio/mp4";
    case "ogg": return "audio/ogg";
    case "opus": return "audio/opus";
    case "wav": return "audio/wav";
    case "aac":
    case "acc": return "audio/aac";
    case "lrc": return LRC_MIME_TYPE;
    case "txt": return "text/plain";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "webp": return "image/webp";
    default: return "application/octet-stream";
    }
}

export function copyLocalFileToAndroidDirectory(
    sourcePath: string,
    directoryUri: string,
    displayName: string,
) {
    return NativeUtils.copyFileToSafDirectory(
        sourcePath,
        directoryUri,
        displayName,
        getMimeTypeForFile(displayName),
    );
}

export function deleteAndroidSafUri(uri: string) {
    return NativeUtils.deleteSafUri(uri);
}

/** 读取授权目录下的文本文件（歌词） */
export async function readAndroidSafText(uri: string) {
    return await StorageAccessFramework.readAsStringAsync(uri, {
        encoding: EncodingType.UTF8,
    });
}

export async function writeTextToAndroidDirectory(
    directoryUri: string,
    fileName: string,
    content: string,
) {
    // 不要把扩展名交给 DocumentsProvider 补：`.lrc` 在 Android 眼里没有对应 MIME，
    // 一旦交给它推导，`.lrc` 会被追加成 `.lrc.txt`（导出歌词时尤其明显）。
    // 直接传完整文件名 + `getMimeTypeForFile` 里与之配套的 MIME，文件名才能原样落盘。
    const fileUri = await StorageAccessFramework.createFileAsync(
        directoryUri,
        fileName,
        getMimeTypeForFile(fileName),
    );
    await StorageAccessFramework.writeAsStringAsync(fileUri, content, {
        encoding: EncodingType.UTF8,
    });
    return fileUri;
}

export function removeJsonExtension(fileName: string) {
    return fileName.replace(/\.json$/i, "");
}

export async function saveJsonToSelectedAndroidDirectory(
    fileName: string,
    content: string,
) {
    const directoryUri = await requestAndroidDirectoryAccess(null);
    if (!directoryUri) {
        return null;
    }

    const fileUri = await StorageAccessFramework.createFileAsync(
        directoryUri,
        removeJsonExtension(fileName),
        JSON_MIME_TYPE,
    );
    await StorageAccessFramework.writeAsStringAsync(fileUri, content, {
        encoding: EncodingType.UTF8,
    });
    return fileUri;
}
