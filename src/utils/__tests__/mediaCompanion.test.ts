import { unlink } from "react-native-fs";
import { deleteAndroidSafUri } from "@/utils/androidSaf";
import { getMediaExtraProperty } from "@/utils/mediaExtra";
import {
    deleteCompanionFiles,
    getBasePathWithoutExtension,
    getCompanionCoverCandidates,
    getCompanionCoverPath,
    getCompanionLyricPath,
    getCoverExtensionFromUrl,
    toFileUri,
} from "@/utils/mediaCompanion";

jest.mock("@/utils/androidSaf", () => ({
    isAndroidSafUri: (uri?: string | null) => !!uri?.startsWith("content://"),
    deleteAndroidSafUri: jest.fn(async () => true),
}));

jest.mock("@/utils/mediaExtra", () => ({
    getMediaExtraProperty: jest.fn(),
}));

const mockedUnlink = unlink as unknown as jest.Mock;
const mockedDeleteSafUri = deleteAndroidSafUri as unknown as jest.Mock;
const mockedGetExtra = getMediaExtraProperty as unknown as jest.Mock;

const audioPath = "/sdcard/Music/烟火里的尘埃-郁欢.flac";

describe("mediaCompanion", () => {
    beforeEach(() => {
        mockedUnlink.mockClear();
        mockedDeleteSafUri.mockClear();
        mockedGetExtra.mockReset();
    });

    describe("getBasePathWithoutExtension", () => {
        it("去掉扩展名并保留目录", () => {
            expect(getBasePathWithoutExtension(audioPath)).toBe(
                "/sdcard/Music/烟火里的尘埃-郁欢",
            );
        });

        it("兼容 file:// 前缀", () => {
            expect(getBasePathWithoutExtension(`file://${audioPath}`)).toBe(
                "/sdcard/Music/烟火里的尘埃-郁欢",
            );
        });

        it("无扩展名时原样返回", () => {
            expect(getBasePathWithoutExtension("/sdcard/Music/无扩展名")).toBe(
                "/sdcard/Music/无扩展名",
            );
        });

        it("不会把目录中的点当成扩展名分隔符", () => {
            expect(getBasePathWithoutExtension("/sdcard/a.b/song")).toBe(
                "/sdcard/a.b/song",
            );
        });
    });

    describe("getCoverExtensionFromUrl", () => {
        it("识别 jpg", () => {
            expect(getCoverExtensionFromUrl("https://cdn.com/a/b/cover.jpg")).toBe("jpg");
        });

        it("识别 png 与 webp", () => {
            expect(getCoverExtensionFromUrl("https://cdn.com/cover.PNG")).toBe("png");
            expect(getCoverExtensionFromUrl("https://cdn.com/cover.webp")).toBe("webp");
        });

        it("带查询参数时仍能识别", () => {
            expect(
                getCoverExtensionFromUrl("https://cdn.com/cover.jpeg?param=100x100#hash"),
            ).toBe("jpeg");
        });

        it("无法判断时回退 jpg", () => {
            expect(getCoverExtensionFromUrl("https://cdn.com/image?id=1")).toBe("jpg");
            expect(getCoverExtensionFromUrl("")).toBe("jpg");
        });
    });

    describe("getCompanionCoverPath", () => {
        it("默认与音频同名同目录", () => {
            expect(getCompanionCoverPath(audioPath, "jpg", "sameAsAudio")).toBe(
                "/sdcard/Music/烟火里的尘埃-郁欢.jpg",
            );
        });

        it("固定名模式下返回同目录 cover.xxx", () => {
            expect(getCompanionCoverPath(audioPath, "png", "fixedName")).toBe(
                "/sdcard/Music/cover.png",
            );
        });
    });

    describe("getCompanionLyricPath", () => {
        it("与音频同名同目录，扩展名跟随配置", () => {
            expect(getCompanionLyricPath(audioPath, "lrc")).toBe(
                "/sdcard/Music/烟火里的尘埃-郁欢.lrc",
            );
            expect(getCompanionLyricPath(audioPath, "txt")).toBe(
                "/sdcard/Music/烟火里的尘埃-郁欢.txt",
            );
        });
    });

    describe("getCompanionCoverCandidates", () => {
        it("同名封面优先于固定名封面", () => {
            const candidates = getCompanionCoverCandidates(audioPath);
            expect(candidates[0]).toBe("/sdcard/Music/烟火里的尘埃-郁欢.jpg");
            expect(candidates).toContain("/sdcard/Music/cover.jpg");
            expect(candidates).toContain("/sdcard/Music/folder.webp");
        });

        it("SAF 授权目录无法遍历文件系统，返回空", () => {
            expect(
                getCompanionCoverCandidates("content://com.android/tree/xxx"),
            ).toEqual([]);
        });
    });

    describe("toFileUri", () => {
        it("本地路径补 file://", () => {
            expect(toFileUri("/sdcard/Music/a.jpg")).toBe("file:///sdcard/Music/a.jpg");
        });

        it("已有的 file:// 不重复添加", () => {
            expect(toFileUri("file:///sdcard/a.jpg")).toBe("file:///sdcard/a.jpg");
        });

        it("SAF uri 原样返回", () => {
            expect(toFileUri("content://com.android/tree/1")).toBe(
                "content://com.android/tree/1",
            );
        });
    });

    describe("deleteCompanionFiles", () => {
        it("删除 mediaExtra 中记录的歌词与封面", async () => {
            mockedGetExtra.mockImplementation((_item: any, key: string) =>
                key === "localLyricPath"
                    ? "/sdcard/Music/a.lrc"
                    : "/sdcard/Music/a.jpg",
            );

            await deleteCompanionFiles({ id: "1", platform: "test" } as any);

            expect(mockedUnlink).toHaveBeenCalledWith("/sdcard/Music/a.lrc");
            expect(mockedUnlink).toHaveBeenCalledWith("/sdcard/Music/a.jpg");
            expect(mockedDeleteSafUri).not.toHaveBeenCalled();
        });

        it("SAF 路径走 deleteSafUri", async () => {
            mockedGetExtra.mockImplementation((_item: any, key: string) =>
                key === "localLyricPath" ? null : "content://com.android/tree/9",
            );

            await deleteCompanionFiles({ id: "1", platform: "test" } as any);

            expect(mockedDeleteSafUri).toHaveBeenCalledWith(
                "content://com.android/tree/9",
            );
            expect(mockedUnlink).not.toHaveBeenCalled();
        });

        it("没有记录或删除失败时都不抛错", async () => {
            mockedGetExtra.mockReturnValue(null);
            await expect(
                deleteCompanionFiles({ id: "1", platform: "test" } as any),
            ).resolves.toBeUndefined();

            mockedGetExtra.mockReturnValue("/sdcard/Music/a.jpg");
            mockedUnlink.mockRejectedValueOnce(new Error("EACCES"));
            await expect(
                deleteCompanionFiles({ id: "1", platform: "test" } as any),
            ).resolves.toBeUndefined();
        });
    });
});
