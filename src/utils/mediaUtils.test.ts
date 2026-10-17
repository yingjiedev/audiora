// mediaUtils 经由 commonConst 牵出 utils/motion → react-native-reanimated，
// 后者的 ESM 产物在 Jest 下无法被 transform。这里只用到纯函数，把动效模块挡掉。
jest.mock("@/utils/motion", () => ({
    cubicBezier: jest.fn(() => jest.fn()),
    motionDuration: jest.fn(() => 200),
    motionEasing: {
        decelerate: jest.fn(),
        accelerate: jest.fn(),
        standard: jest.fn(),
    },
}));

import { dedupeMediaItems } from "./mediaUtils";

const item = (platform: string, id: string) =>
    ({ platform, id, title: `${platform}-${id}` } as unknown as IMusic.IMusicItem);

describe("dedupeMediaItems", () => {
    it("按 platform + id 去重，保留第一次出现的那一项", () => {
        const first = { ...item("kw", "1"), artwork: "first" } as IMusic.IMusicItem;
        const dup = { ...item("kw", "1"), artwork: "dup" } as IMusic.IMusicItem;
        const result = dedupeMediaItems([first, item("kw", "2"), dup]);

        expect(result).toHaveLength(2);
        expect(result[0].artwork).toBe("first");
    });

    it("不同 platform 的同 id 不算重复", () => {
        expect(dedupeMediaItems([item("kw", "1"), item("tx", "1")])).toHaveLength(2);
    });

    it("去重后队列里不再有能让 currentIndex 错位的重复项", () => {
        // 回归 MusicFree #657：重复项会让 createMediaIndexMap 只保留最后一个下标，
        // currentIndex 与真实位置错位后可能出现「下一首 == 当前首」的死循环
        const list = dedupeMediaItems([
            item("kw", "1"),
            item("kw", "2"),
            item("kw", "1"),
        ]);
        const keys = list.map(it => `${it.platform}@${it.id}`);

        expect(keys).toEqual(["kw@1", "kw@2"]);
        expect(new Set(keys).size).toBe(list.length);
    });

    it("空数组与无重复数组原样处理", () => {
        expect(dedupeMediaItems([])).toEqual([]);
        const list = [item("kw", "1"), item("kw", "2")];
        expect(dedupeMediaItems(list)).toEqual(list);
        expect(dedupeMediaItems(list)).not.toBe(list);
    });
});
