/**
 * 连续播放失败的收敛策略。
 *
 * 背景：播放器取不到音源时会抛 INVALID_SOURCE，旧逻辑是无条件「等 500ms → 跳下一首」。
 * 插件失效 / IP 被限流 / 歌曲批量下架时，整张队列没有一首能取到源，这个循环就永远停不下来：
 * 每首先跑满音质降级预算、再（若开了换源）跑一轮跨插件搜索，然后才跳到下一首继续失败。
 * 用户看到的就是「听一阵后卡住，点下一首也没反应」——其实宿主一直在空转。
 *
 * 这里只做一件事：给「自动跳下一首」设一个连续失败上限。超过上限就不再推进，
 * 让用户拿到一个明确停下来的播放器，而不是一个假装在工作、实际在死循环的播放器。
 */

/** 连续失败多少次后停止自动跳下一首（第 N+1 次失败不再推进） */
export const DEFAULT_MAX_CONSECUTIVE_PLAY_FAIL = 3;

export default class PlayFailPolicy {
    private consecutive = 0;

    constructor(
        private readonly maxConsecutive: number = DEFAULT_MAX_CONSECUTIVE_PLAY_FAIL,
    ) {}

    /** 当前连续失败次数，仅用于日志/测试观测 */
    get consecutiveFailures() {
        return this.consecutive;
    }

    /** 有一首真的播起来了（拿到源并交给播放器）：重新计数 */
    noteSuccess(): void {
        this.consecutive = 0;
    }

    /**
     * 消费一次「自动跳下一首」的额度。
     * @returns true = 允许继续跳；false = 已经连续失败太多次，应当停下来
     */
    consumeAutoAdvance(): boolean {
        if (this.consecutive >= this.maxConsecutive) {
            return false;
        }
        this.consecutive += 1;
        return true;
    }
}
