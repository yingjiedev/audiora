import { formatLyricsByTimestamp } from "@/utils/lrcParser";
import { downloadFile, exists, stat, unlink, writeFile } from "react-native-fs";
import {
    writeCoverFile,
    writeLyricFile,
} from "@/core/downloadCompanionFiles";
import { PostProcessingStepError } from "@/core/downloadPostProcessing";
import musicMetadataManager from "@/core/musicMetadataManager";

// androidSaf 会拉起 expo-file-system 的 ESM 构建，jest 侧不转译，直接整体打桩
jest.mock("@/utils/androidSaf", () => ({
    isAndroidSafUri: (uri?: string | null) => !!uri?.startsWith("content://"),
    deleteAndroidSafUri: jest.fn(async () => true),
    copyLocalFileToAndroidDirectory: jest.fn(),
}));

// mediaExtra -> mediaUtils -> commonConst 会拉起 react-native-reanimated 的 ESM 构建，
// 这里只关心附属文件步骤的失败语义，直接把 mediaExtra 打桩
jest.mock("@/utils/mediaExtra", () => ({
    getMediaExtraProperty: jest.fn(() => null),
    patchMediaExtra: jest.fn(),
}));

jest.mock("@/core/musicMetadataManager", () => ({
    __esModule: true,
    default: {
        getCoverUrl: jest.fn(),
        isAvailable: jest.fn(() => true),
        writeMetadataForDownloadTask: jest.fn(),
    },
}));

jest.mock("@/core/localMusicSheet", () => ({
    __esModule: true,
    default: {
        isCoverPathUsedByOtherTrack: jest.fn(() => false),
    },
}));

jest.mock("@/utils/lrcParser", () => ({
    formatLyricsByTimestamp: jest.fn(() => "[00:00.000]测试歌词"),
}));

const mockedWriteFile = writeFile as unknown as jest.Mock;
const mockedExists = exists as unknown as jest.Mock;
const mockedUnlink = unlink as unknown as jest.Mock;
const mockedDownloadFile = downloadFile as unknown as jest.Mock;
const mockedStat = stat as unknown as jest.Mock;
const mockedGetCoverUrl = musicMetadataManager.getCoverUrl as unknown as jest.Mock;

const audioFilePath = "/sdcard/Music/测试歌曲.flac";

const lyricConfig = {
    downloadLyricFile: true,
    lyricFileFormat: "lrc",
    lyricOrder: ["original"],
    enableWordByWord: false,
    downloadCoverFile: false,
    coverFileNaming: "sameAsAudio",
} as any;

const coverConfig = {
    ...lyricConfig,
    downloadLyricFile: false,
    downloadCoverFile: true,
    coverFileNaming: "sameAsAudio",
} as any;

const musicItem = {
    id: "1",
    platform: "test-platform",
    title: "测试歌曲",
} as any;

const createPluginManager = (getLyric: jest.Mock) =>
    ({ getByName: jest.fn(() => ({ methods: { getLyric } })) }) as any;

const createMissingPluginManager = () =>
    ({ getByName: jest.fn(() => undefined) }) as any;

describe("下载附属文件步骤", () => {
    beforeEach(() => {
        mockedWriteFile.mockClear();
        mockedExists.mockReset();
        mockedExists.mockResolvedValue(false);
        mockedUnlink.mockClear();
        mockedDownloadFile.mockReset();
        mockedStat.mockReset();
        mockedStat.mockResolvedValue({ path: "x", size: 1024 });
        mockedGetCoverUrl.mockReset();
    });

    describe("writeLyricFile", () => {
        it.each([false, true])("规范化原文、翻译与音译，逐字模式 %s", async enableWordByWord => {
            const xml = (text: string) =>
                `<QrcInfos><LyricInfo LyricContent="[1000,500]${text}(1000,500)" /></QrcInfos>`;
            const getLyric = jest.fn(async () => ({
                rawLrc: xml("原文"),
                translation: xml("翻译"),
                romanization: xml("音译"),
            }));
            await writeLyricFile(
                musicItem,
                audioFilePath,
                { ...lyricConfig, enableWordByWord },
                createPluginManager(getLyric),
            );
            const expected = (text: string) => enableWordByWord
                ? `[00:01.000]<00:01.000>${text}<00:01.500>`
                : `[00:01.00]${text}`;
            expect(formatLyricsByTimestamp).toHaveBeenLastCalledWith(
                expected("原文"), expected("翻译"), expected("音译"),
                lyricConfig.lyricOrder, { enableWordByWord },
            );
        });

        it("插件不支持时返回 null，不算失败", async () => {
            const result = await writeLyricFile(
                musicItem,
                audioFilePath,
                lyricConfig,
                createMissingPluginManager(),
            );

            expect(result).toBeNull();
            expect(mockedWriteFile).not.toHaveBeenCalled();
        });

        it("插件没有返回歌词时返回 null", async () => {
            const getLyric = jest.fn(async () => undefined as any);
            const result = await writeLyricFile(
                musicItem,
                audioFilePath,
                lyricConfig,
                createPluginManager(getLyric),
            );

            expect(result).toBeNull();
            expect(mockedWriteFile).not.toHaveBeenCalled();
        });

        it("写入成功时返回与音频同名的歌词路径", async () => {
            const getLyric = jest.fn(async () => ({ rawLrc: "[00:00.000]测试歌词" }) as any);
            const result = await writeLyricFile(
                musicItem,
                audioFilePath,
                lyricConfig,
                createPluginManager(getLyric),
            );

            expect(result).toBe("/sdcard/Music/测试歌曲.lrc");
            expect(mockedWriteFile).toHaveBeenCalledWith(
                "/sdcard/Music/测试歌曲.lrc",
                "[00:00.000]测试歌词",
                "utf8",
            );
        });

        it("取歌词失败时向上抛错，并带上音频与歌词路径", async () => {
            const getLyric = jest.fn(async () => {
                throw new Error("network down");
            });

            await expect(
                writeLyricFile(
                    musicItem,
                    audioFilePath,
                    lyricConfig,
                    createPluginManager(getLyric),
                ),
            ).rejects.toMatchObject({
                name: "PostProcessingStepError",
                message: "network down",
                detail: {
                    audioFilePath,
                    lyricFilePath: "/sdcard/Music/测试歌曲.lrc",
                },
            });
        });
    });

    describe("writeCoverFile", () => {
        it("没有可用封面地址时返回 null", async () => {
            mockedGetCoverUrl.mockResolvedValue(undefined);

            const result = await writeCoverFile(musicItem, audioFilePath, coverConfig);

            expect(result).toBeNull();
            expect(mockedDownloadFile).not.toHaveBeenCalled();
        });

        it("下载失败时向上抛错，并清理 .part 临时文件", async () => {
            mockedGetCoverUrl.mockResolvedValue("https://cdn.example.com/cover.jpg");
            mockedDownloadFile.mockReturnValue({
                jobId: 1,
                promise: Promise.resolve({ statusCode: 404, bytesWritten: 0 }),
            });

            await expect(
                writeCoverFile(musicItem, audioFilePath, coverConfig),
            ).rejects.toBeInstanceOf(PostProcessingStepError);

            expect(mockedUnlink).toHaveBeenCalledTimes(1);
            expect(String(mockedUnlink.mock.calls[0][0])).toContain(".part");
        });

        it("内容为空文件时向上抛错", async () => {
            mockedGetCoverUrl.mockResolvedValue("https://cdn.example.com/cover.jpg");
            mockedDownloadFile.mockReturnValue({
                jobId: 1,
                promise: Promise.resolve({ statusCode: 200, bytesWritten: 0 }),
            });
            mockedStat.mockResolvedValue({ path: "x", size: 0 });

            await expect(
                writeCoverFile(musicItem, audioFilePath, coverConfig),
            ).rejects.toMatchObject({
                detail: { coverFilePath: "/sdcard/Music/测试歌曲.jpg" },
            });
        });

        it("目录级共享封面已存在时跳过写入，不覆盖用户文件", async () => {
            mockedGetCoverUrl.mockResolvedValue("https://cdn.example.com/cover.jpg");
            mockedExists.mockResolvedValue(true);

            const result = await writeCoverFile(musicItem, audioFilePath, {
                ...coverConfig,
                coverFileNaming: "fixedName",
            });

            expect(result).toBeNull();
            expect(mockedDownloadFile).not.toHaveBeenCalled();
        });
    });
});
