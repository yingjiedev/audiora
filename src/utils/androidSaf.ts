import {
    EncodingType,
    StorageAccessFramework,
} from "expo-file-system/legacy";
import NativeUtils from "@/native/utils";

const JSON_MIME_TYPE = "application/json";
const DEFAULT_MUSIC_DIRECTORY = "Music/Audiora";

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
    case "lrc":
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
    const extension = fileName.split(".").pop();
    const baseName = extension
        ? fileName.slice(0, -(extension.length + 1))
        : fileName;
    const fileUri = await StorageAccessFramework.createFileAsync(
        directoryUri,
        baseName,
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
