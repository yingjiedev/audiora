/**
 * 音质相关的所有工具代码
 */
import { ILanguageData } from "@/types/core/i18n";
import { devLog } from "@/utils/log";

type LegacyQualityKey = "low" | "standard" | "high" | "super";

/**
 * MusicFree 官方协议的音质键。
 * 官方类型定义就是 `IMusic.IQualityKey = "low" | "standard" | "high" | "super"`，
 * 第三方插件基本都按这套键实现 getMediaSource —— app 自己的 96k…master 是 Audiora 扩展，
 * 插件并不认识，所以调用插件前必须转换（见 toOfficialQuality）。
 */
export type OfficialQualityKey = LegacyQualityKey;

/** 内置音质键列表（作为默认值） */
export const BUILTIN_QUALITY_KEYS: string[] = [
    "96k",
    "128k",
    "192k",
    "320k",
    "flac",
    "flac24bit",
    "hires",
    "vinyl",
    "dolby",
    "atmos",
    "atmos_plus",
    "master",
];

/** @deprecated 使用 getQualityKeys() 代替 */
export const qualityKeys = BUILTIN_QUALITY_KEYS;

/** 获取当前生效的音质键列表（配置优先，回退到内置列表） */
export function getQualityKeys(): string[] {
    try {
        // 延迟引入避免循环依赖
        const Config = require("@/core/appConfig").default;
        const list = Config.getConfig("basic.qualityKeysList");
        if (Array.isArray(list) && list.length > 0) {
            return list;
        }
    } catch {}
    return BUILTIN_QUALITY_KEYS;
}

/** 获取音质尝试顺序（从高到低） */
export function getTryQualityList(): string[] {
    return [...getQualityKeys()].reverse();
}

// 原版音质到新版音质的映射
const legacyQualityMap: Record<LegacyQualityKey, IMusic.IQualityKey> = {
    "low": "128k",
    "standard": "192k",
    "high": "320k",
    "super": "flac",
};

/** app 内部音质键 → MusicFree 官方协议键 */
const internalToOfficialMap: Record<string, OfficialQualityKey> = {
    "96k": "low",
    "128k": "low",
    "192k": "standard",
    "320k": "high",
    "flac": "super",
    "flac24bit": "super",
    "hires": "super",
    "vinyl": "super",
    "dolby": "super",
    "atmos": "super",
    "atmos_plus": "super",
    "master": "super",
};

/**
 * 将原版插件的音质键值转换为新版音质键值
 */
export function convertLegacyQuality(legacyQuality: string): IMusic.IQualityKey {
    if (legacyQuality in legacyQualityMap) {
        return legacyQualityMap[legacyQuality as LegacyQualityKey];
    }
    // 如果不是原版音质键值，假设已经是新版键值
    return legacyQuality as IMusic.IQualityKey;
}

/** ---------- 插件音质协议：MusicFree 官方 vs Audiora 扩展 ---------- */

/** 官方协议的音质键，按音质从低到高 */
export const OFFICIAL_QUALITY_KEYS: OfficialQualityKey[] = [
    "low",
    "standard",
    "high",
    "super",
];

/** 官方协议 4 档对应的 app 内部键（低 → 高） */
export const OFFICIAL_QUALITY_SCOPE: IMusic.IQualityKey[] =
    OFFICIAL_QUALITY_KEYS.map(key => legacyQualityMap[key]);

export function isOfficialQualityKey(key?: string): key is OfficialQualityKey {
    return !!key && (OFFICIAL_QUALITY_KEYS as string[]).includes(key);
}

/** app 内部键 → 官方协议键（调用插件前转换） */
export function toOfficialQuality(
    quality: IMusic.IQualityKey,
): OfficialQualityKey {
    if (isOfficialQualityKey(quality)) {
        return quality;
    }
    // 未知键（用户自定义）按最高档处理，具体交给插件兜底
    return internalToOfficialMap[quality] ?? "super";
}

/** 官方协议键 → app 内部键 */
export function fromOfficialQuality(
    quality: IMusic.IQualityKey,
): IMusic.IQualityKey {
    return isOfficialQualityKey(quality) ? legacyQualityMap[quality] : quality;
}

/**
 * 插件使用的音质协议。
 * - extended：插件用 supportedQualities 声明了 Audiora 扩展键 → 走 app 的完整多音质方案
 * - official：其它一律按 MusicFree 官方 4 档（low/standard/high/super）处理
 */
export type PluginQualityMode = "extended" | "official";

export interface IPluginQualityDecl {
    supportedQualities?: IMusic.IQualityKey[];
    /** 插件加载/安装时探测的结果，作为缓存避免重复判定 */
    qualityMode?: PluginQualityMode;
}

/**
 * 探测插件使用的音质协议。
 * 只有"声明了非官方键的 supportedQualities"才算支持 app 扩展音质；
 * 未声明、只声明官方键、或声明私有键（如 supportedAudioQuality 里的 lossless）
 * 一律按官方协议处理。
 */
export function resolvePluginQualityMode(
    plugin?: IPluginQualityDecl | null,
): PluginQualityMode {
    if (plugin?.qualityMode) {
        return plugin.qualityMode;
    }
    const declared = plugin?.supportedQualities;
    if (declared?.length && declared.some(key => !isOfficialQualityKey(key))) {
        return "extended";
    }
    return "official";
}

/**
 * 该插件可用的音质档位（app 内部键，按音质从低到高）。
 * 官方协议插件只留 4 档，避免把 master/hires 这类插件根本不认的档位放到界面上、
 * 也避免播放时拿它们去请求。
 */
export function getPluginQualityScope(
    plugin?: IPluginQualityDecl | null,
): IMusic.IQualityKey[] {
    if (resolvePluginQualityMode(plugin) === "official") {
        return OFFICIAL_QUALITY_SCOPE;
    }
    const declared = plugin?.supportedQualities;
    if (declared?.length) {
        const internal = declared.map(fromOfficialQuality);
        return getQualityKeys().filter(key => internal.includes(key));
    }
    return getQualityKeys();
}

/**
 * 标准化插件返回的音质信息，将原版音质键值转换为新版
 */
export function normalizePluginQualities(qualities?: any): IMusic.IQuality | undefined {
    if (!qualities || typeof qualities !== "object" || Array.isArray(qualities)) {
        return undefined;
    }

    const normalized: Partial<IMusic.IQuality> = {};

    for (const [key, value] of Object.entries(qualities)) {
        const newKey = convertLegacyQuality(key);
        if (value == null) {
            continue;
        }
        // Common plugin shapes:
        //   { "320k": { size: 123 } }
        //   { "320k": { size: "3.2MB" } }
        //   { "320k": true } / {}  → quality exists, size unknown
        //   { "320k": 1234567 }    → size in bytes
        //   { "320k": "3.2MB" }    → size as display string
        if (typeof value === "object" && !Array.isArray(value)) {
            normalized[newKey] = value as any;
        } else if (typeof value === "number" || typeof value === "string") {
            normalized[newKey] = { size: value };
        } else if (value === true) {
            normalized[newKey] = {};
        }
    }

    return Object.keys(normalized).length > 0
        ? (normalized as IMusic.IQuality)
        : undefined;
}

// 音质尝试顺序（保留作为静态后备）
export const TRY_QUALITYS_LIST: IMusic.IQualityKey[] = [
    "master", "atmos_plus", "atmos", "dolby", "vinyl", "hires", "flac24bit", "flac", "320k", "192k", "128k", "96k",
] as const;

// 保留原有硬编码翻译作为后备
export const qualityText: Record<string, string> = {
    "96k": "低清音质 96K",
    "128k": "普通音质 128K",
    "192k": "中等音质 192K",
    "320k": "高清音质 320K",
    flac: "高清音质 FLAC",
    flac24bit: "无损音质 FLAC Hires",
    hires: "无损音质 Hires",
    vinyl: "无损音质 Vinyl",
    dolby: "无损音质 Dolby",
    atmos: "无损音质 Atmos",
    atmos_plus: "无损音质 Atmos 2.0",
    master: "无损音质 Master",
};

/** 获取国际化的音质文本映射 */
export function getQualityText(i18nData: ILanguageData, customTranslations?: Record<string, string>): Record<string, string> {
    const keys = getQualityKeys();
    const result: Record<string, string> = {};
    for (const key of keys) {
        result[key] =
            customTranslations?.[key] ||
            (i18nData as any)[`quality.${key}`] ||
            qualityText[key] ||
            key.toUpperCase();
    }
    return result;
}

/** 内置音质缩写映射（导出供重置使用） */
export const builtinQualityAbbr: Record<string, string> = {
    "96k": "LQ",
    "128k": "LQ",
    "192k": "MQ",
    "320k": "HQ",
    "flac": "SQ",
    "flac24bit": "HR",
    "hires": "HR",
    "vinyl": "VN",
    "dolby": "DB",
    "atmos": "AT",
    "atmos_plus": "A+",
    "master": "MS",
};

/** 获取音质缩写（配置优先，回退到内置映射，再回退到前2字符大写） */
export function getQualityAbbr(key: string, customAbbreviations?: Record<string, string>): string {
    if (customAbbreviations?.[key]) {
        return customAbbreviations[key];
    }
    try {
        const Config = require("@/core/appConfig").default;
        const saved = Config.getConfig("basic.qualityAbbreviations");
        if (saved?.[key]) {
            return saved[key];
        }
    } catch {}
    return builtinQualityAbbr[key] || key.slice(0, 2).toUpperCase();
}

/** 智能音质选择 */
export function getSmartQuality(
    preferredQuality: IMusic.IQualityKey,
    availableQualities: IMusic.IQuality | undefined,
    platformSupportedQualities?: IMusic.IQualityKey[]
): IMusic.IQualityKey {
    // 没有音质信息时无从"智能降级"，但仍不能越过插件档位范围
    // （官方协议插件拿到 master 这种它不认识的键会直接落回最低档）。
    if (!availableQualities) {
        return (
            pickSupportedQuality(preferredQuality, platformSupportedQualities) ??
            preferredQuality
        );
    }

    const tryList = getTryQualityList();
    // 从偏好音质开始，向下搜索可用音质
    const preferredIndex = tryList.indexOf(preferredQuality);
    if (preferredIndex === -1) {
        // 偏好音质不在标准列表里（用户自定义键）：退到允许范围内的最高档，
        // 与原来直接返回 master 的语义保持一致，但不会越过插件支持范围。
        return platformSupportedQualities?.length
            ? platformSupportedQualities[platformSupportedQualities.length - 1]
            : "master";
    }

    // 从偏好音质开始向下搜索
    for (let i = preferredIndex; i < tryList.length; i++) {
        const quality = tryList[i];
        // 修复：只要存在该音质的键，就认为可用（不管是否有url）
        const hasQuality = availableQualities[quality] !== undefined &&
                          availableQualities[quality] !== null;

        // 检查平台是否支持该音质
        const platformSupported = !platformSupportedQualities ||
                                 platformSupportedQualities.includes(quality);

        if (hasQuality && platformSupported) {
            return quality;
        }
    }

    // 如果向下没找到，向上搜索
    for (let i = preferredIndex - 1; i >= 0; i--) {
        const quality = tryList[i];
        // 修复：只要存在该音质的键，就认为可用（不管是否有url）
        const hasQuality = availableQualities[quality] !== undefined &&
                          availableQualities[quality] !== null;

        const platformSupported = !platformSupportedQualities ||
                                 platformSupportedQualities.includes(quality);

        if (hasQuality && platformSupported) {
            return quality;
        }
    }

    // 最后回退到允许范围内的最低档（官方协议插件即 128k）
    return platformSupportedQualities?.[0] ?? "128k";
}

/**
 * 在插件声明支持的音质里挑一个最接近用户偏好的档位。
 * 用于歌曲自身没有 qualities/source 信息时：这类歌曲没法智能降级，
 * 若直接拿默认音质去请求，可能正是插件声明里没有的档位（白跑一次请求）。
 */
export function pickSupportedQuality(
    preferredQuality: IMusic.IQualityKey,
    supported?: IMusic.IQualityKey[],
): IMusic.IQualityKey | undefined {
    if (!supported?.length) {
        return undefined;
    }
    if (supported.includes(preferredQuality)) {
        return preferredQuality;
    }
    const order = getTryQualityList(); // 从高到低
    const preferredIndex = order.indexOf(preferredQuality);
    if (preferredIndex === -1) {
        return supported[0];
    }
    // 先按"不高于偏好档位"的方向找，再退到更高的档位
    for (let i = preferredIndex; i < order.length; i++) {
        if (supported.includes(order[i])) {
            return order[i];
        }
    }
    for (let i = preferredIndex - 1; i >= 0; i--) {
        if (supported.includes(order[i])) {
            return order[i];
        }
    }
    return supported[0];
}

/**
 * 获取音质顺序。
 * scope 用于把顺序限制在当前插件支持的档位内（官方协议插件只有 4 档）。
 */
export function getQualityOrder(
    qualityKey: IMusic.IQualityKey,
    sort: "asc" | "desc",
    scope?: IMusic.IQualityKey[],
) {
    const keys = scope?.length ? scope : getQualityKeys();
    const idx = keys.indexOf(qualityKey);
    if (idx === -1) {
        // 目标音质不在当前列表中（如自定义列表移除了该键）：先尝试目标音质，
        // 再按排序方向尝试完整列表
        return sort === "asc"
            ? [qualityKey, ...keys]
            : [qualityKey, ...[...keys].reverse()];
    }
    const left = keys.slice(0, idx);
    const right = keys.slice(idx + 1);
    if (sort === "asc") {
        /** 优先高音质 */
        return [qualityKey, ...right, ...left.reverse()];
    } else {
        /** 优先低音质 */
        return [qualityKey, ...left.reverse(), ...right];
    }
}

/** 音质文本到标准键的映射表 */
const qualityTextToKeyMap: Record<string, IMusic.IQualityKey> = {
    // 原版插件兼容（低->标准->高->超高 映射到 128k->192k->320k->flac）
    "low": "128k",
    "standard": "192k",
    "high": "320k",
    "super": "flac",
    "低音质": "96k",
    "标准音质": "192k",
    "高音质": "320k",
    "超高音质": "flac",

    // 网易云音乐音质映射
    "臻品母带": "master",
    "臻品全景声2.0": "atmos_plus",
    "臻品全景声": "atmos",
    "臻品音质2.0": "atmos",
    "杜比全景声": "dolby",
    "Hires无损24-Bit": "hires",
    "FLAC": "flac",
    "320K": "320k",
    "192K": "192k",
    "128K": "128k",

    // QQ音乐音质映射和标准键直接映射
    "mgg": "96k",
    "flac24bit": "flac24bit",
    "flac": "flac",
    "320k": "320k",
    "192k": "192k",
    "128k": "128k",
    "master": "master",
    "dolby": "dolby",
    "atmos": "atmos",
    "atmos_plus": "atmos_plus",
    "hires": "hires",
    "vinyl": "vinyl",

    // 通用音质映射
    "无损": "flac",
    "高品质": "320k",
    "中等": "192k",
    "标准": "128k",
    "超高品质": "hires",
    "母带": "master",
    "黑胶": "vinyl",
};

/** 将API返回的音质信息转换为标准的qualities格式 */
export function convertApiQualityToQualities(apiQuality?: {
    target?: string;
    result?: string;
    size?: string | number; // 添加文件大小支持
    [key: string]: any;
}): IMusic.IQuality | undefined {
    if (!apiQuality?.result) {
        return undefined;
    }

    // 从API返回的质量文本中提取标准键
    const qualityKey = qualityTextToKeyMap[apiQuality.result];
    if (!qualityKey) {
        devLog("warn", "🎵[音质处理] 未知的音质类型", { qualityResult: apiQuality.result });
        return undefined;
    }

    // 构建qualities对象，表示该音质可用
    return {
        [qualityKey]: {
            url: undefined, // 将由插件的getMediaSource方法提供
            size: apiQuality.size, // 使用API返回的文件大小
        },
    };
}

/** 解析音质文本，返回对应的标准键 */
export function parseQualityText(inputQualityText: string): IMusic.IQualityKey | null {
    return qualityTextToKeyMap[inputQualityText] || null;
}

/**
 * 辅助函数：将插件API返回的原始音乐数据转换为包含正确qualities字段的IMusicItem
 * 这个函数主要供插件开发者使用，用于处理API返回的音质信息
 * 
 * @param rawMusicItem 插件API返回的原始音乐数据
 * @param apiQualityData API返回的音质数据，格式如: {target: "臻品母带", result: "臻品母带"}
 * @returns 包含正确qualities字段的音乐项
 */
export function transformMusicItemWithQuality<T extends Partial<IMusic.IMusicItem>>(
    rawMusicItem: T,
    apiQualityData?: { target?: string; result?: string; [key: string]: any }
): T & { qualities?: IMusic.IQuality } {
    const convertedQualities = convertApiQualityToQualities(apiQualityData);
    
    return {
        ...rawMusicItem,
        qualities: convertedQualities,
    };
}

/**
 * 增强音质信息提取 - 从多个音质选项中构建完整的qualities对象
 */
export function buildQualitiesFromArray(qualityArray: Array<{
    type: string;
    size?: string | number;
    url?: string;
    [key: string]: any;
}>): IMusic.IQuality {
    const qualities: IMusic.IQuality = {};
    
    for (const qualityInfo of qualityArray) {
        const qualityKey = qualityTextToKeyMap[qualityInfo.type];
        if (qualityKey) {
            qualities[qualityKey] = {
                url: qualityInfo.url,
                size: qualityInfo.size,
            };
        }
    }
    
    return qualities;
}

/**
 * 获取可用音质列表。
 * 从歌曲的 qualities/source 字段取实际支持的音质，再按插件协议收窄档位，
 * 精确到歌曲级别。
 */
export function getAvailableQualities(
    musicItem: IMusic.IMusicItem,
    plugin?: IPluginQualityDecl | null,
): IMusic.IQualityKey[] {
    // 档位范围由插件协议探测决定：官方协议插件只显示官方 4 档对应的内部键
    const scope = getPluginQualityScope(plugin);
    const availableQualities: IMusic.IQualityKey[] = [];

    // 第一优先级：从歌曲的 qualities 字段获取实际支持的音质（按档位从低到高）
    if (musicItem.qualities) {
        for (const quality of scope) {
            if (musicItem.qualities[quality] !== undefined) {
                availableQualities.push(quality);
            }
        }
    }

    // 第二优先级：从歌曲的 source 字段获取
    if (availableQualities.length === 0 && musicItem.source) {
        for (const quality of scope) {
            if (
                musicItem.source[quality] &&
                (musicItem.source[quality]!.url ||
                    musicItem.source[quality]!.size !== undefined)
            ) {
                availableQualities.push(quality);
            }
        }
    }

    // 最后手段：歌曲没有任何音质信息，就显示插件支持的全部档位
    if (availableQualities.length === 0) {
        return scope;
    }

    return availableQualities;
}

/**
 * 获取音质文件大小 - 支持多源获取
 */
/** Whether any quality entry already carries a usable size. */
export function musicItemHasQualitySizes(musicItem?: IMusic.IMusicItem | null): boolean {
    if (!musicItem?.qualities || typeof musicItem.qualities !== "object") {
        return false;
    }
    return Object.values(musicItem.qualities).some(entry => {
        if (!entry || typeof entry !== "object") {
            return false;
        }
        const size = (entry as { size?: unknown }).size;
        if (typeof size === "number" && Number.isFinite(size) && size > 0) {
            return true;
        }
        if (typeof size === "string" && size.trim() && size.toUpperCase() !== "N/A") {
            return true;
        }
        return false;
    });
}

export function getQualitySize(
    musicItem: IMusic.IMusicItem,
    quality: IMusic.IQualityKey,
): string | number | undefined {
    const pick = (size: unknown): string | number | undefined => {
        if (typeof size === "number" && Number.isFinite(size) && size > 0) {
            return size;
        }
        if (typeof size === "string") {
            const trimmed = size.trim();
            if (trimmed && trimmed.toUpperCase() !== "N/A") {
                return trimmed;
            }
        }
        return undefined;
    };

    // 优先从 qualities 获取
    const fromQualities = pick(musicItem.qualities?.[quality]?.size);
    if (fromQualities !== undefined) {
        return fromQualities;
    }

    // 其次从 source 获取
    const fromSource = pick(musicItem.source?.[quality]?.size);
    if (fromSource !== undefined) {
        return fromSource;
    }

    return undefined;
}

/**
 * 统一音质信息标准化处理函数
 * 将不同插件返回的音质信息转换为MusicFree标准格式
 */
export function normalizePluginQualityInfo(
    musicItem: any,
    pluginQualityMapping?: Record<string, IMusic.IQualityKey>
): IMusic.IQuality | undefined {
    // 如果已经有qualities格式，检查是否需要转换原版音质键值
    if (musicItem.qualities && typeof musicItem.qualities === "object") {
        const normalized = normalizePluginQualities(musicItem.qualities);
        if (normalized && Object.keys(normalized).length > 0) {
            return normalized;
        }
    }

    const qualities: Partial<IMusic.IQuality> = {};

    // 处理网易云音乐风格的音质信息 (低音质l, 中音质m, 高音质h, 超高音质sq)
    if (musicItem.l || musicItem.m || musicItem.h || musicItem.sq) {
        if (musicItem.l?.size) qualities["128k"] = { size: musicItem.l.size };
        if (musicItem.m?.size) qualities["192k"] = { size: musicItem.m.size };
        if (musicItem.h?.size) qualities["320k"] = { size: musicItem.h.size };
        if (musicItem.sq?.size) qualities.flac = { size: musicItem.sq.size };
    }

    // 处理QQ音乐/酷狗风格的音质数组
    if (Array.isArray(musicItem.qualityList)) {
        for (const qualityInfo of musicItem.qualityList) {
            const standardKey = qualityTextToKeyMap[qualityInfo.type] ||
                               pluginQualityMapping?.[qualityInfo.type];
            if (standardKey) {
                qualities[standardKey] = {
                    url: qualityInfo.url,
                    size: qualityInfo.size || qualityInfo.fileSize,
                };
            }
        }
    }

    // 处理命名键值对格式 (如 {low: {size: 123}, standard: {size: 456}})
    const namedQualityKeys = ["low", "standard", "high", "super"];
    for (const key of namedQualityKeys) {
        if (musicItem[key] && typeof musicItem[key] === "object") {
            const standardKey = qualityTextToKeyMap[key];
            if (standardKey && musicItem[key].size) {
                qualities[standardKey] = {
                    size: musicItem[key].size,
                    url: musicItem[key].url,
                };
            }
        }
    }

    return Object.keys(qualities).length > 0 ? qualities as IMusic.IQuality : undefined;
}

/**
 * 插件音乐项标准化处理
 * 确保插件返回的音乐项包含正确的qualities字段
 */
export function normalizePluginMusicItem<T extends Partial<IMusic.IMusicItem>>(
    rawMusicItem: T,
    pluginQualityMapping?: Record<string, IMusic.IQualityKey>
): T & { qualities?: IMusic.IQuality } {
    const normalizedQualities = normalizePluginQualityInfo(
        rawMusicItem,
        pluginQualityMapping,
    );

    // Do not assign qualities: undefined — that wipes plugin-provided sizes.
    if (normalizedQualities) {
        return {
            ...rawMusicItem,
            qualities: normalizedQualities,
        };
    }
    return { ...rawMusicItem };
}
