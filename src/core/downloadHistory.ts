/**
 * 下载历史记录（终态任务持久化）
 *
 * issue #87：`downloadTasks` / `downloadQueueAtom` 都是内存态，任务一进入终态就被
 * `cleanupTaskStateByKey()` 清掉，重启后「已完成」「失败」全部消失，原生侧也同步
 * 删掉了终态记录。
 *
 * 这里用独立 MMKV 落盘终态记录，生命周期与下载队列解耦：
 *   终态写入 → 队列清理 → 记录保留（直到用户主动清除，或超出条数上限被淘汰）
 *
 * 记录与 `mediaExtra.downloaded` / `LocalMusicSheet` 是对账关系而非替代关系：
 * 文件本体归本地歌单管，这里只留「下载过什么、什么时候、多大、成功还是失败」。
 */
import { atom, getDefaultStore, useAtomValue } from "jotai";
import { exists } from "react-native-fs";
import { removeFileScheme } from "@/utils/fileUtils";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { safeParse, safeStringify } from "@/utils/jsonUtil";
import { getLocalPath, getMediaUniqueKey } from "@/utils/mediaUtils";
import { androidSafUriExists, isAndroidSafUri } from "@/utils/androidSaf";
import { DownloadFailReason } from "./downloadTypes";

/** 终态记录的两种结果 */
export const DownloadRecordStatus = {
    Completed: "completed",
    Error: "error",
} as const;

export type IDownloadRecordStatus =
    (typeof DownloadRecordStatus)[keyof typeof DownloadRecordStatus];

export interface IDownloadRecord {
    /** 媒体唯一键 `${platform}@${id}` */
    mediaKey: string;
    /** 冗余快照字段：插件被卸载后仍要能显示标题/封面 */
    platform: string;
    id: string;
    title: string;
    artist?: string;
    artwork?: string;
    /** 完整 musicItem 快照，用于「重新下载 / 立即播放」 */
    musicItem: IMusic.IMusicItem;
    quality?: IMusic.IQualityKey;
    filename?: string;
    /** 字节 */
    fileSize?: number;
    status: IDownloadRecordStatus;
    errorReason?: DownloadFailReason;
    /** 完成 / 失败时间戳 */
    updatedAt: number;
    /** 对账结果：记录仍在，但本地文件已被外部删除 */
    fileMissing?: boolean;
}

/**
 * 记录条数上限（issue #87 要求「不能无限增长」）。
 * 超出后按 updatedAt 淘汰最旧的——只淘汰记录，**不动文件**。
 */
export const MAX_DOWNLOAD_RECORDS = 500;

const STORE_KEY = "records";

const downloadHistoryAtom = atom<IDownloadRecord[]>([]);
const downloadHistoryStore = getOrCreateMMKV("download.DownloadHistory");

/** 按时间倒序（新的在前），并裁到条数上限 */
function normalizeRecords(records: IDownloadRecord[]): IDownloadRecord[] {
    return [...records]
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
        .slice(0, MAX_DOWNLOAD_RECORDS);
}

function commit(records: IDownloadRecord[]) {
    const next = normalizeRecords(records);
    downloadHistoryStore.set(STORE_KEY, safeStringify(next));
    getDefaultStore().set(downloadHistoryAtom, next);
    return next;
}

function readRecords(): IDownloadRecord[] {
    const raw = downloadHistoryStore.getString(STORE_KEY);
    if (!raw) {
        return [];
    }
    const parsed = safeParse<IDownloadRecord[]>(raw);
    if (!Array.isArray(parsed)) {
        return [];
    }
    // 过滤掉历史脏数据：没有 mediaKey 的记录无法再对账
    return parsed.filter(
        (item): item is IDownloadRecord =>
            !!item && typeof item.mediaKey === "string" && !!item.status,
    );
}

/** 判断本地路径是否真的还在（SAF 授权目录走原生查询） */
async function pathExists(filePath?: string | null): Promise<boolean> {
    if (!filePath) {
        return false;
    }
    try {
        if (isAndroidSafUri(filePath)) {
            return await androidSafUriExists(filePath);
        }
        return await exists(removeFileScheme(filePath));
    } catch {
        return false;
    }
}

function resolveLocalPath(record: IDownloadRecord): string | null {
    // getLocalPath 已经覆盖了 musicItem[internalSerializeKey].localPath 与 mediaExtra
    return getLocalPath(record.musicItem) ?? null;
}

class DownloadHistory {
    get records(): IDownloadRecord[] {
        return getDefaultStore().get(downloadHistoryAtom);
    }

    /** MMKV 是同步的，直接在模块初始化时读出来，避免进页面第一帧是空的 */
    setup() {
        getDefaultStore().set(downloadHistoryAtom, normalizeRecords(readRecords()));
    }

    getRecord(mediaKey: string): IDownloadRecord | undefined {
        return this.records.find(item => item.mediaKey === mediaKey);
    }

    /**
     * 写入 / 更新一条终态记录。
     * 同一首歌重复下载时覆盖旧记录（key 相同），并刷新 updatedAt。
     */
    upsertRecord(record: Omit<IDownloadRecord, "mediaKey" | "updatedAt"> & {
        updatedAt?: number;
    }) {
        const mediaKey = getMediaUniqueKey(record.musicItem);
        const draft: IDownloadRecord = {
            ...record,
            mediaKey,
            updatedAt: record.updatedAt ?? Date.now(),
        };
        const rest = this.records.filter(item => item.mediaKey !== mediaKey);
        commit([draft, ...rest]);
        return draft;
    }

    /** 精简入口：从 musicItem + 任务信息直接落一条完成记录 */
    recordCompleted(
        musicItem: IMusic.IMusicItem,
        extra: {
            quality?: IMusic.IQualityKey;
            filename?: string;
            fileSize?: number;
            /** 允许调用方回填真实完成时间，缺省取当前时间 */
            updatedAt?: number;
        } = {},
    ) {
        return this.upsertRecord({
            platform: musicItem.platform,
            id: musicItem.id,
            title: musicItem.title,
            artist: musicItem.artist,
            artwork: typeof musicItem.artwork === "string" ? musicItem.artwork : undefined,
            musicItem,
            quality: extra.quality,
            filename: extra.filename,
            fileSize: extra.fileSize,
            status: DownloadRecordStatus.Completed,
            fileMissing: false,
            updatedAt: extra.updatedAt,
        });
    }

    /** 精简入口：落一条失败记录 */
    recordError(
        musicItem: IMusic.IMusicItem,
        extra: {
            errorReason?: DownloadFailReason;
            quality?: IMusic.IQualityKey;
            filename?: string;
            fileSize?: number;
            /** 允许调用方回填真实失败时间，缺省取当前时间 */
            updatedAt?: number;
        } = {},
    ) {
        return this.upsertRecord({
            platform: musicItem.platform,
            id: musicItem.id,
            title: musicItem.title,
            artist: musicItem.artist,
            artwork: typeof musicItem.artwork === "string" ? musicItem.artwork : undefined,
            musicItem,
            quality: extra.quality,
            filename: extra.filename,
            fileSize: extra.fileSize,
            status: DownloadRecordStatus.Error,
            errorReason: extra.errorReason,
            fileMissing: false,
            updatedAt: extra.updatedAt,
        });
    }

    /** 移除单条记录（只删记录，不碰文件） */
    removeRecord(mediaKey: string): boolean {
        const rest = this.records.filter(item => item.mediaKey !== mediaKey);
        if (rest.length === this.records.length) {
            return false;
        }
        commit(rest);
        return true;
    }

    removeRecords(mediaKeys: string[]): number {
        if (!mediaKeys.length) {
            return 0;
        }
        const target = new Set(mediaKeys);
        const rest = this.records.filter(item => !target.has(item.mediaKey));
        const removed = this.records.length - rest.length;
        if (removed > 0) {
            commit(rest);
        }
        return removed;
    }

    /** 清除已完成记录（不动文件） */
    clearCompleted(): number {
        const rest = this.records.filter(
            item => item.status !== DownloadRecordStatus.Completed,
        );
        const removed = this.records.length - rest.length;
        if (removed > 0) {
            commit(rest);
        }
        return removed;
    }

    /** 清除失败记录 */
    clearError(): number {
        const rest = this.records.filter(
            item => item.status !== DownloadRecordStatus.Error,
        );
        const removed = this.records.length - rest.length;
        if (removed > 0) {
            commit(rest);
        }
        return removed;
    }

    clearAll() {
        commit([]);
    }

    /** 已完成任务占用的总字节（不含已判定为文件缺失的） */
    getCompletedTotalSize(): number {
        return this.records.reduce((sum, item) => {
            if (item.status !== DownloadRecordStatus.Completed) {
                return sum;
            }
            if (item.fileMissing) {
                return sum;
            }
            return sum + (item.fileSize ?? 0);
        }, 0);
    }

    /**
     * 与本地文件对账：文件被外部删除的完成记录标记为 `fileMissing`。
     * 返回本次新判定为缺失的条数。
     */
    async reconcileCompletedFiles(): Promise<number> {
        const records = this.records;
        const completed = records.filter(
            item => item.status === DownloadRecordStatus.Completed,
        );
        if (completed.length === 0) {
            return 0;
        }

        const results = await Promise.all(
            completed.map(async item => ({
                mediaKey: item.mediaKey,
                exists: await pathExists(resolveLocalPath(item)),
            })),
        );

        const missingKeys = new Set(
            results.filter(item => !item.exists).map(item => item.mediaKey),
        );

        let changed = 0;
        const next = records.map(item => {
            if (item.status !== DownloadRecordStatus.Completed) {
                return item;
            }
            const fileMissing = missingKeys.has(item.mediaKey);
            if (item.fileMissing === fileMissing) {
                return item;
            }
            changed++;
            return { ...item, fileMissing };
        });

        if (changed > 0) {
            // 对账只改标记，不重新排序——否则用户正在浏览的列表会突然跳动
            downloadHistoryStore.set(STORE_KEY, safeStringify(next));
            getDefaultStore().set(downloadHistoryAtom, next);
        }
        return changed;
    }
}

const downloadHistory = new DownloadHistory();

// MMKV 是同步的，模块加载即恢复，页面首帧就有数据（重启后仍可见）
downloadHistory.setup();

export default downloadHistory;

export function useDownloadHistory() {
    return useAtomValue(downloadHistoryAtom);
}

/** 测试用：重置到空状态 */
export function __resetForTest() {
    downloadHistoryStore.remove(STORE_KEY);
    getDefaultStore().set(downloadHistoryAtom, []);
}
