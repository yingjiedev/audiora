import { moveQueueItem, reconcileQueueOrder } from "./reorderQueue";

jest.mock("@/utils/mediaUtils", () => ({ getMediaUniqueKey: (item: IMusic.IMusicItem) => `${item.platform}@${item.id}` }));

const a = { id: "a", platform: "one", title: "A", artwork: "fresh" } as IMusic.IMusicItem;
const b = { id: "b", platform: "one", title: "B" } as IMusic.IMusicItem;
const c = { id: "a", platform: "two", title: "C" } as IMusic.IMusicItem;

describe("queue reorder", () => {
    it("reorders by full identity while retaining current metadata objects", () => {
        const result = reconcileQueueOrder([a, b, c], [c, { ...a, artwork: "stale" }, b]);
        expect(result).toEqual([c, a, b]);
        expect(result![1]).toBe(a);
    });

    it.each([[[a, b]], [[a, b, b]], [[a, b, { ...c, id: "gone" }]]])("rejects incomplete, duplicate and stale orders", order => {
        expect(reconcileQueueOrder([a, b, c], order)).toBeNull();
    });

    it("rejects a current queue containing duplicate identities", () => {
        expect(reconcileQueueOrder([a, a], [a, a])).toBeNull();
    });

    it("moves in either direction and clamps both ends without mutating the queue", () => {
        const items = [a, b, c];
        expect(moveQueueItem(items, a, 100)).toEqual([b, c, a]);
        expect(moveQueueItem(items, c, -100)).toEqual([c, a, b]);
        expect(moveQueueItem(items, b, 0.6)).toEqual([a, c, b]);
        expect(items).toEqual([a, b, c]);
    });

    it("ignores cancelled or invalid movement and a song removed during dragging", () => {
        const items = [a, b];
        for (const offset of [0, NaN, Infinity, -100]) {
            expect(moveQueueItem(items, a, offset)).toBe(items);
        }
        expect(moveQueueItem(items, c, 1)).toBe(items);
    });
});
