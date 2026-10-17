export interface IIndexMap {
    getIndexMap: () => Record<string, Record<string, number>>;
    getIndex: (mediaItem: ICommon.IMediaBase) => number;
    has: (mediaItem: ICommon.IMediaBase) => boolean;
}

/**
 * 把任意下标折叠到 [0, length) 内——播放队列是首尾相接的，最后一首的下一首是第一首。
 *
 * 比 `(index + len) % len` 更稳的地方：后者只对 `index >= -len` 成立，
 * 一旦下标被算成更小的负数（连点上一首、队列被裁剪）就会返回负下标，
 * `playList[负]` 是 undefined，切歌直接哑火。
 */
export function wrapIndex(index: number, length: number): number {
    if (length <= 0) {
        return -1;
    }
    return ((index % length) + length) % length;
}

export function createMediaIndexMap(
    mediaItems: ICommon.IMediaBase[],
): IIndexMap {
    const indexMap: Record<string, Record<string, number>> = {};

    mediaItems.forEach((item, index) => {
        // 映射中不存在
        if (!indexMap[item.platform]) {
            indexMap[item.platform] = {
                [item.id]: index,
            };
        } else {
            // 修改映射
            indexMap[item.platform][item.id] = index;
        }
    });

    function getIndexMap() {
        return indexMap;
    }

    function getIndex(mediaItem: ICommon.IMediaBase) {
        if (!mediaItem) {
            return -1;
        }
        return indexMap[mediaItem.platform]?.[mediaItem.id] ?? -1;
    }

    function has(mediaItem: ICommon.IMediaBase) {
        if (!mediaItem) {
            return false;
        }

        return indexMap[mediaItem.platform]?.[mediaItem.id] > -1;
    }

    return {
        getIndexMap,
        getIndex,
        has,
    };
}
