import { exists, unlink } from "react-native-fs";
import downloadHistory, {
    DownloadRecordStatus,
    MAX_DOWNLOAD_RECORDS,
    __resetForTest,
} from "@/core/downloadHistory";
import { getMediaExtraProperty } from "@/utils/mediaExtra";
import { androidSafUriExists, isAndroidSafUri } from "@/utils/androidSaf";
import { getFailReasonLabel, groupRecordsByDate } from "@/pages/downloading/utils";
import { DownloadFailReason } from "@/core/downloadTypes";

jest.mock("@/utils/mediaExtra", () => ({
    getMediaExtraProperty: jest.fn(),
}));

/**
 * 真实的 `@/utils/mediaUtils` 会经 `@/constants/commonConst` 拉进 reanimated 等原生模块，
 * 在 Jest 里直接炸 `Cannot use import statement outside a module`。
 * 这里只复刻被测逻辑用到的那两个函数（语义与真实实现保持一致）。
 */
jest.mock("@/utils/mediaUtils", () => ({
    getMediaUniqueKey: (mediaItem: any) => `${mediaItem.platform}@${mediaItem.id}`,
    getLocalPath: (mediaItem: any) => {
        if (!mediaItem) {
            return null;
        }
        if (
            typeof mediaItem.url === "string" &&
            (mediaItem.url.startsWith("file://") || mediaItem.url.startsWith("content://"))
        ) {
            return mediaItem.url;
        }
        const mediaExtra = require("@/utils/mediaExtra");
        return mediaExtra.getMediaExtraProperty(mediaItem, "localPath") ?? null;
    },
}));

jest.mock("@/utils/androidSaf", () => ({
    isAndroidSafUri: jest.fn((uri?: string | null) =>
        typeof uri === "string" && uri.startsWith("content://"),
    ),
    androidSafUriExists: jest.fn(async () => true),
}));

const mockedExists = exists as unknown as jest.Mock;
const mockedUnlink = unlink as unknown as jest.Mock;
const mockedGetExtra = getMediaExtraProperty as unknown as jest.Mock;
const mockedSafExists = androidSafUriExists as unknown as jest.Mock;
const mockedIsSaf = isAndroidSafUri as unknown as jest.Mock;

/** 造一条 musicItem，platform+id 决定 mediaKey */
function makeMusic(id: string, platform = "test") {
    return {
        id,
        platform,
        title: `歌曲-${id}`,
        artist: "测试歌手",
    } as unknown as IMusic.IMusicItem;
}

/** 固定的 t()：直接返回 key，便于断言「走到了哪条文案」 */
const t = ((key: string) => key) as any;

describe("downloadHistory 终态记录持久化", () => {
    beforeEach(() => {
        __resetForTest();
        mockedExists.mockReset();
        mockedSafExists.mockReset();
        mockedUnlink.mockClear();
        mockedGetExtra.mockReset();
        mockedIsSaf.mockImplementation(
            (uri?: string | null) => typeof uri === "string" && uri.startsWith("content://"),
        );
    });

    it("写入完成记录后可读回，且带齐落盘字段", () => {
        const musicItem = makeMusic("1");
        downloadHistory.recordCompleted(musicItem, {
            quality: "flac",
            filename: "歌曲-1",
            fileSize: 1024 * 1024,
        });

        const records = downloadHistory.records;
        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({
            mediaKey: "test@1",
            platform: "test",
            id: "1",
            title: "歌曲-1",
            quality: "flac",
            filename: "歌曲-1",
            fileSize: 1024 * 1024,
            status: DownloadRecordStatus.Completed,
        });
        expect(typeof records[0].updatedAt).toBe("number");
        // 快照要能支撑「重新下载」，不能只存标题
        expect(records[0].musicItem.id).toBe("1");
    });

    it("写入失败记录时保留失败原因", () => {
        downloadHistory.recordError(makeMusic("2"), {
            errorReason: DownloadFailReason.NetworkOffline,
        });
        expect(downloadHistory.records[0].errorReason).toBe(
            DownloadFailReason.NetworkOffline,
        );
    });

    it("同一首歌重复写入只保留一条，且刷新到最新时间", () => {
        downloadHistory.recordError(makeMusic("3"), {
            errorReason: DownloadFailReason.NetworkOffline,
        });
        const first = downloadHistory.records[0].updatedAt;
        downloadHistory.recordCompleted(makeMusic("3"), { fileSize: 10 });

        const records = downloadHistory.records;
        expect(records).toHaveLength(1);
        expect(records[0].status).toBe(DownloadRecordStatus.Completed);
        expect(records[0].updatedAt).toBeGreaterThanOrEqual(first);
    });

    it("按时间倒序排列", () => {
        downloadHistory.recordCompleted(makeMusic("a"), { updatedAt: 1000 } as any);
        downloadHistory.recordCompleted(makeMusic("b"), { updatedAt: 3000 } as any);
        downloadHistory.recordCompleted(makeMusic("c"), { updatedAt: 2000 } as any);

        expect(downloadHistory.records.map(item => item.mediaKey)).toEqual([
            "test@b",
            "test@c",
            "test@a",
        ]);
    });

    it("超出条数上限时淘汰最旧的记录", () => {
        for (let i = 0; i < MAX_DOWNLOAD_RECORDS + 20; i++) {
            downloadHistory.recordCompleted(makeMusic(`m${i}`), { updatedAt: 1000 + i } as any);
        }

        const records = downloadHistory.records;
        expect(records).toHaveLength(MAX_DOWNLOAD_RECORDS);
        // 最新的一定在，最旧的一定没了
        expect(records[0].mediaKey).toBe(`test@m${MAX_DOWNLOAD_RECORDS + 19}`);
        expect(records.some(item => item.mediaKey === "test@m0")).toBe(false);
    });

    it("移除记录只动记录，不碰文件", () => {
        downloadHistory.recordCompleted(makeMusic("4"));
        expect(downloadHistory.removeRecord("test@4")).toBe(true);
        expect(downloadHistory.records).toHaveLength(0);
        // 关键语义：「移除记录」绝不能产生任何文件删除动作
        expect(mockedUnlink).not.toHaveBeenCalled();
    });

    it("clearCompleted 只清已完成，clearError 只清失败", () => {
        downloadHistory.recordCompleted(makeMusic("c1"));
        downloadHistory.recordCompleted(makeMusic("c2"));
        downloadHistory.recordError(makeMusic("e1"));

        expect(downloadHistory.clearCompleted()).toBe(2);
        expect(downloadHistory.records.map(item => item.mediaKey)).toEqual(["test@e1"]);

        expect(downloadHistory.clearError()).toBe(1);
        expect(downloadHistory.records).toHaveLength(0);
    });

    it("占用空间只统计完成且文件仍在的记录", async () => {
        downloadHistory.recordCompleted(makeMusic("s1"), { fileSize: 100 });
        downloadHistory.recordCompleted(makeMusic("s2"), { fileSize: 200 });
        downloadHistory.recordError(makeMusic("s3"), { fileSize: 999 });

        // 失败记录不计入占用
        expect(downloadHistory.getCompletedTotalSize()).toBe(300);

        // 只有 s1 的文件还在，s2 被判为缺失 → 不再计入占用
        mockedGetExtra.mockImplementation((item: any, key: string) =>
            key === "localPath" && item.id === "s1" ? "/tmp/music/s1.flac" : null,
        );
        mockedExists.mockResolvedValue(true);
        await downloadHistory.reconcileCompletedFiles();

        expect(downloadHistory.getRecord("test@s2")?.fileMissing).toBe(true);
        expect(downloadHistory.getCompletedTotalSize()).toBe(100);
    });

    it("对账：本地文件被外部删除时标记为 fileMissing", async () => {
        mockedGetExtra.mockImplementation((_item: any, key: string) =>
            key === "localPath" ? "/tmp/music/歌曲-5.flac" : null,
        );
        downloadHistory.recordCompleted(makeMusic("5"), { fileSize: 123 });

        mockedExists.mockResolvedValue(false);
        const changed = await downloadHistory.reconcileCompletedFiles();

        expect(changed).toBe(1);
        expect(downloadHistory.getRecord("test@5")?.fileMissing).toBe(true);
        // 缺失后不再计入占用空间
        expect(downloadHistory.getCompletedTotalSize()).toBe(0);

        // 文件回来后能自动恢复
        mockedExists.mockResolvedValue(true);
        await downloadHistory.reconcileCompletedFiles();
        expect(downloadHistory.getRecord("test@5")?.fileMissing).toBe(false);
    });

    it("对账：SAF 授权目录走原生查询而不是 RNFS.exists", async () => {
        mockedGetExtra.mockImplementation((_item: any, key: string) =>
            key === "localPath" ? "content://tree/doc/1" : null,
        );
        downloadHistory.recordCompleted(makeMusic("6"));

        mockedSafExists.mockResolvedValue(true);
        const changed = await downloadHistory.reconcileCompletedFiles();

        expect(mockedSafExists).toHaveBeenCalled();
        expect(changed).toBe(0);
        expect(downloadHistory.getRecord("test@6")?.fileMissing).toBe(false);
    });
});

describe("失败原因与状态文案映射", () => {
    it("NetworkOffline 与 NotAllowToDownloadInCellular 不再落到「未知错误」", () => {
        expect(getFailReasonLabel(DownloadFailReason.NetworkOffline, t)).toBe(
            "downloading.downloadFailReason.networkOffline",
        );
        expect(
            getFailReasonLabel(DownloadFailReason.NotAllowToDownloadInCellular, t),
        ).toBe("downloading.downloadFailReason.notAllowToDownloadInCellular");
        expect(getFailReasonLabel(DownloadFailReason.NoWritePermission, t)).toBe(
            "downloading.downloadFailReason.noWritePermission",
        );
        expect(getFailReasonLabel(DownloadFailReason.FailToFetchSource, t)).toBe(
            "downloading.downloadFailReason.failToFetchSource",
        );
        // 未知 / 缺省才回落到 unknown
        expect(getFailReasonLabel(undefined, t)).toBe(
            "downloading.downloadFailReason.unknown",
        );
        expect(getFailReasonLabel(DownloadFailReason.Unknown, t)).toBe(
            "downloading.downloadFailReason.unknown",
        );
    });
});

describe("已完成记录按天分组", () => {
    it("同一天归为一组，跨天拆开，组内时间倒序", () => {
        const base = new Date();
        const at = (dayOffset: number, hour: number) => {
            const d = new Date(
                base.getFullYear(),
                base.getMonth(),
                base.getDate() + dayOffset,
                hour,
            );
            return d.getTime();
        };

        const records: any[] = [
            { mediaKey: "a", status: "completed", updatedAt: at(0, 9) },
            { mediaKey: "b", status: "completed", updatedAt: at(0, 21) },
            { mediaKey: "c", status: "completed", updatedAt: at(-1, 15) },
        ];

        const groups = groupRecordsByDate(records, t);
        expect(groups).toHaveLength(2);
        expect(groups[0].title).toBe("downloading.section.today");
        expect(groups[0].data.map(item => item.mediaKey)).toEqual(["b", "a"]);
        expect(groups[1].title).toBe("downloading.section.yesterday");
        expect(groups[1].data.map(item => item.mediaKey)).toEqual(["c"]);
    });

    it("空列表不产生分组", () => {
        expect(groupRecordsByDate([], t)).toEqual([]);
    });
});
