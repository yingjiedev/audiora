import Color from "color";
import {
    derivePrimaryColor,
    NEUTRAL_FALLBACK_PRIMARY,
} from "@/utils/themePalette";

const hslOf = (hex: string) => {
    const c = Color(hex);
    return {
        hue: c.hue(),
        saturation: c.saturationl(),
        lightness: c.lightness(),
    };
};

describe("derivePrimaryColor", () => {
    describe("取色可用（成功路径）", () => {
        it("常见饱和色保持原色，不再被压成近黑", () => {
            // 回归：旧实现把 lightness 当 0~1 用，#4A90D9 会变成 #010203
            expect(derivePrimaryColor(["#4A90D9"])).toBe("#4A90D9");
        });

        it("主导色可用时，色相偏离过大且更饱和的候选被降权", () => {
            // 蓝黑图的 vibrant 常被 Palette 抠成只占极小面积的橙色
            const result = derivePrimaryColor([
                "#1B2A3A",
                "#E8722C",
                "#2C3E50",
            ]);
            const { hue } = hslOf(result);
            // 选中主导色的蓝调，而不是橙色（hue ≈ 22）
            expect(Math.abs(hue - 211)).toBeLessThan(10);
        });

        it("过暗的主色被收进可读区间", () => {
            const result = derivePrimaryColor(["#1B2A3A"]);
            expect(result).toBe("#446A92");
            expect(hslOf(result).lightness).toBeCloseTo(42, 0);
        });

        it("过亮的主色被收进可读区间", () => {
            const result = derivePrimaryColor(["#FFD1DC"]);
            expect(hslOf(result).lightness).toBeCloseTo(62, 0);
        });
    });

    describe("灰白/无彩色（主导色不可用）", () => {
        it("纯白图保留中性灰，不会出现纯白主色", () => {
            const result = derivePrimaryColor(["#FFFFFF"]);
            expect(result).toBe("#999999");
        });

        it("纯黑图保留中性灰，不会原样返回黑色", () => {
            const result = derivePrimaryColor(["#000000"]);
            expect(result).toBe("#999999");
        });

        it("中性灰结果不含色相（r=g=b），不会被提饱和成粉色", () => {
            const result = derivePrimaryColor(["#808080"]);
            const c = Color(result);
            expect(c.red()).toBe(c.green());
            expect(c.green()).toBe(c.blue());
        });
    });

    describe("取色失败 / 边界", () => {
        it("候选为空时回落到中性白", () => {
            expect(derivePrimaryColor([])).toBe(NEUTRAL_FALLBACK_PRIMARY);
        });

        it("候选全为非法值时回落到中性白", () => {
            expect(
                derivePrimaryColor(["not-a-color", null, undefined, ""]),
            ).toBe(NEUTRAL_FALLBACK_PRIMARY);
        });

        it("部分候选非法时忽略它们，用剩下的取色", () => {
            expect(derivePrimaryColor(["bogus", "#4A90D9"])).toBe("#4A90D9");
        });

        it("回落色可由调用方指定", () => {
            expect(
                derivePrimaryColor([], { fallbackPrimary: "#123456" }),
            ).toBe("#123456");
        });

        it("灰度候选使用调用方指定的回落色", () => {
            const result = derivePrimaryColor(["#808080"], {
                fallbackPrimary: "#345678",
            });

            expect(hslOf(result).hue).toBeCloseTo(
                hslOf("#345678").hue,
                0,
            );
        });

        it("回落色本身非法时兜底到中性白而不是抛异常", () => {
            expect(
                derivePrimaryColor([], { fallbackPrimary: "bogus" }),
            ).toBe(NEUTRAL_FALLBACK_PRIMARY);
        });

        it("全部候选都返回 #RRGGBB 格式，不再是 rgb(...)", () => {
            for (const input of [["#4A90D9"], ["#1B2A3A"], ["#FFD1DC"]]) {
                expect(derivePrimaryColor(input)).toMatch(/^#[0-9A-F]{6}$/);
            }
        });
    });

    describe("阈值边界", () => {
        it("亮度恰在上限 72 不调整，超过则收敛到 62", () => {
            const atLimit = Color.hsl(210, 60, 72).hex().toString();
            const overLimit = Color.hsl(210, 60, 73).hex().toString();

            expect(hslOf(derivePrimaryColor([atLimit])).lightness).toBeCloseTo(
                72,
                0,
            );
            expect(
                hslOf(derivePrimaryColor([overLimit])).lightness,
            ).toBeCloseTo(62, 0);
        });

        it("亮度恰在下限 32 不调整，低于则收敛到 42", () => {
            const atLimit = Color.hsl(210, 60, 32).hex().toString();
            const underLimit = Color.hsl(210, 60, 31).hex().toString();

            expect(hslOf(derivePrimaryColor([atLimit])).lightness).toBeCloseTo(
                32,
                0,
            );
            expect(
                hslOf(derivePrimaryColor([underLimit])).lightness,
            ).toBeCloseTo(42, 0);
        });

        it("主导色达到饱和度门槛（15）时，在候选里按饱和度择优", () => {
            const dominant = Color.hsl(210, 16, 50).hex().toString();
            const saturated = Color.hsl(210, 70, 50).hex().toString();

            const result = derivePrimaryColor([dominant, saturated]);
            const { hue, saturation } = hslOf(result);

            expect(hue).toBeCloseTo(210, 0);
            expect(saturation).toBeGreaterThan(60);
        });
    });
});
