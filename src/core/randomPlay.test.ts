import {
    computeWeight,
    getPrimaryArtist,
    isHotBoard,
    mergeBoardMusicList,
    pickHotTopLists,
    spreadByArtist,
    weightedSample,
} from "@/core/randomPlay";

function makeMusic(id: string, artist: string, platform = "test") {
    return {
        id,
        platform,
        artist,
        title: `title-${id}`,
        duration: 100,
    } as IMusic.IMusicItem;
}

function makeGroup(title: string, ids: string[]) {
    return {
        title,
        data: ids.map(
            id => ({ id, title: `${title}-${id}` }) as IMusic.IMusicSheetItemBase,
        ),
    } as IMusic.IMusicSheetGroupItem;
}

describe("拾音 - 榜单筛选", () => {
    it("识别中英文热歌榜标题", () => {
        expect(isHotBoard("热歌榜")).toBe(true);
        expect(isHotBoard("飙升榜")).toBe(true);
        expect(isHotBoard("Billboard Hot 100")).toBe(true);
        expect(isHotBoard("网络歌曲榜")).toBe(false);
        expect(isHotBoard(undefined)).toBe(false);
    });

    it("热歌型榜单优先，且受 limit 限制", () => {
        const groups = [
            makeGroup("影视金曲", ["a"]),
            makeGroup("热歌榜", ["b"]),
            makeGroup("新歌榜", ["c"]),
            makeGroup("民谣榜", ["d"]),
        ];

        expect(pickHotTopLists(groups, 2).map(item => item.id)).toEqual(["b", "c"]);
        expect(pickHotTopLists(groups, 3).map(item => item.id)).toEqual([
            "b",
            "c",
            "a",
        ]);
    });

    it("榜单数据为空时返回空数组", () => {
        expect(pickHotTopLists([], 3)).toEqual([]);
    });
});

describe("拾音 - 歌手归一化", () => {
    it("多歌手只取第一个并转小写", () => {
        expect(getPrimaryArtist("周杰伦/杨瑞代")).toBe("周杰伦");
        expect(getPrimaryArtist("Eason, Chan")).toBe("eason");
        expect(getPrimaryArtist("")).toBe("");
        expect(getPrimaryArtist(undefined)).toBe("");
    });
});

describe("拾音 - 权重", () => {
    const base = {
        bestRank: 0,
        boardSize: 100,
        boardCount: 1,
        boardHot: false,
        artistPreferred: false,
    };

    it("排名越靠前权重越高", () => {
        expect(computeWeight(base)).toBeGreaterThan(
            computeWeight({ ...base, bestRank: 50 }),
        );
    });

    it("多榜在榜会加权", () => {
        expect(computeWeight({ ...base, boardCount: 3 })).toBeGreaterThan(
            computeWeight(base),
        );
    });

    it("命中偏好歌手与热歌榜都会加权", () => {
        expect(computeWeight({ ...base, artistPreferred: true })).toBeGreaterThan(
            computeWeight(base),
        );
        expect(computeWeight({ ...base, boardHot: true })).toBeGreaterThan(
            computeWeight(base),
        );
    });
});

describe("拾音 - 加权抽样", () => {
    it("抽样数量不超过候选数，且不重复", () => {
        const items = Array.from({ length: 10 }, (_, index) => ({
            id: index,
            weight: index + 1,
        }));
        const picked = weightedSample(items, 4);

        expect(picked).toHaveLength(4);
        expect(new Set(picked.map(item => item.id)).size).toBe(4);
    });

    it("候选不足时全量返回", () => {
        const items = [
            { id: 1, weight: 1 },
            { id: 2, weight: 1 },
        ];

        expect(weightedSample(items, 30)).toHaveLength(2);
    });

    it("权重悬殊时高权重项占多数", () => {
        const items = [
            { id: "low", weight: 0.001 },
            { id: "high", weight: 1000 },
        ];
        let highCount = 0;

        for (let i = 0; i < 20; i += 1) {
            const [first] = weightedSample(items, 1);
            if (first.id === "high") {
                highCount += 1;
            }
        }

        expect(highCount).toBeGreaterThan(15);
    });

    it("注入的随机源可复现", () => {
        const items = Array.from({ length: 6 }, (_, index) => ({
            id: index,
            weight: index + 1,
        }));
        const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
        const makeRng = () => {
            let cursor = 0;
            return () => seq[cursor++ % seq.length];
        };

        expect(weightedSample(items, 3, makeRng())).toEqual(
            weightedSample(items, 3, makeRng()),
        );
    });

    it("权重全为 0 时仍能抽出结果", () => {
        const items = [
            { id: 1, weight: 0 },
            { id: 2, weight: 0 },
        ];

        expect(weightedSample(items, 2)).toHaveLength(2);
    });
});

describe("拾音 - 同歌手打散", () => {
    it("同一歌手间隔不小于 3", () => {
        const items = Array.from({ length: 12 }, (_, index) => ({
            id: index,
            artist: `artist-${index % 3}`,
        }));
        const result = spreadByArtist(items, item => item.artist);
        const positions = new Map<string, number[]>();

        result.forEach((item, index) => {
            const list = positions.get(item.artist) ?? [];
            list.push(index);
            positions.set(item.artist, list);
        });

        positions.forEach(list => {
            list.slice(1).forEach((position, index) => {
                expect(position - list[index]).toBeGreaterThanOrEqual(3);
            });
        });
    });

    it("同一歌手占多数时也不会丢歌", () => {
        const items = Array.from({ length: 5 }, (_, index) => ({
            id: index,
            artist: "same",
        }));

        expect(spreadByArtist(items, item => item.artist)).toHaveLength(5);
    });
});

describe("拾音 - 建池去重", () => {
    it("跨榜单同一首歌会累计在榜数量并提高权重", () => {
        const shared = makeMusic("shared", "周杰伦");
        const pool = mergeBoardMusicList(
            [
                {
                    boardHot: true,
                    musicList: [shared, makeMusic("only-a", "林俊杰")],
                },
                {
                    boardHot: true,
                    musicList: [makeMusic("only-b", "陈奕迅"), shared],
                },
            ],
            new Set<string>(),
        );

        expect(pool).toHaveLength(3);
        const sharedItem = pool.find(
            item => item.musicItem.id === "shared",
        );
        expect(sharedItem?.boardCount).toBe(2);
        expect(sharedItem?.boardHot).toBe(true);

        const single = pool.find(item => item.musicItem.id === "only-a");
        expect(sharedItem!.weight).toBeGreaterThan(single!.weight);
    });

    it("偏好歌手会体现在权重里", () => {
        const pool = mergeBoardMusicList(
            [
                {
                    boardHot: false,
                    musicList: [
                        makeMusic("a", "周杰伦"),
                        makeMusic("b", "陌生人"),
                    ],
                },
            ],
            new Set(["周杰伦"]),
        );

        const preferred = pool.find(item => item.musicItem.id === "a");
        const normal = pool.find(item => item.musicItem.id === "b");
        expect(preferred!.weight).toBeGreaterThan(normal!.weight);
    });

    it("忽略没有 id 的脏数据", () => {
        const pool = mergeBoardMusicList(
            [
                {
                    boardHot: false,
                    musicList: [
                        { platform: "test", title: "no-id" } as IMusic.IMusicItem,
                        makeMusic("valid", "周杰伦"),
                    ],
                },
            ],
            new Set<string>(),
        );

        expect(pool).toHaveLength(1);
        expect(pool[0].musicItem.id).toBe("valid");
    });
});
