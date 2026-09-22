import { errorLog } from "@/utils/log";
import {
    PostProcessingStepError,
    runPostProcessingStep,
} from "@/core/downloadPostProcessing";

jest.mock("@/utils/log", () => ({
    errorLog: jest.fn(),
    devLog: jest.fn(),
}));

const mockedErrorLog = errorLog as unknown as jest.Mock;

const context = {
    title: "测试歌曲",
    platform: "test-platform",
    id: "1",
    filePath: "/sdcard/Music/a.flac",
};

describe("runPostProcessingStep", () => {
    beforeEach(() => {
        mockedErrorLog.mockClear();
    });

    it("成功时原样返回步骤结果", async () => {
        const result = await runPostProcessingStep(
            "后处理失败：写入歌词文件",
            context,
            () => "/sdcard/Music/a.lrc",
        );

        expect(result).toBe("/sdcard/Music/a.lrc");
        expect(mockedErrorLog).not.toHaveBeenCalled();
    });

    it("支持返回 undefined 的步骤，且不会被当成失败", async () => {
        const result = await runPostProcessingStep(
            "后处理失败：写入音乐标签",
            context,
            () => undefined,
        );

        expect(result).toBeUndefined();
        expect(mockedErrorLog).not.toHaveBeenCalled();
    });

    it("步骤抛错时不向上抛，返回 undefined", async () => {
        await expect(
            runPostProcessingStep("后处理失败：写入歌词文件", context, () => {
                throw new Error("network down");
            }),
        ).resolves.toBeUndefined();
    });

    it("失败日志带上歌曲标识与文件路径", async () => {
        await runPostProcessingStep("后处理失败：写入封面文件", context, async () => {
            throw new Error("封面下载失败，状态码 404");
        });

        expect(mockedErrorLog).toHaveBeenCalledTimes(1);
        const [scene, payload] = mockedErrorLog.mock.calls[0];
        expect(scene).toBe("后处理失败：写入封面文件");
        expect(payload).toMatchObject({
            title: "测试歌曲",
            platform: "test-platform",
            id: "1",
            filePath: "/sdcard/Music/a.flac",
            error: "封面下载失败，状态码 404",
        });
    });

    it("步骤内部的附属文件路径会展开进日志", async () => {
        await runPostProcessingStep("后处理失败：写入歌词文件", context, () => {
            throw new PostProcessingStepError("permission denied", {
                audioFilePath: "/sdcard/Music/a.flac",
                lyricFilePath: "/sdcard/Music/a.lrc",
            });
        });

        expect(mockedErrorLog.mock.calls[0][1]).toMatchObject({
            error: "permission denied",
            audioFilePath: "/sdcard/Music/a.flac",
            lyricFilePath: "/sdcard/Music/a.lrc",
        });
    });

    it("非 Error 抛出物也会被记录", async () => {
        await runPostProcessingStep("后处理失败：未知", context, () => {
            // eslint-disable-next-line no-throw-literal
            throw "boom";
        });

        expect(mockedErrorLog.mock.calls[0][1].error).toBe("boom");
    });

    it("单个步骤失败不影响后续步骤继续执行", async () => {
        const results: Array<unknown> = [];
        results.push(
            await runPostProcessingStep("后处理失败：写入音乐标签", context, () => {
                throw new Error("tag failed");
            }),
        );
        results.push(
            await runPostProcessingStep("后处理失败：写入歌词文件", context, () => "lyric"),
        );
        results.push(
            await runPostProcessingStep("后处理失败：写入封面文件", context, () => "cover"),
        );

        expect(results).toEqual([undefined, "lyric", "cover"]);
        expect(mockedErrorLog).toHaveBeenCalledTimes(1);
    });
});
