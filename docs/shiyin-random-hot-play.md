# 拾音 · 随机播放热歌 方案

> 目标：首页一键「拾音」，直接开播一批热门歌曲，不用先进榜单/歌单选。

---

## 一、主流 App 的四种做法

| 形态 | 代表 | 机制 | 本质 |
|---|---|---|---|
| **播放模式 shuffle** | 全部都有 | 对"当前列表"重排 | 重排，不选歌 |
| **电台流** | 网易云私人FM、QQ个性电台、酷狗电台 | 无列表、不可回退、边放边向服务端要下一首 | 无限流 |
| **每日推荐** | 网易云每日推荐、QQ 每日30首、Spotify Discover Weekly | 固定 N 首、可见列表、按天更新 | 批量推荐 |
| **风格延续** | 网易云心动模式/私人漫游、Spotify Radio/Autoplay | 以当前歌或红心歌为锚点做相似推荐，老歌打底 + 新歌穿插 | 相似度推荐 |

底层算法（Spotify / Apple Music）：协同过滤 + 音频特征（BPM/energy/valence）+ 歌词/乐评 NLP + 人工策展。

### 关键洞察

1. **没有一家用"真随机"**。全是"带约束的随机"：分层池 → 去重 → 打散（同歌手不相邻）→ 个性化加权。纯随机的听感是"风格乱跳"，用户会立刻关掉。
2. **热歌/榜单是冷启动兜底，不是推荐终点**。用户没行为数据时用榜单顶上；有数据后往相似度推荐走。Audiora 目前正好处在"只能做冷启动"的阶段。
3. **交互上都是一键即播**，不进二级页，且提供"换一批/不喜欢"出口。
4. **电台流的核心体验是"不用管"**：快播完时自动补歌，用户永远不需要回来点。

---

## 二、Audiora 的现实约束

### 做不了的

- 无服务端、无用户行为上报、无音频特征分析 → 协同过滤、内容相似度、NLP 全部不可行。
- 内容 100% 来自插件（音源），插件稳定性和返回结构不可控。

### 能用的

**插件能力**（`src/core/pluginManager/plugin.ts`）：
- `getTopLists(): IMusicSheetGroupItem[]` — 榜单分组列表
- `getTopListDetail(topListItem, page): ITopListInfoResult` — 榜单歌曲（分页）
- `getRecommendSheetTags()` / `getRecommendSheetsByTag(tag, page)` — 推荐歌单
- `search(...)` — 搜索

**本地行为数据**：
- `musicHistory.history` — 播放历史（默认 50 条，`core/musicHistory.ts`）
- `MusicSheet.defaultSheet` — 「我喜欢」歌单（`core/musicSheet`）
- `LocalMusicSheet.useMusicList()` — 本地音乐
- `TrackPlayer.playList / currentMusic` — 当前队列

**已有基建**：
- `MusicRepeatMode.SHUFFLE` + `lodash.shuffle`（只做重排，不够用）
- `pluginsTopListAtom` — 榜单结果缓存（jotai，`pages/topList/store/atoms.ts`）
- `TrackPlayer.playWithReplacePlayList(music, list)` / `addAll(list, beforeIndex, shouldShuffle)`
- `isSameMediaItem(a, b)` — 跨平台同曲判定

**结论**：拾音 = **榜单池 + 本地行为加权 + 打散去重**的轻量电台。不假装是算法推荐，把"热 + 不乱 + 不重复"这三件事做扎实就够了。

---

## 三、选歌算法

### 1. 建池（Pool）

```
支持 getTopLists 的已启用插件
  → 读 pluginsTopListAtom 缓存（没有才请求）
  → 从分组里挑 3~5 个"热歌型"榜单
     （title 命中：热歌 / 飙升 / 新歌 / 流行 / Top / 排行 / 榜单）
  → Promise.allSettled 拉每个榜单第 1 页
     getTopListDetail(item, 1)
  → 合并，目标池 100~300 首
```

- 每个榜单最多取前 30 首，控制请求放大。
- 单个请求 5s 超时（`Promise.race`），插件挂了就跳过，不阻塞。
- 池子在内存里缓存 5 分钟，连续点「拾音」不重复打网络。

### 2. 过滤与打分（Filter & Rank）

**过滤（硬排除）**
- 最近播放历史的前 10 首（`musicHistory.history.slice(0, 10)`）
- 当前 `TrackPlayer.playList` 里已有的
- 今天已推过的（新增 MMKV 记录，24h 滚动）

**打分（加权，不排序）**

| 信号 | 权重 |
|---|---|
| 榜单排名 rank | 基础分：越靠前越高，`1 - rank/total` |
| 多榜在榜 | 同一首出现在 k 个榜单 → ×(1 + 0.5×(k-1))，这是最强的"真热"信号 |
| 歌手命中「我喜欢」/ 历史 | ×1.6（轻量个性化，不需要算法） |
| 榜单本身权重 | 命中"飙升/热歌"关键词的榜单 ×1.3 |

### 3. 抽样（Weighted Sample）

- 按权重**加权随机抽样** 30 首（不是排序取 Top30 — 排序会让每次结果几乎一样，失去"拾"的感觉）。
- **同歌手打散**：同一 `artist` 在最终队列中至少间隔 3 首，冲突就放回重抽（最多重试 3 次）。
- 抽样后再整体 `shuffle` 一次，避免高权重歌总在前面。

### 4. 续播（Radio 化）

- 队列剩余 ≤5 首时，用同一池子（或重拉一次）补 20 首 `TrackPlayer.addAll(list)`。
- 补歌时同样执行去重 + 打散，且避开已在队列里的歌。

---

## 四、交互与落点

### 入口

首页有两套布局（`homeBody/index.tsx`，由 `theme.homeLayout` 控制）：

- **overview 布局（默认）**：`QuickAccess` 现在是横向 4 张卡（推荐歌单 / 播放历史 / 我喜欢 / 扫描本地）。建议不塞第 5 张，而是在 `HomeHero` 下面单独放一张**拾音 CTA 卡** —— 它是首页唯一的"一键开始听"动作，值得更大面积：大标题「拾音」+ 副标题「从 3 个榜单挑 30 首热门」+ 右侧圆形播放键。
- **经典布局**：`Operations` 的 2×2 grid 加第 5 个按钮（icon 用 shuffle 或新增骰子图标）。

### 点击后

1. 不跳页（可配 `basic.shiyinOpenDetail`），按钮转 loading。
2. 拿到队列后 `TrackPlayer.playWithReplacePlayList(queue[0], queue)`。
3. Toast 提示来源：`拾音 · 来自 3 个榜单的 30 首热门`。
4. 失败兜底：
   - 没有支持榜单的插件 → Toast「先到设置里启用一个音源」
   - 池子 < 10 首 → 照播但提示「可挑选的歌不多」
5. 「换一批」：CTA 卡 / 播放列表面板上一键重抽。

### 配置项（`basic.*`）

- `basic.shiyinQueueSize`（默认 30）
- `basic.shiyinExcludeRecent`（默认 true，排除最近 10 首）
- `basic.shiyinOpenDetail`（默认 false）

---

## 五、代码落点

### 新增

| 文件 | 内容 |
|---|---|
| `src/core/randomPlay.ts` | 核心：`buildHotPool()` / `scorePool()` / `sampleQueue()` / `spreadArtists()` |
| `src/core/randomPlay.test.ts` | 加权抽样、打散、去重、池子不足、插件全失败 |
| `src/pages/home/components/homeBody/useShiYin.ts` | hook：loading / error / start / reshuffle |
| `src/pages/home/components/ShiYinCard.tsx` | overview 布局的 CTA 卡 |
| 图标 | `src/assets/icons/` 加 svg，跑 `npm run generate-assets` |

### 改动

- `src/core/i18n/languages/zh-cn.json` + `en.json` + `src/types/core/i18n/index.d.ts`：`home.shiyin`、`home.shiyinSubtitle`、`home.shiyinToast`
- `homeOverview.tsx`：`QuickAccess` 下方插入 `<ShiYinCard />`
- `operations.tsx`：经典布局加第 5 个按钮
- 新增 MMKV `music.ShiYinLog`（今日已推 id + 时间戳），用 `getOrCreateMMKV`

### 复用（不要重写）

- `pluginsTopListAtom` / `useGetTopList` — 榜单缓存
- `PluginManager.getByHash(hash).methods.getTopListDetail(item, 1)`
- `musicHistory` / `MusicSheet.defaultSheet` — 行为数据
- `isSameMediaItem` — 去重
- `TrackPlayer.playWithReplacePlayList` / `addAll`

---

## 六、分期

**P0（能跑通，约 200 行）**
单插件 + 2 个热歌榜 + 各取前 30 → `isSameMediaItem` 去重 → shuffle → 播放。先验证链路和听感。

**P1（变成电台）**
多插件聚合、多榜在榜加权、排名衰减、同歌手打散、24h 已推去重、队列尾部自动补歌。

**P2（体验收口）**
「我喜欢」/ 历史歌手加权、换一批、CTA 卡视觉、配置项、播放详情页入口。

---

## 七、风险

- **插件榜单分页**：部分插件第 1 页只有 20 首，池子可能偏小 → 池子 < 30 时再拉第 2 页。
- **请求放大**：5 个榜单 = 5 次网络请求，必须限制榜单数 + 并发上限 3 + 5s 超时。
- **榜单标题不可控**：关键词匹配会漏（比如叫"飙升榜"能中，叫"抖音热歌"也能中，但英文源标题是英文）→ 关键词表要中英双语，且匹配失败时退化为"取前 N 个榜单"。
- **冷启动无历史**：新用户 history 为空、我喜欢为空 → 只有纯榜单加权，这是预期行为，P2 的个性化自动退化。
