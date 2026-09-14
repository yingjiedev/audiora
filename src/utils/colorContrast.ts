import Color from "color";

type Rgb = [number, number, number];

function toRgb(color: string): Rgb {
    const parsed = Color(color).rgb();
    return [parsed.red(), parsed.green(), parsed.blue()];
}

/**
 * 把半透明前景色合成到背景色上，得到不透明的等效色值。
 *
 * 主题里的 divider / border / mask 都是带 alpha 的，直接按原始 rgb 算亮度会
 * 高估它们在深色底上的实际亮度，所以比对之前必须先合成。
 */
export function blendOver(foreground: string, background: string): string {
    const fg = Color(foreground);
    const alpha = fg.alpha();

    if (alpha >= 1) {
        return fg.hex();
    }

    const [fr, fgc, fb] = toRgb(foreground);
    const [br, bgc, bb] = toRgb(background);
    const mixed: Rgb = [
        Math.round(fr * alpha + br * (1 - alpha)),
        Math.round(fgc * alpha + bgc * (1 - alpha)),
        Math.round(fb * alpha + bb * (1 - alpha)),
    ];

    return Color.rgb(mixed).hex();
}

/** WCAG 2.1 相对亮度，0（纯黑）到 1（纯白） */
export function relativeLuminance(color: string): number {
    const [r, g, b] = toRgb(color).map(channel => {
        const ratio = channel / 255;
        return ratio <= 0.03928
            ? ratio / 12.92
            : Math.pow((ratio + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 对比度，1 到 21 */
export function contrastRatio(colorA: string, colorB: string): number {
    const luminanceA = relativeLuminance(colorA);
    const luminanceB = relativeLuminance(colorB);
    const lighter = Math.max(luminanceA, luminanceB);
    const darker = Math.min(luminanceA, luminanceB);

    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 在某个背景色上，从候选前景色里挑对比度最高的那个。
 *
 * 主色按钮就是这样：品牌蓝在浅色主题上配白字，在深色主题里主色被调亮后
 * 白字反而只有 2.9:1，换成近黑的深色字能到 5.8:1。
 */
export function bestForeground(
    background: string,
    candidates: string[],
): string {
    let best = candidates[0];
    let bestRatio = -1;

    candidates.forEach(candidate => {
        const ratio = contrastRatio(background, candidate);
        if (ratio > bestRatio) {
            bestRatio = ratio;
            best = candidate;
        }
    });

    return best;
}
