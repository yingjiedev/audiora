/**
 * 本地音频音质映射工具
 *
 * 基于本地文件的真实技术元数据（码率/采样率/位深/编码）推导展示用音质档位，
 * 不再依赖播放器内部固定的 "320k" 兼容状态。规则集中定义于此，配套单元测试。
 *
 * 原则：
 * - 有损格式按实际码率就近分档（128k/192k/320k/96k）；
 * - 无损格式按位深与采样率分档（flac=SQ，位深>16 或 采样率>48kHz=hires=HR）；
 * - 信息不足时返回 null，展示中性"本地音频"文案，禁止猜测为 Master/HQ 等虚假档位。
 */

const LOSSLESS_CODECS = new Set(["flac", "wav", "pcm", "alac", "ape"]);
const LOSSY_CODECS = new Set([
    "mp3",
    "aac",
    "vorbis",
    "opus",
    "wma",
    "amr-wb",
    "amr-nb",
]);

/** 音频技术元数据（与原生 IBasicMeta 中的技术字段一致） */
export interface ILocalAudioMeta {
    /** 平均码率，bps */
    bitrate?: number;
    /** 采样率，Hz */
    sampleRate?: number;
    /** 位深，bit */
    bitDepth?: number;
    /** 编码格式小写短名，如 mp3 / aac / flac / alac / wav / vorbis */
    codec?: string;
    /** 声道数 */
    channelCount?: number;
}

function toPositiveNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return value;
    }
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
    }
    return undefined;
}

/** 校验并规范化音频元数据，脏数据（NaN/负数/空串）一律剔除，兼容旧数据缺字段 */
export function normalizeAudioMeta(
    meta?: ILocalAudioMeta | Record<string, unknown> | null,
): ILocalAudioMeta | undefined {
    if (!meta || typeof meta !== "object") {
        return undefined;
    }
    const normalized: ILocalAudioMeta = {
        bitrate: toPositiveNumber(meta.bitrate),
        sampleRate: toPositiveNumber(meta.sampleRate),
        bitDepth: toPositiveNumber(meta.bitDepth),
        codec:
            typeof meta.codec === "string" && meta.codec.trim()
                ? meta.codec.trim().toLowerCase()
                : undefined,
        channelCount: toPositiveNumber(meta.channelCount),
    };
    return Object.values(normalized).some(value => value !== undefined)
        ? normalized
        : undefined;
}

/** 从音乐项的内部序列化字段($audioMeta)读取技术元数据 */
export function getMusicItemAudioMeta(
    musicItem?: IMusic.IMusicItem | null,
): ILocalAudioMeta | undefined {
    const meta = (musicItem as any)?.$?.audioMeta;
    return normalizeAudioMeta(meta);
}

/**
 * 本地音质映射规则：
 * - 无损编码：位深 > 16 或采样率 > 48kHz → hires(HR)，否则 flac(SQ)
 * - 有损编码：按码率就近分档，码率未知 → null
 * - 编码未知：有位深信息视为无损；仅凭高码率不猜测无损，返回 null
 * - 完全无信息：null，展示中性"本地音频"
 */
export function mapLocalQuality(
    meta?: ILocalAudioMeta | Record<string, unknown> | null,
): IMusic.IQualityKey | null {
    const normalized = normalizeAudioMeta(meta);
    if (!normalized) {
        return null;
    }
    const codec = normalized.codec;

    if (codec && LOSSLESS_CODECS.has(codec)) {
        if (
            (normalized.bitDepth && normalized.bitDepth > 16) ||
            (normalized.sampleRate && normalized.sampleRate > 48000)
        ) {
            return "hires";
        }
        return "flac";
    }

    if (codec && LOSSY_CODECS.has(codec)) {
        const bitrate = normalized.bitrate;
        if (!bitrate) {
            return null;
        }
        if (bitrate >= 320000) return "320k";
        if (bitrate >= 192000) return "192k";
        if (bitrate >= 128000) return "128k";
        return "96k";
    }

    // 编码未知：有位深信息基本可判定为无损 PCM 类
    if (normalized.bitDepth) {
        if (
            normalized.bitDepth > 16 ||
            (normalized.sampleRate && normalized.sampleRate > 48000)
        ) {
            return "hires";
        }
        return "flac";
    }

    // 编码未知且无位深：仅低码率敢判有损，高码率可能是无损，不猜
    const bitrate = normalized.bitrate;
    if (bitrate && bitrate < 320000) {
        if (bitrate >= 192000) return "192k";
        if (bitrate >= 128000) return "128k";
        return "96k";
    }
    return null;
}

const codecDisplayNames: Record<string, string> = {
    mp3: "MP3",
    aac: "AAC",
    flac: "FLAC",
    alac: "ALAC",
    wav: "WAV",
    pcm: "WAV",
    vorbis: "Vorbis",
    opus: "Opus",
    ape: "APE",
    wma: "WMA",
    "amr-wb": "AMR-WB",
    "amr-nb": "AMR-NB",
};

/**
 * 格式化技术参数文案，如 `FLAC · 24-bit · 96 kHz · 2304 kbps`；
 * 没有任何可靠信息时返回 undefined（由调用方展示中性兜底文案）。
 */
export function formatAudioQualityText(
    meta?: ILocalAudioMeta | Record<string, unknown> | null,
): string | undefined {
    const normalized = normalizeAudioMeta(meta);
    if (!normalized) {
        return undefined;
    }
    const parts: string[] = [];
    if (normalized.codec) {
        parts.push(
            codecDisplayNames[normalized.codec] ?? normalized.codec.toUpperCase(),
        );
    }
    if (normalized.bitDepth) {
        parts.push(`${normalized.bitDepth}-bit`);
    }
    if (normalized.sampleRate) {
        const khz = normalized.sampleRate / 1000;
        parts.push(`${Number.isInteger(khz) ? khz : khz.toFixed(1)} kHz`);
    }
    if (normalized.bitrate) {
        parts.push(`${Math.round(normalized.bitrate / 1000)} kbps`);
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * 本地音乐的音质缩写：能映射到标准档位时复用标准缩写（HQ/SQ/HR），
 * 无法映射时返回 null（由调用方展示"本地"中性文案）。
 */
export function getLocalQualityAbbr(
    musicItem?: IMusic.IMusicItem | null,
): string | null {
    const meta = getMusicItemAudioMeta(musicItem);
    const quality = mapLocalQuality(meta);
    if (!quality) {
        return null;
    }
    // 延迟引入避免循环依赖
    const { getQualityAbbr } = require("@/utils/qualities");
    return getQualityAbbr(quality);
}
