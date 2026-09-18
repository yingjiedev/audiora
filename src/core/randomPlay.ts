import type { Plugin } from "@/core/pluginManager";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { safeParse, safeStringify } from "@/utils/jsonUtil";

/**
 * 与 mediaUtils.getMediaUniqueKey 保持一致（platform@id）。
 * 这里不直接引用 mediaUtils，是因为它会连带拉进 commonConst →
 * react-native-reanimated，在 jest 下会因为 ESM 报
 * "Cannot use import statement outside a module"。
 */
function getMediaUniqueKey(musicItem: IMusic.IMusicItem) {
    return `${musicItem.platform}@${musicItem.id}`;
}

/**
 * 拾音：从榜单热歌里"带约束地随机"挑一批歌直接开播。
 *
 * 本项目没有服务端与用户行为数据，做不了协同过滤，所以这里是
 * 榜单池 + 本地行为加权 + 去重打散 的轻量电台：
 * 热（多榜在榜、排名靠前）、不乱（同歌手打散）、不重复（24h 内已推过的不再推）。
 */

/** 默认队列长度 */
export const SHIYIN_QUEUE_SIZE = 30;

const MAX_PLUGINS = 2;
const BOARDS_PER_PLUGIN = 3;
const MAX_BOARDS = 5;
const SONGS_PER_BOARD = 30;
const REQUEST_TIMEOUT = 5000;
const CONCURRENCY = 3;
/** 池子缓存时间：连续点击时不重复打网络 */
const POOL_TTL = 5 * 60 * 1000;
/** 已推记录的保留时间 */
const PUSHED_TTL = 24 * 60 * 60 * 1000;
/** 同一歌手在队列里的最小间隔 */
const MIN_ARTIST_GAP = 3;

/** 命中即认为是"热歌型"榜单，中英文都要覆盖 */
const HOT_BOARD_KEYWORDS = [
    "热歌",
    "飙升",
    "新歌",
    "流行",
    "热门",
    "排行",
    "榜单",
    "爆款",
    "hot",
    "rising",
    "trending",
    "new",
    "chart",
    "billboard",
    "top",
];

export interface IShiYinPoolItem {
    musicItem: IMusic.IMusicItem;
    weight: number;
    /** 出现在几个榜单里 */
    boardCount: number;
    /** 最好的名次（0 起） */
    bestRank: number;
    /** 该榜单的歌曲总数，用于排名衰减 */
    boardSize: number;
    /** 是否来自热歌型榜单 */
    boardHot: boolean;
}

export interface IShiYinResult {
    musicList: IMusic.IMusicItem[];
    /** 参与建池的榜单数 */
    boardCount: number;
    /** 参与建池的插件数 */
    pluginCount: number;
    /** 去重后的候选池大小 */
    poolSize: number;
}

export interface IShiYinOptions {
    /** 支持 getTopLists 的插件 */
    plugins: Plugin[];
    /** pluginHash -> 榜单分组，传入可复用首页已缓存的榜单数据 */
    topListCache?: Record<string, IMusic.IMusicSheetGroupItem[]>;
    /** 需要排除的歌曲，通常是最近播放 */
    excludeMusicItems?: IMusic.IMusicItem[];
    /** 偏好歌手（来自我喜欢 / 播放历史），命中会加权 */
    preferredArtists?: string[];
    /** 队列长度 */
    queueSize?: number;
    /** 忽略池子缓存，重新拉一次 */
    forceRefresh?: boolean;
    /** 随机源，测试时注入 */
    rng?: () => number;
}

interface IPoolCache {
    pool: IShiYinPoolItem[];
    boardCount: number;
    pluginCount: number;
    expireAt: number;
}

const shiyinStore = getOrCreateMMKV("music.ShiYin");
let poolCache: IPoolCache | null = null;

/** 榜单标题是否像"热歌榜" */
export function isHotBoard(title?: string) {
    if (!title) {
        return false;
    }
    const lower = title.toLowerCase();
    return HOT_BOARD_KEYWORDS.some(keyword => lower.includes(keyword));
}

/** 取主歌手：多歌手只认第一个，避免"周杰伦/xxx"被当成两个歌手 */
export function getPrimaryArtist(artist?: string) {
    if (!artist) {
        return "";
    }
    return artist.split(/[、,，/&|]/)[0].trim().toLowerCase();
}

/**
 * 从榜单分组里挑热歌型榜单：先按关键词命中，不足则按顺序补齐。
 */
export function pickHotTopLists(
    groups: IMusic.IMusicSheetGroupItem[],
    limit: number,
): IMusic.IMusicSheetItemBase[] {
    const flatten = (groups ?? []).flatMap(group => group?.data ?? []);
    const hot = flatten.filter(item => isHotBoard(item?.title));
    const rest = flatten.filter(item => !isHotBoard(item?.title));
    return [...hot, ...rest].slice(0, Math.max(0, limit));
}

/** 单曲权重：排名衰减 × 多榜在榜 × 歌手偏好 × 榜单热度 */
export function computeWeight(item: {
    bestRank: number;
    boardSize: number;
    boardCount: number;
    boardHot: boolean;
    artistPreferred: boolean;
}) {
    const rankScore =
        0.35 + 0.65 * (1 - Math.min(1, item.bestRank / Math.max(1, item.boardSize)));
    const boardBonus = 1 + 0.5 * Math.max(0, item.boardCount - 1);
    const artistBonus = item.artistPreferred ? 1.6 : 1;
    const boardBonusHot = item.boardHot ? 1.3 : 1;
    return rankScore * boardBonus * artistBonus * boardBonusHot;
}

/** 轮盘赌抽样，不放回 */
export function weightedSample<T extends { weight: number }>(
    items: T[],
    size: number,
    rng: () => number = Math.random,
): T[] {
    const candidates = [...items];
    const result: T[] = [];
    const target = Math.min(size, candidates.length);

    while (result.length < target && candidates.length) {
        const total = candidates.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
        let pickedIndex = candidates.length - 1;

        if (total > 0) {
            let cursor = rng() * total;
            for (let i = 0; i < candidates.length; i += 1) {
                cursor -= Math.max(0, candidates[i].weight);
                if (cursor <= 0) {
                    pickedIndex = i;
                    break;
                }
            }
        } else {
            pickedIndex = Math.floor(rng() * candidates.length);
        }

        result.push(candidates[pickedIndex]);
        candidates.splice(pickedIndex, 1);
    }

    return result;
}

/**
 * 同歌手打散：贪心放置，保证同一歌手之间至少隔 minGap 首；
 * 实在放不下（比如整个池子都是同一歌手）就按顺序硬塞，保证不丢歌。
 */
export function spreadByArtist<T>(
    items: T[],
    getArtist: (item: T) => string,
    minGap = MIN_ARTIST_GAP,
): T[] {
    const remaining = [...items];
    const result: T[] = [];

    while (remaining.length) {
        let placed = false;

        for (let i = 0; i < remaining.length; i += 1) {
            const artist = getArtist(remaining[i]);
            const from = Math.max(0, result.length - minGap);
            const tooClose = result
                .slice(from)
                .some(placedItem => !!artist && getArtist(placedItem) === artist);

            if (!tooClose) {
                result.push(remaining[i]);
                remaining.splice(i, 1);
                placed = true;
                break;
            }
        }

        if (!placed) {
            result.push(remaining.shift() as T);
        }
    }

    return result;
}

function withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), timeout);
        promise.then(
            value => {
                clearTimeout(timer);
                resolve(value);
            },
            error => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

async function mapWithConcurrency<T, R>(
    inputs: T[],
    limit: number,
    worker: (input: T) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(inputs.length);
    let cursor = 0;

    async function runner() {
        while (cursor < inputs.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await worker(inputs[index]);
        }
    }

    await Promise.all(
        Array.from({ length: Math.min(limit, inputs.length) }, () => runner()),
    );
    return results;
}

function getPushedKeys() {
    const raw = shiyinStore.getString("pushed");
    const parsed = safeParse(raw ?? "{}") as Record<string, number>;
    const now = Date.now();
    const alive: Record<string, number> = {};
    const keys = new Set<string>();

    Object.entries(parsed ?? {}).forEach(([key, time]) => {
        if (typeof time === "number" && now - time < PUSHED_TTL) {
            alive[key] = time;
            keys.add(key);
        }
    });
    shiyinStore.set("pushed", safeStringify(alive));

    return keys;
}

function markPushed(musicList: IMusic.IMusicItem[]) {
    const raw = shiyinStore.getString("pushed");
    const parsed = (safeParse(raw ?? "{}") ?? {}) as Record<string, number>;
    const now = Date.now();

    musicList.forEach(item => {
        parsed[getMediaUniqueKey(item)] = now;
    });
    shiyinStore.set("pushed", safeStringify(parsed));
}

/** 24h 内已推过的记录清空（换一批 / 调试用） */
export function clearPushedHistory() {
    shiyinStore.set("pushed", safeStringify({}));
    poolCache = null;
}

/** 合并多个榜单的歌曲，按 uniqueKey 去重，并累计"多榜在榜"信号 */
export function mergeBoardMusicList(
    boards: Array<{
        musicList: IMusic.IMusicItem[];
        boardHot: boolean;
    }>,
    preferredArtists: Set<string>,
): IShiYinPoolItem[] {
    const pool = new Map<string, IShiYinPoolItem>();

    boards.forEach(board => {
        const boardSize = board.musicList.length;

        board.musicList.forEach((musicItem, index) => {
            if (!musicItem?.id) {
                return;
            }
            const key = getMediaUniqueKey(musicItem);
            const existing = pool.get(key);

            if (existing) {
                existing.boardCount += 1;
                existing.bestRank = Math.min(existing.bestRank, index);
                existing.boardSize = Math.max(existing.boardSize, boardSize);
                existing.boardHot = existing.boardHot || board.boardHot;
                existing.weight = computeWeight({
                    bestRank: existing.bestRank,
                    boardSize: existing.boardSize,
                    boardCount: existing.boardCount,
                    boardHot: existing.boardHot,
                    artistPreferred: preferredArtists.has(
                        getPrimaryArtist(existing.musicItem.artist),
                    ),
                });
                return;
            }

            const artistPreferred = preferredArtists.has(
                getPrimaryArtist(musicItem.artist),
            );
            pool.set(key, {
                musicItem,
                boardCount: 1,
                bestRank: index,
                boardSize,
                boardHot: board.boardHot,
                weight: computeWeight({
                    bestRank: index,
                    boardSize,
                    boardCount: 1,
                    boardHot: board.boardHot,
                    artistPreferred,
                }),
            });
        });
    });

    return Array.from(pool.values());
}

async function buildPool(options: IShiYinOptions) {
    const plugins = (options.plugins ?? []).slice(0, MAX_PLUGINS);

    if (!plugins.length) {
        return { pool: [], boardCount: 0, pluginCount: 0 };
    }

    const boardTasks: Array<{
        plugin: Plugin;
        board: IMusic.IMusicSheetItemBase;
        boardHot: boolean;
    }> = [];

    await Promise.all(
        plugins.map(async plugin => {
            let groups = options.topListCache?.[plugin.hash];

            if (!groups?.length) {
                try {
                    groups = await withTimeout(
                        Promise.resolve(plugin.methods.getTopLists()),
                        REQUEST_TIMEOUT,
                    );
                } catch {
                    groups = [];
                }
            }

            pickHotTopLists(groups ?? [], BOARDS_PER_PLUGIN).forEach(board => {
                boardTasks.push({
                    plugin,
                    board,
                    boardHot: isHotBoard(board?.title),
                });
            });
        }),
    );

    const tasks = boardTasks.slice(0, MAX_BOARDS);
    const settled = await mapWithConcurrency(tasks, CONCURRENCY, async task => {
        try {
            const result = await withTimeout(
                Promise.resolve(
                    task.plugin.methods.getTopListDetail(task.board, 1),
                ),
                REQUEST_TIMEOUT,
            );
            return {
                pluginHash: task.plugin.hash,
                musicList: (result?.musicList ?? []).slice(0, SONGS_PER_BOARD),
                boardHot: task.boardHot,
            };
        } catch {
            return {
                pluginHash: task.plugin.hash,
                musicList: [],
                boardHot: task.boardHot,
            };
        }
    });

    const boards = settled.filter(board => board.musicList.length > 0);
    const preferredArtists = new Set(options.preferredArtists ?? []);

    return {
        pool: mergeBoardMusicList(boards, preferredArtists),
        boardCount: boards.length,
        pluginCount: new Set(boards.map(board => board.pluginHash)).size,
    };
}

/**
 * 生成拾音队列。
 */
export async function buildShiYinQueue(
    options: IShiYinOptions,
): Promise<IShiYinResult> {
    const rng = options.rng ?? Math.random;
    const queueSize = options.queueSize ?? SHIYIN_QUEUE_SIZE;
    const now = Date.now();

    if (!poolCache || poolCache.expireAt <= now || options.forceRefresh) {
        const { pool, boardCount, pluginCount } = await buildPool(options);
        poolCache = {
            pool,
            boardCount,
            pluginCount,
            expireAt: now + POOL_TTL,
        };
    }

    const { pool, boardCount, pluginCount } = poolCache;
    const excluded = new Set<string>();
    (options.excludeMusicItems ?? []).forEach(item => {
        if (item) {
            excluded.add(getMediaUniqueKey(item));
        }
    });
    getPushedKeys().forEach(key => excluded.add(key));

    const candidates = pool.filter(
        item => !excluded.has(getMediaUniqueKey(item.musicItem)),
    );

    const sampled = weightedSample(candidates, queueSize, rng);
    const spreaded = spreadByArtist(
        sampled,
        item => getPrimaryArtist(item.musicItem.artist),
    );
    const musicList = spreaded.map(item => item.musicItem);

    markPushed(musicList);

    return {
        musicList,
        boardCount,
        pluginCount,
        poolSize: pool.length,
    };
}
