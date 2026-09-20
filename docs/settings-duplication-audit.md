# 设置面配置级重复审计（issue #96）

本文是 issue #96 的审计产出：逐键核对设置域的**写入口数量**、**功能入口数量**与**重复实现**，
并记录本次已收敛的部分与刻意留到后续的处理。

对照的竞品做法见文末「外部参考」。

---

## 一、写入口收敛（本次已完成）

约定：**同一个配置键只允许一处写入路径**，其余调用方必须调用该处。
合法例外只有两类，均已在代码中注释说明：

- 引导层修正（`entry/bootstrap/bootstrap.ts`）：Android 上桌面歌词已下线，启动时清标记；
- 原生 → JS 状态同步（`core/lyricManager.ts`）：原生回调（关窗、拖拽、换预设、改字号）回写用户可见状态。

| 配置键 | 收敛前写入口 | 现在 | 权威写入点 |
|---|---|---|---|
| `lyric.showStatusBarLyric` | 设置页 ×2、面板 ×2、原生工具层（`native/lyricUtil`）、引导层 | **1** + 2 处合法例外 | `src/core/desktopLyric.ts` |
| `lyric.isLocked` | 设置页、面板 ×2、引导层 | **1** + 2 处合法例外 | `src/core/desktopLyric.ts` |
| `lyric.enableWordByWord` | 设置页、面板 | **1** | `src/core/desktopLyric.ts` |
| `basic.downloadPath` | 设置页、歌词面板、下载器 | **1** | `src/core/downloadPath.ts` |
| `theme.followSystem` | 显示风格页、选择主题页 ×3 | **1** | `Theme.setFollowSystem()`（`src/core/theme.ts`） |

「合法例外」具体是本节开头列出的两类：`entry/bootstrap/bootstrap.ts`（Android 上桌面歌词已下线，
启动时清标记）与 `core/lyricManager.ts`（原生回调回写用户可见状态），两处代码里都有注释说明。

复核口径（`grep -n 'setConfig("<key>"' src`）：除上述权威写入点与两处例外外，不应再有命中；
`basicSetting.tsx` 里传给 `createSwitch` 的 key 都带了 callback，而 `createSwitch` 在**给了 callback 时
不再自己写配置**（只调 callback），所以那些调用点不算第二个写入口。

### 1. 桌面歌词：`src/core/desktopLyric.ts`

- 原生参数快照**只在这里构造**（`buildDesktopLyricOptions`）。
  收敛前同一份 payload 被手写了 5 遍，其中 4 份键集不一致（两份漏 `color`/`sungColor`/`backgroundColor`，
  两份漏 `secondaryFontRatio`/`secondaryAlphaRatio`）——原生新增任一参数必漏改。
- 悬浮窗权限流程**只在这里实现**：权限不足 → 提示 → 跳系统设置 → 回到前台自动重试。
  收敛前设置页有 AppState 回跳重开、面板里只弹一句提示，行为不一致。
- 「开成功后立刻同步当前歌词行/播放进度」也收在一处，避免刚打开时空白。

### 2. 下载目录：`src/core/downloadPath.ts`

- `choose()`：设置页「下载目录」行用，弹目录选择器并写回配置；
- `ensure()`：下载器、歌词面板用，**已授权就复用，没有才引导选择**；
- 模块内单飞（一次只弹一个系统目录选择器），下载器里那份自建的
  `androidDirectoryRequest` 判重逻辑随之删除。

### 3. 跟随系统：`Theme.setFollowSystem()`

- 打开：写标记并立刻切到系统深色/浅色；
- 关闭：只写标记，不回退用户刚选的主题（「选了具体主题→退出跟随」由选择主题页调用）。

---

## 二、重复实现消除（本次已完成）

| 重复点 | 处理 |
|---|---|
| 背景模糊 / 透明度滑杆两份（`setCustomTheme/body.tsx`、`themeSetting/backgroundTuning.tsx`） | 抽成 `src/components/base/backgroundTuningSliders.tsx`，两处共用 |
| `basicSetting.tsx` 中 `basic.musicDetailDefault` 渲染两次（common 分组与 sheetAndAlbum 分组） | 只保留 common 分组一处 |
| `src/native/lyricUtil/index.ts`、`src/native/mp3Util/index.ts` | 全仓库零引用，而 `@/native/lyricUtil`、`@/native/mp3Util` 实际解析到同名 `.ts` 兄弟文件；`lyricUtil/index.ts` 里还藏着一处 `lyric.showStatusBarLyric` 写入 |

---

## 三、跨容器分裂与无入口配置（现状 + 待决策）

设置项分布在四类容器里，没有统一注册表：

| 容器 | 例子 |
|---|---|
| 设置页 / 二级页 | 基本设置、主题设置、备份与恢复 |
| 半屏面板 `showPanel` | 音质管理、音乐标签、WebDAV 凭证、歌词字号、缓存上限 |
| 对话框 `showDialog` | 文件命名类型、预设模板、语言 |
| 独立路由页 | `setCustomTheme` |

本次**没有**引入统一注册表（成本高、易腐化，且与本轮收敛目标不冲突，见「待办」）。
但把「有 UI 入口」与「无 UI 入口」的键区分清楚了：

| 配置键 | 结论 |
|---|---|
| `basic.pluginCacheControl` | 有迁移映射、有类型，但**全仓库无 UI 写入**，实际生效值来自 `plugin.instance.cacheControl`。判定为**悬空键**，待从键空间移除（迁移映射一并向后兼容处理） |
| `lyric.fontSize` / `topPercent` / `leftPercent` / `align` / `color` / `sungColor` / `backgroundColor` | 只读不写，全部由**原生拖拽 / 预设**隐式管理。结论：不补 UI，保留为原生状态存储（`lyric.widthPercent` 例外，设置页有滑杆） |
| `theme.backgroundMask` | 有入口，但仅当「背景图已配置 **且** 当前主题显示壁纸」时出现（`backgroundTuning.tsx` 提前 `return null`）。属于**条件隐藏**，不是无入口 |

---

## 四、功能多入口（现状，本次未改 UI）

> 下表是逐项核对出的现状与**拟定处置**。本 PR 只做写入口与重复实现层面的收敛，
> 入口的增删会改动用户可感知的导航，放在下一个 PR 单独做，避免和本次重构混在一个 diff 里。

| 功能 | 现状入口数 | 拟定处置 | 依据 |
|---|---|---|---|
| 关于与更新 | 3 处（设置总览、「我的」资料卡、「我的」管理卡片） | 权威入口 = 设置总览；「我的」Tab 内两份纯重复只保留一份（管理卡片），资料卡不再跳关于 | 同一 Tab 内两份纯重复 |
| 备份与恢复 | 2 处（设置总览、「我的」） | 权威入口 = 设置总览；「我的」为跳转到同一路由的快捷入口（不写第二份状态，保留） | 目标路由唯一 |
| 下载管理 | 2 处（设置总览、「我的」） | 同上 | 同上 |
| 定时关闭 | 3 处（设置总览、首页顶栏、歌曲菜单） | 权威入口 = 播放上下文（首页顶栏计时器 + 歌曲菜单）；设置总览中的条目移除 | 定时关闭是**会话级动作**而非长期偏好；Spotify 的 Sleep Timer 同样只存在于 Now Playing，不进设置 |

---

## 五、i18n 僵尸键与硬编码中文

- 本次为设置页补入 **15 个 `basicSettings.lyric.*` 键**（三语 + `types/core/i18n/index.d.ts` 同步），
  覆盖原先直接写死的中文字面量：逐字歌词 / 逐字歌词浮动动画 / 纯白模式 / 空歌词行呼吸灯特效 /
  桌面歌词显示翻译与罗马音 / 颜色反转 / 副行字号比例 / 副行透明度比例 / 自定义预设颜色对话框 /
  桌面歌词小标题与解锁；`basicSettings.lyric.width` 改为带 `{value}` 占位符的格式串。
- 文件命名格式、预设/自定义模板、音质管理、音乐标签设置这批文案，由**上游 PR #97** 用
  **扁平键名**（`basicSettings.fileNamingPreset` / `qualityManagement` / `musicTagSettings` …）落了地。
  本次 rebase 到 `7a6ede2a84` 时**一律采用上游键名**，撤掉自己重复定义的嵌套
  `basicSettings.fileNaming.*`，避免同一份文案挂在两个键名下分叉。
- 设置域仍存在的僵尸键（未引用且无计划复用）已确认清单，**本 PR 未删除**，
  避免与文案改动混在一个 diff 里；见「待办」。

---

## 六、待办（本次未做，按优先级）

1. 设置总览分组重排（层级 / 每组项数 / 是否引入设置项搜索）——需要先定调，见下节决策；
2. 删除设置域僵尸键：`settingsEntry.*Description` ×10、旧 `settingsGroup.{playback,download,lyrics,storage,sources,permissions,backup}`、
   `sidebar.{backToDesktop,exitApp,currentVersion}`、`toast.{artistNotSupported,albumNotSupported}`、
   `settingsOverview.*Description`、`themeSettingsIndex.*Description`；
3. 移除悬空键 `basic.pluginCacheControl`；
4. 引入「键 → 容器 → 分组」注册表，支撑入口唯一性回归测试（本轮先用源码级扫描测试兜底）；
5. `src/pages/setting/settingTypes/index.ts` 的死字段 `title`（`AppBar` 只用 `i18nKey`）删除。

---

## 外部参考（竞品设置面 IA）

| 维度 | 竞品做法 | 对本项目的取舍 |
|---|---|---|
| 权威入口 | Spotify / Apple Music：持久化偏好只在设置里有一处写入口；播放页只提供「本次会话」的快捷动作（Sleep Timer 只在 Now Playing） | 采纳：持久化键单写入口 + 允许跳转型快捷入口 |
| 顶层分组 | 普遍 7–10 组、每组 3–8 项、单屏可滚 | 采纳：设置总览维持 ≤6 组、每组 ≤6 项 |
| 层级 | 最多两层；仅当某项本身是多维配置（Apple Music 的 Audio Quality 分 Wi-Fi/蜂窝/下载）才允许一层三级 | 采纳：`theme` / `backup` 这类二级页保留，不再向下加深 |
| 设置项搜索 | 主流 APP 多未提供；YouTube Music 亦无 | 暂不引入：分组数仍在可扫读范围，引入搜索反而增加维护面 |
| 无入口键 | 竞品无对应问题（配置即入口） | 采纳：无入口键要么补入口、要么从键空间移除，不留悬空键 |
