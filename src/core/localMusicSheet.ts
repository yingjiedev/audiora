import {
    StorageKeys,
    internalSerializeKey,
} from "@/constants/commonConst";
import pathConst from "@/constants/pathConst";
import mp3Util from "@/native/mp3Util";
import {
    getFileName,
    removeFileScheme,
} from "@/utils/fileUtils.ts";
import {
    getLocalPath,
    isSameMediaItem,
} from "@/utils/mediaUtils";
import StateMapper from "@/utils/stateMapper";
import { getStorage, setStorage } from "@/utils/storage";
import { normalizeAudioMeta } from "@/utils/localQuality";
import CryptoJs from "crypto-js";
import { nanoid } from "@/utils/nanoid";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { exists, unlink } from "react-native-fs";
import { scanLocalMediaPaths } from "./localMusicScanner";
import { shouldRetainUnavailableLocalPath } from "./localMusicPathPolicy";
import {
    androidSafUriExists,
    deleteAndroidSafUri,
    isAndroidSafUri,
} from "@/utils/androidSaf";
import {
    deleteCompanionFiles,
    linkCompanionFiles,
    resolveCompanionArtwork,
} from "@/utils/mediaCompanion";
import { getMediaExtraProperty } from "@/utils/mediaExtra";

let localSheet: IMusic.IMusicItem[] = [];
const localSheetStateMapper = new StateMapper(() => localSheet);

const iosDocumentsMarker = "/Documents/";
const artworkHydrateGroupNum = 8;
let artworkHydrateToken = 0;

function getLocalPathCandidates(localPath: string) {
    const rawPath = removeFileScheme(localPath);
    const candidates = [rawPath];

    if (Platform.OS === "ios") {
        const documentIndex = rawPath.indexOf(iosDocumentsMarker);
        if (documentIndex !== -1) {
            const relativePath = rawPath.slice(
                documentIndex + iosDocumentsMarker.length,
            );
            candidates.push(`${pathConst.basePath}/${relativePath}`);
        }
    }

    return [...new Set(candidates)];
}

async function getExistingLocalPath(localPath: string) {
    if (isAndroidSafUri(localPath)) {
        return await androidSafUriExists(localPath) ? localPath : null;
    }
    const candidates = getLocalPathCandidates(localPath);
    for (let candidate of candidates) {
        if (await exists(candidate)) {
            return candidate;
        }
    }
    return null;
}

function isFileNotFoundError(error: any) {
    const message = `${error?.message ?? error}`.toLowerCase();
    return (
        message.includes("enoent") ||
        message.includes("no such file or directory") ||
        message.includes("file does not exist")
    );
}

function hasArtwork(musicItem: IMusic.IMusicItem) {
    return (
        typeof musicItem.artwork === "string" &&
        musicItem.artwork.trim().length > 0
    );
}

async function hydrateLocalArtwork(musicItems: IMusic.IMusicItem[] = localSheet) {
    const token = ++artworkHydrateToken;
    const candidates = musicItems.filter(
        musicItem => !hasArtwork(musicItem) && !!getLocalPath(musicItem),
    );

    for (let i = 0; i < candidates.length; i += artworkHydrateGroupNum) {
        if (token !== artworkHydrateToken) {
            return;
        }

        const group = candidates.slice(i, i + artworkHydrateGroupNum);
        const hydratedGroup = await Promise.all(
            group.map(async musicItem => {
                const localPath = getLocalPath(musicItem);
                if (!localPath) {
                    return null;
                }

                try {
                    // 与 localFilePlugin.getMusicInfo 同一优先级：同目录封面文件 > 记录路径 > 内嵌 tag
                    const companionArtwork = await resolveCompanionArtwork(
                        localPath,
                        musicItem,
                    );
                    const artwork =
                        companionArtwork ??
                        (await mp3Util.getMediaCoverImg(removeFileScheme(localPath)));
                    return typeof artwork === "string" && artwork.trim()
                        ? { musicItem, artwork }
                        : null;
                } catch {
                    return null;
                }
            }),
        );

        if (token !== artworkHydrateToken) {
            return;
        }

        let nextSheet = localSheet;
        let hasChanged = false;
        hydratedGroup.forEach(hydrated => {
            if (!hydrated) {
                return;
            }
            const targetIndex = nextSheet.findIndex(musicItem =>
                isSameMediaItem(musicItem, hydrated.musicItem),
            );
            if (targetIndex === -1 || hasArtwork(nextSheet[targetIndex])) {
                return;
            }
            if (!hasChanged) {
                nextSheet = [...localSheet];
                hasChanged = true;
            }
            nextSheet[targetIndex] = {
                ...nextSheet[targetIndex],
                artwork: hydrated.artwork,
            };
        });

        if (hasChanged) {
            localSheet = nextSheet;
            localSheetStateMapper.notify();
            await saveLocalSheet();
        }
    }
}

export async function setup() {
    const sheet = await getStorage(StorageKeys.LocalMusicSheet);
    if (sheet) {
        let validSheet: IMusic.IMusicItem[] = [];
        let hasChanged = false;
        for (let musicItem of sheet) {
            const localPath = getLocalPath(musicItem);
            if (localPath) {
                const existingPath = await getExistingLocalPath(localPath);
                if (existingPath) {
                    hasChanged = hasChanged || existingPath !== removeFileScheme(localPath);
                    validSheet.push({
                        ...musicItem,
                        [internalSerializeKey]: {
                            ...(musicItem[internalSerializeKey] ?? {}),
                            localPath: existingPath,
                        },
                    });
                } else if (shouldRetainUnavailableLocalPath(localPath)) {
                    // Android may no longer be allowed to stat legacy public paths
                    // after broad storage access is removed. Preserve the library
                    // record until the user explicitly re-authorizes or removes it.
                    validSheet.push(musicItem);
                } else {
                    hasChanged = true;
                }
            } else {
                hasChanged = true;
            }
        }
        if (hasChanged) {
            await setStorage(StorageKeys.LocalMusicSheet, validSheet);
        }
        localSheet = validSheet;
    } else {
        await setStorage(StorageKeys.LocalMusicSheet, []);
    }
    localSheetStateMapper.notify();
}

export async function addMusic(
    musicItem: IMusic.IMusicItem | IMusic.IMusicItem[],
) {
    if (!Array.isArray(musicItem)) {
        musicItem = [musicItem];
    }
    let newSheet = [...localSheet];
    musicItem.forEach(mi => {
        const existingIndex = newSheet.findIndex(_ => isSameMediaItem(mi, _));
        if (existingIndex === -1) {
            newSheet.push(mi);
        } else {
            newSheet[existingIndex] = {
                ...newSheet[existingIndex],
                ...mi,
                [internalSerializeKey]: {
                    ...(newSheet[existingIndex][internalSerializeKey] ?? {}),
                    ...(mi[internalSerializeKey] ?? {}),
                },
            };
        }
    });
    await setStorage(StorageKeys.LocalMusicSheet, newSheet);
    localSheet = newSheet;
    localSheetStateMapper.notify();
    void hydrateLocalArtwork(musicItem);
}

function addMusicDraft(musicItem: IMusic.IMusicItem | IMusic.IMusicItem[]) {
    if (!Array.isArray(musicItem)) {
        musicItem = [musicItem];
    }
    let newSheet = [...localSheet];
    musicItem.forEach(mi => {
        if (localSheet.findIndex(_ => isSameMediaItem(mi, _)) === -1) {
            newSheet.push(mi);
        }
    });
    localSheet = newSheet;
    localSheetStateMapper.notify();
}

async function saveLocalSheet() {
    await setStorage(StorageKeys.LocalMusicSheet, localSheet);
}

/**
 * 封面路径是否被除 exclude 之外的本地曲目引用。
 * 固定名封面天然是多首歌共享的，删除其中一首时不能连文件一起删（issue #63 review）。
 */
function isCoverPathUsedByOtherTrack(
    coverPath: string,
    exclude: ICommon.IMediaBase,
) {
    if (!coverPath) {
        return false;
    }
    const target = removeFileScheme(coverPath);
    return localSheet.some(item => {
        if (isSameMediaItem(item, exclude)) {
            return false;
        }
        const itemCover = getMediaExtraProperty(item, "localCoverPath");
        return (
            typeof itemCover === "string" &&
            !!itemCover &&
            removeFileScheme(itemCover) === target
        );
    });
}

export async function removeMusic(
    musicItem: IMusic.IMusicItem,
    deleteOriginalFile = false,
) {
    const idx = localSheet.findIndex(_ => isSameMediaItem(_, musicItem));
    let newSheet = [...localSheet];
    if (idx !== -1) {
        const localMusicItem = localSheet[idx];
        newSheet.splice(idx, 1);
        const localPath =
            getLocalPath(localMusicItem) ??
            getLocalPath(musicItem);
        if (deleteOriginalFile && localPath) {
            try {
                if (isAndroidSafUri(localPath)) {
                    await deleteAndroidSafUri(localPath);
                } else {
                    const existingPath = await getExistingLocalPath(localPath);
                    if (existingPath) {
                        await unlink(existingPath);
                    }
                }
            } catch (e: any) {
                if (!isFileNotFoundError(e)) {
                    throw e;
                }
            }
            // 音频删除成功后一并清理随下载生成的歌词 / 封面
            await deleteCompanionFiles(localMusicItem, {
                isCoverReferencedByOther: coverPath =>
                    isCoverPathUsedByOtherTrack(coverPath, localMusicItem),
            });
        }
    }
    localSheet = newSheet;
    localSheetStateMapper.notify();
    saveLocalSheet();
}

function parseFilename(fn: string): Partial<IMusic.IMusicItem> | null {
    const data = fn.slice(0, fn.lastIndexOf(".")).split("@");
    const [platform, id, title, artist] = data;
    if (!platform || !id) {
        return null;
    }
    return {
        id,
        platform: platform,
        title: title ?? "",
        artist: artist ?? "",
    };
}

let importToken: string | null = null;
// 获取本地的文件列表（音频 + 同目录的歌词 / 封面）
async function getMusicStats(folderPaths: string[]) {
    const _importToken = nanoid();
    importToken = _importToken;
    const scannedFiles = await scanLocalMediaPaths(
        folderPaths,
        () => importToken === _importToken,
    );

    return { ...scannedFiles, token: _importToken };
}

function cancelImportLocal() {
    importToken = null;
}

// 导入本地音乐
const groupNum = 25;
async function importLocal(_folderPaths: string[]) {
    const folderPaths = [..._folderPaths.map(it => removeFileScheme(it))];
    const { audioFiles, companionFiles, token } = await getMusicStats(folderPaths);
    if (token !== importToken) {
        throw new Error("Import Broken");
    }
    // 分组请求，不然序列化可能出问题
    let metas: any[] = [];
    const groups = Math.ceil(audioFiles.length / groupNum);
    for (let i = 0; i < groups; ++i) {
        metas = metas.concat(
            await mp3Util.getMediaMeta(
                audioFiles
                    .slice(i * groupNum, (i + 1) * groupNum)
                    .map(file => file.path),
            ),
        );
    }
    if (token !== importToken) {
        throw new Error("Import Broken");
    }
    const musicItems: IMusic.IMusicItem[] = await Promise.all(
        audioFiles.map(async (musicFile, index) => {
            const musicPath = musicFile.path;
            let { platform, id, title, artist } =
                parseFilename(getFileName(musicFile.name, true)) ?? {};
            const meta = metas[index];
            if (!platform || !id) {
                platform = "本地";
                id = CryptoJs.MD5(
                    musicFile.legacyPath ?? musicPath,
                ).toString(CryptoJs.enc.Hex);
            }
            return {
                id,
                platform,
                title: title ?? meta?.title ?? getFileName(musicFile.name),
                artist: artist ?? meta?.artist ?? "未知歌手",
                duration: parseInt(meta?.duration ?? "0", 10) / 1000,
                album: meta?.album ?? "未知专辑",
                artwork: "",
                [internalSerializeKey]: {
                    localPath: musicPath,
                    audioMeta: normalizeAudioMeta(meta),
                },
            } as IMusic.IMusicItem;
        }),
    );
    if (token !== importToken) {
        throw new Error("Import Broken");
    }
    // 导入是一次完整重建：扫描到的歌词 / 封面要写回 mediaExtra，
    // 否则重装后这些文件会变成无人认领的孤儿（删除曲目时也不会被清理）
    linkCompanionFiles(audioFiles, musicItems, companionFiles);
    await addMusic(musicItems);
}

/** 是否为本地音乐 */
function isLocalMusic(
    musicItem: ICommon.IMediaBase | null,
): IMusic.IMusicItem | undefined {
    return musicItem
        ? localSheet.find(_ => isSameMediaItem(_, musicItem))
        : undefined;
}

/** 状态-是否为本地音乐 */
function useIsLocal(musicItem: IMusic.IMusicItem | null) {
    const localMusicState = localSheetStateMapper.useMappedState();
    const [isLocal, setIsLocal] = useState<boolean>(!!isLocalMusic(musicItem));
    useEffect(() => {
        if (!musicItem) {
            setIsLocal(false);
        } else {
            setIsLocal(!!isLocalMusic(musicItem));
        }
    }, [localMusicState, musicItem]);
    return isLocal;
}

function getMusicList() {
    return localSheet;
}

async function updateMusicList(newSheet: IMusic.IMusicItem[]) {
    const _localSheet = [...newSheet];
    try {
        await setStorage(StorageKeys.LocalMusicSheet, _localSheet);
        localSheet = _localSheet;
        localSheetStateMapper.notify();
        void hydrateLocalArtwork(_localSheet);
    } catch {}
}

const LocalMusicSheet = {
    setup,
    addMusic,
    removeMusic,
    addMusicDraft,
    saveLocalSheet,
    importLocal,
    cancelImportLocal,
    isLocalMusic,
    useIsLocal,
    getMusicList,
    isCoverPathUsedByOtherTrack,
    hydrateArtwork: hydrateLocalArtwork,
    useMusicList: localSheetStateMapper.useMappedState,
    updateMusicList,
};

export default LocalMusicSheet;
