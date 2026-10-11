import { wrapIndex } from "./mediaIndexMap";

describe("wrapIndex", () => {
    it("队列内的下标原样返回", () => {
        expect(wrapIndex(0, 4)).toBe(0);
        expect(wrapIndex(3, 4)).toBe(3);
    });

    it("末尾的下一首回到第一首（随机播放不会停在最后一首）", () => {
        expect(wrapIndex(4, 4)).toBe(0);
        expect(wrapIndex(5, 4)).toBe(1);
    });

    it("第一首的上一首回到最后一首", () => {
        expect(wrapIndex(-1, 4)).toBe(3);
    });

    it("比 -length 更小的负数也不会越界（连点上一首时可能出现）", () => {
        // 旧写法 (index + len) % len 在这里会返回负数，playList[负] 是 undefined，切歌哑火
        expect(wrapIndex(-9, 4)).toBe(3);
        expect(wrapIndex(-10, 4)).toBe(2);
        for (let i = -20; i <= 20; i++) {
            const r = wrapIndex(i, 4);
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThan(4);
        }
    });

    it("空队列返回 -1", () => {
        expect(wrapIndex(0, 0)).toBe(-1);
    });
});
