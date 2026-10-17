import PlayFailPolicy, {
    DEFAULT_MAX_CONSECUTIVE_PLAY_FAIL,
} from "./playFailPolicy";

describe("PlayFailPolicy", () => {
    it("默认允许连续失败 3 次，第 4 次起不再自动跳曲", () => {
        const policy = new PlayFailPolicy();

        expect(policy.consumeAutoAdvance()).toBe(true);
        expect(policy.consumeAutoAdvance()).toBe(true);
        expect(policy.consumeAutoAdvance()).toBe(true);
        // 整列都取不到源时，第 4 次必须停下来，否则就是无限空转
        expect(policy.consumeAutoAdvance()).toBe(false);
        expect(policy.consumeAutoAdvance()).toBe(false);
    });

    it("播起来一首就重新计数", () => {
        const policy = new PlayFailPolicy();

        policy.consumeAutoAdvance();
        policy.consumeAutoAdvance();
        expect(policy.consecutiveFailures).toBe(2);

        policy.noteSuccess();
        expect(policy.consecutiveFailures).toBe(0);
        expect(policy.consumeAutoAdvance()).toBe(true);
    });

    it("上限可配置，且 0 表示一次都不自动跳", () => {
        expect(new PlayFailPolicy(1).consumeAutoAdvance()).toBe(true);
        expect(new PlayFailPolicy(1).consumeAutoAdvance()).toBe(true);

        const noAuto = new PlayFailPolicy(0);
        expect(noAuto.consumeAutoAdvance()).toBe(false);
    });

    it("停在上限后不会自己恢复，直到有一次成功", () => {
        const policy = new PlayFailPolicy(2);

        expect(policy.consumeAutoAdvance()).toBe(true);
        expect(policy.consumeAutoAdvance()).toBe(true);
        expect(policy.consumeAutoAdvance()).toBe(false);
        // 中间隔了很久也不该悄悄恢复额度
        expect(policy.consumeAutoAdvance()).toBe(false);

        policy.noteSuccess();
        expect(policy.consumeAutoAdvance()).toBe(true);
    });

    it("默认上限是 3（改动这个值会影响线上行为，测试里锁住）", () => {
        expect(DEFAULT_MAX_CONSECUTIVE_PLAY_FAIL).toBe(3);
    });
});
