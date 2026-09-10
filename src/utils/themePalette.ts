import Color from "color";

/**
 * 从背景图取主色的纯逻辑。
 *
 * 单位约定（务必遵守，否则会静默出错）：
 * color@4 里饱和度与亮度都是 **0~100**，不是 0~1。
 * - 饱和度用 `saturationl()`；`saturation()` 在 v3 起已移除，调用会抛
 *   `TypeError: c.saturation is not a function`，一旦被 try/catch 吞掉，
 *   主色就会永久退回默认色。
 * - `lightness()` 读出来是 0~100，写进去也要用 0~100。
 *   传 0.62 会得到 #010203 这种近黑色。
 *
 * 这里不依赖 React/React Native，方便直接单测。
 */

/** 中性白回落色，与 core/theme 的 customThemeDefaultPrimary 一致 */
export const NEUTRAL_FALLBACK_PRIMARY = "#F2F2F2";

/** 主导色能作为取色基准的最低饱和度 */
const MIN_DOMINANT_SATURATION = 15;
/** 主导色可用的亮度区间：再暗/再亮色相就不可信 */
const MIN_DOMINANT_LIGHTNESS = 5;
const MAX_DOMINANT_LIGHTNESS = 85;
/** 候选色被认为「有彩色」的饱和度门槛 */
const MIN_USABLE_SATURATION = 20;
/** 主导色不可用时，候选色能被选中的最低亮度 */
const MIN_USABLE_LIGHTNESS = 15;
/** 灰白图改用中性白时，亮度被收进的可读区间 */
const NEUTRAL_LIGHTNESS_MIN = 40;
const NEUTRAL_LIGHTNESS_MAX = 60;
/** 过亮/过暗时的收敛目标亮度 */
const LIGHTNESS_TOO_BRIGHT = 72;
const BRIGHT_TARGET_LIGHTNESS = 62;
const LIGHTNESS_TOO_DARK = 32;
const DARK_TARGET_LIGHTNESS = 42;
/** 与主导色的色相偏离超过这个角度就降权（度） */
const HUE_TOLERANCE = 40;

/** 极亮/极暗候选的降权系数 */
const EXTREME_LIGHTNESS_PENALTY = 0.3;
/** 色相偏离候选的降权系数 */
const HUE_DEVIATION_PENALTY = 0.4;

interface IDeriveOptions {
    /** 取不出主色时使用的回落色 */
    fallbackPrimary?: string;
}

/** 安全构造 Color，非法输入返回 null 而不是抛异常 */
function safeColor(input?: string | null): Color | null {
    if (!input || typeof input !== "string") {
        return null;
    }
    try {
        return Color(input.trim());
    } catch {
        return null;
    }
}

/** 环形色相距离，结果落在 0~180 */
function hueDistance(a: number, b: number): number {
    const diff = Math.abs((a % 360) - (b % 360));
    return Math.min(diff, 360 - diff);
}

/**
 * 挑基准色：
 * - 主导色本身有彩色且亮度可用 → 按「饱和度优先 + 极端亮度降权 + 色相偏离降权」打分
 * - 否则主导色接近黑/白/灰，色相不可信 → 退而找第一个有彩色的候选
 * - 都找不到 → 回落中性白
 */
function selectBaseColor(candidates: Color[], fallback: string): Color {
    const dominant = candidates[0];
    const dominantLightness = dominant.lightness();

    if (
        dominant.saturationl() >= MIN_DOMINANT_SATURATION &&
        dominantLightness >= MIN_DOMINANT_LIGHTNESS &&
        dominantLightness <= MAX_DOMINANT_LIGHTNESS
    ) {
        const dominantHue = dominant.hue();
        let best = dominant;
        let bestScore = -Infinity;

        for (const candidate of candidates) {
            let score = candidate.saturationl();
            const lightness = candidate.lightness();
            if (
                lightness > MAX_DOMINANT_LIGHTNESS ||
                lightness < MIN_DOMINANT_LIGHTNESS
            ) {
                score *= EXTREME_LIGHTNESS_PENALTY;
            }
            if (hueDistance(candidate.hue(), dominantHue) > HUE_TOLERANCE) {
                score *= HUE_DEVIATION_PENALTY;
            }
            if (score > bestScore) {
                bestScore = score;
                best = candidate;
            }
        }
        return best;
    }

    return (
        candidates.find(
            c =>
                c.saturationl() >= MIN_USABLE_SATURATION &&
                c.lightness() > MIN_USABLE_LIGHTNESS,
        ) ??
        safeColor(fallback) ??
        Color(NEUTRAL_FALLBACK_PRIMARY)
    );
}

/**
 * 归一化基准色：
 * - 灰白图保持黑白调，只把亮度收进可读区间（提饱和会借 hue=0 变成粉色）
 * - 过亮/过暗收进中间区间，保证主色在深浅底色上都看得清
 */
function normalizePrimary(base: Color, fallback: string): Color {
    let result = base;

    if (result.saturationl() < MIN_USABLE_SATURATION) {
        const clampedLightness = Math.min(
            Math.max(result.lightness(), NEUTRAL_LIGHTNESS_MIN),
            NEUTRAL_LIGHTNESS_MAX,
        );
        result = (safeColor(fallback) ?? Color(NEUTRAL_FALLBACK_PRIMARY))
            .lightness(clampedLightness);
    }

    const lightness = result.lightness();
    if (lightness > LIGHTNESS_TOO_BRIGHT) {
        result = result.lightness(BRIGHT_TARGET_LIGHTNESS);
    } else if (lightness < LIGHTNESS_TOO_DARK) {
        result = result.lightness(DARK_TARGET_LIGHTNESS);
    }

    return result;
}

/**
 * 从若干候选色里挑出自定义主题的主色，返回 `#RRGGBB`。
 *
 * @param candidateColors 按优先级排列的候选色，第一个被视为主导色
 * @param options.fallbackPrimary 取不出主色时的回落色
 */
export function derivePrimaryColor(
    candidateColors: Array<string | null | undefined>,
    options?: IDeriveOptions,
): string {
    const fallback =
        safeColor(options?.fallbackPrimary) ?? Color(NEUTRAL_FALLBACK_PRIMARY);

    const candidates = (candidateColors ?? [])
        .map(safeColor)
        .filter((c): c is Color => c !== null);

    if (candidates.length === 0) {
        return fallback.hex().toString();
    }

    return normalizePrimary(
        selectBaseColor(candidates, fallback),
        fallback,
    )
        .hex()
        .toString();
}
