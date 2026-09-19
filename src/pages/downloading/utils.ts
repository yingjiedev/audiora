import { Linking } from "react-native";
import { DownloadFailReason } from "@/core/downloadTypes";
import type { IDownloadRecord } from "@/core/downloadHistory";
import { isAndroidSafUri } from "@/utils/androidSaf";
import type { ILanguageData } from "@/types/core/i18n";

/** t() 的结构化类型，避免 utils 反向依赖 i18n 实现 */
export type II18NFunc = (
    key: keyof ILanguageData,
    args?: Record<string, any>,
) => string;

/**
 * 与原生通知保持一致的体积格式化。
 * downloader 内部那份是私有的，页面这边复刻一份，避免为了一个函数把内部方法暴露出来。
 */
export function formatFileSize(bytes?: number): string {
    const value = typeof bytes === "number" && bytes > 0 ? bytes : 0;
    if (value <= 0) {
        return "0B";
    }
    if (value < 1024) {
        return `${value}B`;
    }
    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)}KB`;
    }
    if (value < 1024 * 1024 * 1024) {
        return `${(value / (1024 * 1024)).toFixed(1)}MB`;
    }
    return `${(value / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

/** 音质标签：320k → 320K，flac → FLAC */
export function formatQuality(quality?: IMusic.IQualityKey | string): string {
    return quality ? String(quality).toUpperCase() : "";
}

function pad(value: number) {
    return value < 10 ? `0${value}` : `${value}`;
}

function startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** 同一天显示 HH:mm，其余显示 MM-DD HH:mm */
export function formatRecordTime(timestamp: number): string {
    const date = new Date(timestamp);
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    const today = startOfDay(new Date());
    const target = startOfDay(date);
    const dayDiff = Math.round((today - target) / 86_400_000);

    if (dayDiff === 0) {
        return time;
    }
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}`;
}

export interface IDownloadRecordGroup {
    /** 分组标题：今天 / 昨天 / MM-DD */
    title: string;
    /** 用于分组清理的时间下界（含） */
    from: number;
    to: number;
    data: IDownloadRecord[];
}

/** 按完成时间倒序 + 按天分组（原型 B 的「已完成」分栏） */
export function groupRecordsByDate(
    records: IDownloadRecord[],
    t: II18NFunc,
): IDownloadRecordGroup[] {
    const sorted = [...records].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    if (sorted.length === 0) {
        return [];
    }

    const groups: IDownloadRecordGroup[] = [];
    for (const record of sorted) {
        const dayStart = startOfDay(new Date(record.updatedAt));
        const last = groups[groups.length - 1];
        if (last && last.from === dayStart) {
            last.data.push(record);
            continue;
        }
        groups.push({
            title: describeDay(dayStart, t),
            from: dayStart,
            to: dayStart + 86_400_000,
            data: [record],
        });
    }
    return groups;
}

function describeDay(dayStart: number, t: II18NFunc): string {
    const today = startOfDay(new Date());
    const dayDiff = Math.round((today - dayStart) / 86_400_000);
    if (dayDiff === 0) {
        return t("downloading.section.today");
    }
    if (dayDiff === 1) {
        return t("downloading.section.yesterday");
    }
    const date = new Date(dayStart);
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * 失败原因 → 文案。
 * issue #87 之前只映射了 2 种，network-offline / cellular 两条都会落到「未知错误」。
 */
export function getFailReasonLabel(reason?: DownloadFailReason, t?: II18NFunc): string {
    const fallback = t?.("downloading.downloadFailReason.unknown") ?? "";
    if (!t) {
        return fallback;
    }
    switch (reason) {
    case DownloadFailReason.NetworkOffline:
        return t("downloading.downloadFailReason.networkOffline");
    case DownloadFailReason.NotAllowToDownloadInCellular:
        return t("downloading.downloadFailReason.notAllowToDownloadInCellular");
    case DownloadFailReason.NoWritePermission:
        return t("downloading.downloadFailReason.noWritePermission");
    case DownloadFailReason.FailToFetchSource:
        return t("downloading.downloadFailReason.failToFetchSource");
    default:
        return t("downloading.downloadFailReason.unknown");
    }
}

/** 失败原因对应的图标，让「网络问题」和「设置问题」一眼可分 */
export function getFailReasonIcon(reason?: DownloadFailReason): "link-slash" | "shield-keyhole-outline" | "exclamation-circle" {
    switch (reason) {
    case DownloadFailReason.NetworkOffline:
        return "link-slash";
    case DownloadFailReason.NotAllowToDownloadInCellular:
    case DownloadFailReason.NoWritePermission:
        return "shield-keyhole-outline";
    default:
        return "exclamation-circle";
    }
}

/**
 * 打开所在目录。
 *
 * Android 上保存位置可能是 SAF 授权目录（content://），也可能是普通文件路径，
 * 系统没有统一的「在文件管理器中显示」接口，这里尽力而为：
 * 能唤起就唤起，唤不起就让调用方提示不支持。
 */
export async function openDownloadFolder(filePath?: string | null): Promise<boolean> {
    if (!filePath) {
        return false;
    }
    try {
        if (isAndroidSafUri(filePath)) {
            await Linking.openURL(filePath);
            return true;
        }
        const directory = filePath.slice(0, Math.max(filePath.lastIndexOf("/"), 0));
        const target = directory.startsWith("file://") ? directory : `file://${directory}`;
        await Linking.openURL(target);
        return true;
    } catch {
        return false;
    }
}
