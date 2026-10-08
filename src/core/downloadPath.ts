import { Platform } from "react-native";

import { getDownloadMusicPath } from "@/constants/pathConst";
import Config from "@/core/appConfig";
import Toast from "@/utils/toast";
import {
    isAndroidSafUri,
    requestAndroidDirectoryAccess,
} from "@/utils/androidSaf";

/**
 * `basic.downloadPath` 的唯一写入口。
 *
 * 背景见 issue #96：这个键原本有三处写入——设置页改目录、歌词面板下载歌词文件时
 * 顺手写、下载器首次下载时写，三份逻辑对「已授权就复用 / 没授权才弹目录选择器」
 * 的判断并不一致，用户在别页面的操作会静默改写设置页里的选择。
 *
 * 现在只有本文件的 `persist()` 会写这个键，其它地方一律通过下面的函数取目录。
 */

// 一次只弹一次目录选择器：下载器并发触发下载时不会连弹好几层系统弹窗
let pendingRequest: Promise<string | null> | null = null;

function getConfiguredDownloadPath() {
    return Config.getConfig("basic.downloadPath");
}

/**
 * 当前生效的下载目录（已含默认回落）。
 * iOS / 桌面端返回普通路径，Android 返回 SAF content:// URI。
 */
function getDownloadPath() {
    return getDownloadMusicPath(getConfiguredDownloadPath());
}

function persist(directoryUri: string) {
    Config.setConfig("basic.downloadPath", directoryUri);
    return directoryUri;
}

/** 是否有已经授权过的下载目录 */
function hasConfiguredDownloadPath() {
    return isAndroidSafUri(getConfiguredDownloadPath());
}

/**
 * 弹出目录选择器让用户重新选目录，并写回配置。
 * 设置页「下载目录」这一行走这里。
 */
async function chooseDownloadDirectory(): Promise<string | null> {
    try {
        const configured = getConfiguredDownloadPath();
        const directoryUri = await requestAndroidDirectoryAccess(
            isAndroidSafUri(configured) ? configured : null,
        );
        return directoryUri ? persist(directoryUri) : null;
    } catch (error) {
        Toast.warn(
            error instanceof Error ? error.message : String(error),
        );
        return null;
    }
}

/**
 * 保证拿到一个可用的下载目录：已授权就复用，没有才引导用户选一次。
 * 下载器、歌词下载这类「顺手要用目录」的场景走这里，不许自己再写配置。
 */
async function ensureDownloadDirectory(): Promise<string | null> {
    if (Platform.OS !== "android") {
        return getDownloadPath();
    }

    if (hasConfiguredDownloadPath()) {
        return getConfiguredDownloadPath() as string;
    }

    if (!pendingRequest) {
        pendingRequest = chooseDownloadDirectory().finally(() => {
            pendingRequest = null;
        });
    }

    return pendingRequest;
}

const DownloadPath = {
    get: getConfiguredDownloadPath,
    resolve: getDownloadPath,
    isConfigured: hasConfiguredDownloadPath,
    choose: chooseDownloadDirectory,
    ensure: ensureDownloadDirectory,
};

export default DownloadPath;
