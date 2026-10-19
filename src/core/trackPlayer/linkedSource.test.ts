import { findLinkedSource, replaceLinkedQueueItem, waitForSource } from "./linkedSource";
import { trackSourceKey } from "@/utils/trackGroup";
const a = { id: "1", platform: "A", title: "Song", artist: "Artist" } as IMusic.IMusicItem;
const b = { ...a, platform: "B" };
const c = { ...a, platform: "C" };
const source = { source: { url: "https://example.test/song" }, quality: "320k" };
const flush = async () => {
    for (let i = 0; i < 15; i += 1) await Promise.resolve();
};

describe("linked playback source resolution", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        expect(jest.getTimerCount()).toBe(0); jest.useRealTimers();
    });
    it("tries each original source once, skips a failed member and handles errors", async () => {
        const attempted = new Set([trackSourceKey(a)]);
        const resolve = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(source);
        const result = await findLinkedSource([a, b, b, c], resolve, () => true, attempted);
        expect(resolve.mock.calls.map(call => call[0])).toEqual([b, c]);
        expect(result?.item).toBe(c);
        expect(await findLinkedSource([a, b, c], resolve, () => true, attempted)).toBe(null);
    });
    it("moves past a hung source and ignores its eventual response", async () => {
        let finish!: (value: typeof source) => void;
        const resolve = jest.fn().mockImplementationOnce(() => new Promise(yes => {
            finish = yes;
        })).mockResolvedValueOnce(source);
        const result = findLinkedSource([a, b], resolve, () => true, new Set(), 100, 50);
        await flush(); jest.advanceTimersByTime(50); await flush();
        expect((await result)?.item).toBe(b);
        finish(source); await flush();
        expect(resolve).toHaveBeenCalledTimes(2);
    });
    it("stops promptly on navigation and cannot apply a late successful response", async () => {
        let active = true;
        let finish!: (value: typeof source) => void;
        const resolve = jest.fn(() => new Promise<typeof source>(yes => {
            finish = yes;
        }));
        const result = findLinkedSource([a, b], resolve, () => active, new Set());
        await flush(); active = false; jest.advanceTimersByTime(50);
        expect(await result).toBe(null);
        finish(source); await flush(); expect(resolve).toHaveBeenCalledTimes(1);
    });
    it("uses a total time budget across sources", async () => {
        const resolve = jest.fn(() => new Promise<null>(() => {}));
        const result = findLinkedSource([a, b, c], resolve, () => true, new Set(), 75, 50);
        await flush(); jest.advanceTimersByTime(50); await flush(); jest.advanceTimersByTime(25); await flush();
        expect(await result).toBe(null); expect(resolve).toHaveBeenCalledTimes(2);
    });
    it("preserves queue position and ordering markers while replacing all source metadata", () => {
        const order = Symbol.for("sort-index");
        const original = { ...a, privateA: "old", [order]: 3 };
        const next = { ...b, privateB: "new" };
        const other = { ...c, title: "Other" };
        const result = replaceLinkedQueueItem([other, original, b], a, next);
        expect(result).toHaveLength(2);
        expect(result[0]).toBe(other);
        expect(result[1]).toMatchObject({ platform: "B", privateB: "new", [order]: 3 });
        expect(result[1].privateA).toBeUndefined();
        expect(original.platform).toBe("A");
    });
    it("does not start work for a cancelled request", async () => {
        const resolve = jest.fn(async () => source);
        expect(await waitForSource(resolve, () => false, 100)).toBe(null);
        expect(resolve).not.toHaveBeenCalled();
    });
});
