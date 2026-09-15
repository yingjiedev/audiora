import { unlink } from "react-native-fs";
import { deleteAndroidSafUri } from "@/utils/androidSaf";
import { getMediaExtraProperty } from "@/utils/mediaExtra";
import LocalMusicSheet from "@/core/localMusicSheet";
import {
    readCompanionPaths,
    reconcileCompanionPaths,
} from "@/core/downloadCompanionFiles";

jest.mock("@/utils/androidSaf", () => ({
    isAndroidSafUri: (uri?: string | null) => !!uri?.startsWith("content://"),
    deleteAndroidSafUri: jest.fn(async () => true),
}));

jest.mock("@/utils/mediaExtra", () => ({
    getMediaExtraProperty: jest.fn(),
}));

jest.mock("@/core/localMusicSheet", () => ({
    __esModule: true,
    default: {
        isCoverPathUsedByOtherTrack: jest.fn(() => false),
    },
}));

const mockedUnlink = unlink as unknown as jest.Mock;
const mockedDeleteSafUri = deleteAndroidSafUri as unknown as jest.Mock;
const mockedGetExtra = getMediaExtraProperty as unknown as jest.Mock;
const mockedIsCoverUsed = LocalMusicSheet
    .isCoverPathUsedByOtherTrack as unknown as jest.Mock;

const musicItem = { id: "1", platform: "test", title: "测试歌曲" } as any;

describe("downloadCompanionFiles 记录对账", () => {
    beforeEach(() => {
        mockedUnlink.mockClear();
        mockedDeleteSafUri.mockClear();
        mockedGetExtra.mockReset();
        mockedIsCoverUsed.mockReturnValue(false);
    });

    describe("readCompanionPaths", () => {
        it("读取 mediaExtra 中已记录的附属文件路径", () => {
            mockedGetExtra.mockImplementation((_item: any, key: string) =>
                key === "localLyricPath"
                    ? "/sdcard/Music/a.lrc"
                    : "/sdcard/Music/a.jpg",
            );

            expect(readCompanionPaths(musicItem)).toEqual({
                lyricPath: "/sdcard/Music/a.lrc",
                coverPath: "/sdcard/Music/a.jpg",
            });
        });

        it("没有记录时返回 null", () => {
            mockedGetExtra.mockReturnValue(null);
            expect(readCompanionPaths(musicItem)).toEqual({
                lyricPath: null,
                coverPath: null,
            });
        });
    });

    describe("reconcileCompanionPaths", () => {
        it("首次下载直接采用新路径，不做删除", async () => {
            const result = await reconcileCompanionPaths(
                musicItem,
                { lyricPath: null, coverPath: null },
                { lyricPath: "/sdcard/Music/a.lrc", coverPath: "/sdcard/Music/a.jpg" },
            );

            expect(result).toEqual({
                lyricPath: "/sdcard/Music/a.lrc",
                coverPath: "/sdcard/Music/a.jpg",
            });
            expect(mockedUnlink).not.toHaveBeenCalled();
        });

        it("路径变化时删除旧文件并记录新路径", async () => {
            const result = await reconcileCompanionPaths(
                musicItem,
                { lyricPath: "/sdcard/Music/old.lrc", coverPath: "/sdcard/Music/old.jpg" },
                { lyricPath: "/sdcard/Music/new.lrc", coverPath: "/sdcard/Music/new.jpg" },
            );

            expect(mockedUnlink).toHaveBeenCalledWith("/sdcard/Music/old.lrc");
            expect(mockedUnlink).toHaveBeenCalledWith("/sdcard/Music/old.jpg");
            expect(result).toEqual({
                lyricPath: "/sdcard/Music/new.lrc",
                coverPath: "/sdcard/Music/new.jpg",
            });
        });

        it("本次未生成附属文件时保留旧记录，避免变成无主文件", async () => {
            const result = await reconcileCompanionPaths(
                musicItem,
                { lyricPath: "/sdcard/Music/a.lrc", coverPath: "/sdcard/Music/a.jpg" },
                { lyricPath: null, coverPath: null },
            );

            expect(mockedUnlink).not.toHaveBeenCalled();
            expect(result).toEqual({
                lyricPath: "/sdcard/Music/a.lrc",
                coverPath: "/sdcard/Music/a.jpg",
            });
        });

        it("路径相同时不重复删除", async () => {
            const result = await reconcileCompanionPaths(
                musicItem,
                { lyricPath: "/sdcard/Music/a.lrc", coverPath: null },
                { lyricPath: "/sdcard/Music/a.lrc", coverPath: null },
            );

            expect(mockedUnlink).not.toHaveBeenCalled();
            expect(result.lyricPath).toBe("/sdcard/Music/a.lrc");
        });

        it("旧封面仍被其他曲目引用时不删除旧封面文件", async () => {
            mockedIsCoverUsed.mockReturnValue(true);

            const result = await reconcileCompanionPaths(
                musicItem,
                { lyricPath: null, coverPath: "/sdcard/Music/shared.jpg" },
                { lyricPath: null, coverPath: "/sdcard/Music/new.jpg" },
            );

            expect(mockedUnlink).not.toHaveBeenCalled();
            expect(result.coverPath).toBe("/sdcard/Music/new.jpg");
        });

        it("目录级共享封面不会被当成旧文件删除", async () => {
            const result = await reconcileCompanionPaths(
                musicItem,
                { lyricPath: null, coverPath: "/sdcard/Music/cover.png" },
                { lyricPath: null, coverPath: "/sdcard/Music/a.jpg" },
            );

            expect(mockedUnlink).not.toHaveBeenCalled();
            expect(result.coverPath).toBe("/sdcard/Music/a.jpg");
        });

        it("SAF 旧文件走 deleteSafUri", async () => {
            await reconcileCompanionPaths(
                musicItem,
                {
                    lyricPath: "content://com.android/tree/1",
                    coverPath: "content://com.android/tree/2",
                },
                { lyricPath: null, coverPath: null },
            );

            // 本次没有新文件时保留旧记录，不做清理
            expect(mockedDeleteSafUri).not.toHaveBeenCalled();

            await reconcileCompanionPaths(
                musicItem,
                {
                    lyricPath: "content://com.android/tree/1",
                    coverPath: "content://com.android/tree/2",
                },
                {
                    lyricPath: "content://com.android/tree/3",
                    coverPath: "content://com.android/tree/4",
                },
            );

            expect(mockedDeleteSafUri).toHaveBeenCalledWith(
                "content://com.android/tree/1",
            );
            expect(mockedDeleteSafUri).toHaveBeenCalledWith(
                "content://com.android/tree/2",
            );
            expect(mockedUnlink).not.toHaveBeenCalled();
        });
    });
});
