/**
 * 下载完成后的后处理步骤编排
 *
 * 音频文件成功落盘（含解密）之后的所有步骤都不再属于「下载」本身：
 * 任何一步失败都只记日志，不改写任务状态，也不删除已经落盘的音频（issue #64）。
 *
 * 这里只提供统一的步骤包装器，具体的后处理顺序由调用方（downloader）决定：
 * 每个子步骤 best-effort，单个失败不影响其余子步骤，失败日志始终带上
 * title / platform / id / 文件路径，便于定位与后续做「补齐附属文件」入口。
 */
import { errorLog } from "@/utils/log";

export interface IPostProcessingContext {
    /** 歌曲标题，与 platform / id 一起定位同名歌曲 */
    title?: string;
    /** 来源平台（插件名） */
    platform?: string;
    /** 平台内的歌曲 id */
    id?: string;
    /** 本条后处理的目标文件路径（默认音频路径，附属文件步骤会换成对应文件） */
    filePath?: string;
}

const coerceError = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

/**
 * 子步骤抛出的错误。message 保留原始失败原因，detail 额外带上步骤内部的路径，
 * 由 runPostProcessingStep 展开进日志，避免调用方丢失定位信息。
 */
export class PostProcessingStepError extends Error {
    readonly detail: Record<string, unknown>;

    constructor(message: string, detail: Record<string, unknown> = {}) {
        super(message);
        this.name = "PostProcessingStepError";
        this.detail = detail;
    }
}

/**
 * 执行单个后处理步骤。
 *
 * - 成功：原样返回步骤结果
 * - 失败：记一条带上下文的 errorLog 并返回 undefined，**不向上抛**
 *
 * @param scene 日志描述，写清是哪一步失败
 */
export async function runPostProcessingStep<T>(
    scene: string,
    context: IPostProcessingContext,
    run: () => Promise<T> | T,
): Promise<T | undefined> {
    try {
        return await run();
    } catch (error) {
        const detail =
            error instanceof PostProcessingStepError ? error.detail : {};
        errorLog(scene, {
            title: context.title,
            platform: context.platform,
            id: context.id,
            filePath: context.filePath,
            error: coerceError(error),
            ...detail,
        });
        return undefined;
    }
}
