import { getMediaUniqueKey } from "@/utils/mediaUtils";

/** Reject stale or incomplete orders instead of bringing removed songs back. */
export function reconcileQueueOrder(current: IMusic.IMusicItem[], order: IMusic.IMusicItem[]) {
    if (current.length !== order.length) {
        return null;
    }
    const byKey = new Map(current.map(item => [getMediaUniqueKey(item), item]));
    const keys = order.map(getMediaUniqueKey);
    if (byKey.size !== current.length || new Set(keys).size !== current.length || keys.some(key => !byKey.has(key))) {
        return null;
    }
    return keys.map(key => byKey.get(key)!);
}

export function moveQueueItem(items: IMusic.IMusicItem[], item: IMusic.IMusicItem, offset: number) {
    const from = items.findIndex(candidate => getMediaUniqueKey(candidate) === getMediaUniqueKey(item));
    if (from < 0 || !Number.isFinite(offset)) {
        return items;
    }
    const to = Math.max(0, Math.min(items.length - 1, from + Math.round(offset)));
    if (to === from) {
        return items;
    }
    const order = [...items];
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    return order;
}
