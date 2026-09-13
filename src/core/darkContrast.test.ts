import Color from "color";
import { darkTheme } from "@/core/theme";
import {
    bestForeground,
    blendOver,
    contrastRatio,
    relativeLuminance,
} from "@/utils/colorContrast";

const dark = darkTheme.colors;

/** 与 useColors 的派生规则保持一致：次级文字 = 正文色 × 0.64 */
function secondaryTextOn(background: string) {
    return blendOver(Color(dark.text).alpha(0.64).toString(), background);
}

describe("深色主题的表面层级", () => {
    it("表面色自下而上逐层变亮", () => {
        const layers = [
            dark.pageBackground,
            dark.appBar,
            dark.surface,
            dark.card,
            dark.surfaceElevated,
        ].map(color => relativeLuminance(color as string));

        layers.slice(1).forEach((luminance, index) => {
            expect(luminance).toBeGreaterThan(layers[index]);
        });
    });

    it("相邻层之间拉开可辨识的差距", () => {
        const steps: Array<[string, string]> = [
            [dark.appBar, dark.pageBackground],
            [dark.surface, dark.appBar],
            [dark.card, dark.surface],
            [dark.surfaceElevated, dark.card],
        ];

        steps.forEach(([upper, lower]) => {
            expect(contrastRatio(upper as string, lower as string)).toBeGreaterThanOrEqual(1.03);
        });
    });

    it("分割线与边框在卡片上可辨识", () => {
        expect(
            contrastRatio(
                blendOver(dark.divider as string, dark.card),
                dark.card,
            ),
        ).toBeGreaterThanOrEqual(1.4);
        expect(
            contrastRatio(blendOver(dark.border, dark.card), dark.card),
        ).toBeGreaterThanOrEqual(1.4);
    });
});

describe("深色主题的文字对比度", () => {
    it("正文在页面底色上达到 WCAG AA", () => {
        expect(
            contrastRatio(dark.text, dark.pageBackground),
        ).toBeGreaterThanOrEqual(4.5);
    });

    it("次级文字在卡片与页面底色上达到 WCAG AA", () => {
        [dark.card, dark.pageBackground, dark.surfaceElevated].forEach(
            background => {
                expect(
                    contrastRatio(
                        secondaryTextOn(background as string),
                        background as string,
                    ),
                ).toBeGreaterThanOrEqual(4.5);
            },
        );
    });

    it("主色与状态色在卡片上可辨认", () => {
        expect(contrastRatio(dark.primary, dark.card)).toBeGreaterThanOrEqual(4.5);
        [dark.success, dark.danger, dark.info].forEach(color => {
            expect(
                contrastRatio(color as string, dark.card),
            ).toBeGreaterThanOrEqual(3);
        });
    });

    it("顶栏与播放条上的文字清晰", () => {
        expect(contrastRatio(dark.appBarText, dark.appBar)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(dark.musicBarText, dark.musicBar)).toBeGreaterThanOrEqual(4.5);
    });
});

describe("bestForeground", () => {
    it("调亮后的深色主色上取深色前景，不用对比不足的白字", () => {
        const candidates = ["#FFFFFF", "#10172D"];
        const foreground = bestForeground(dark.primary, candidates);

        expect(contrastRatio(dark.primary, foreground)).toBeGreaterThanOrEqual(4.5);
        expect(
            contrastRatio(dark.primary, foreground),
        ).toBeGreaterThanOrEqual(contrastRatio(dark.primary, "#FFFFFF"));
    });

    it("半透明前景先与背景合成再比较", () => {
        const blended = blendOver("rgba(255,255,255,0.5)", "#000000");
        expect(blended.toLowerCase()).toBe("#808080");
        expect(contrastRatio(blended, "#000000")).toBeCloseTo(5.3, 1);
    });
});
