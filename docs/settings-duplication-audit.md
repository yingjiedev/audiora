# 设置面配置级重复审计（issue #96）

本文是 issue #96 的审计产出：逐键核对设置域的**写入口数量**、**功能入口数量**与**重复实现**，
并记录本次已收敛的部分与刻意留到后续的处理。

对照的竞品做法见文末「外部参考」。

---

## 一、写入口收敛（本次已完成）

约定：**同一个配置键只允许一处写入路径**，其余调用方必须调用该处。

| 配置键 | 收敛前写入口 | 现在 | 权威写入点 |
|---|---|---|---|
| `lyric.enableWordByWord` | 设置页、面板 | **1** | `lyricManager.setWordByWordEnabled()`（`src/core/lyricManager.ts`） |
| `basic.downloadPath` | 设置页、歌词面板、下载器 | **1** | `src/core/downloadPath.ts` |
| `theme.followSystem` | 显示风格页、选择主题页 ×3 | **1** | `Theme.setFollowSystem()`（`src/core/theme.ts`） |
| `lyric.showStatusBarLyric`、`lyric.isLocked` | 设置页 ×2、面板 ×2、原生工具层、引导层 | — | **功能已移除，键一并删除**（见下节 1） |

收敛后**不再存在「合法例外」**。桌面歌词还在时，`entry/bootstrap/bootstrap.ts`（启动清标记）与
`core/lyricManager.ts`（原生回调回写用户可见状态）是仅有的两处合法例外；随着该功能移除，
两个键、原生回调订阅与那处引导层修正一起删掉了。

复核口径（`grep -n 'setConfig("<key>"' src`）：除上述权威写入点外，不应再有命中；
`basicSetting.tsx` 里传给 `createSwitch` 的 key 都带了 callback，而 `createSwitch` 在**给了 callback 时
不再自己写配置**（只调 callback），所以那些调用点不算第二个写入口。

### 1. 桌面歌词：写入口收敛后**整体移除**

收敛过程中确认了这个功能其实已经两端都不可达：

- Android：`AndroidManifest.xml` 用 `tools:node="remove"` 移除了 `SYSTEM_ALERT_WINDOW`，
  `entry/bootstrap/bootstrap.ts` 启动时还会把标记清零；
- iOS：`ios/MusicFree/LyricUtil.m` 的同名方法全是 no-op stub；
- 设置页与歌曲长按面板的相关 UI 又都被 `Platform.OS !== "android"` 挡住。

所以不再保留：`src/core/desktopLyric.ts`、原生悬浮窗实现（Android `lyricUtil/{LyricView,LyricContainerView,DesktopLyricView}.kt`、
iOS 的 stub 段）、全部相关配置键与 i18n 键，本次一并删除。保留的只有与歌词解析/解密无关不了的
`decryptKuwoLyric` / `decryptQRCLyric` 与 compact notification 的收藏动作。

收敛本身的价值保留在别处：`lyric.enableWordByWord`（逐字歌词）的写入口移到
`lyricManager.setWordByWordEnabled()`——它就在歌词解析的管理者上，写配置 + 重载当前歌词一步到位，
设置页与长按面板都调它。

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
| `lyric.fontSize` / `topPercent` / `leftPercent` / `align` / `color` / `sungColor` / `backgroundColor` / `widthPercent` / `presetIndex` / `customPresets` / `invertColors` / `isLocked` / `showStatusBarLyric` / `desktopShowTranslation` / `desktopShowRomanization` / `desktopSecondaryFontRatio` / `desktopSecondaryAlphaRatio` / `hideDesktopLyricWhenPaused` | 桌面歌词的原生状态存储（未被任何 UI 直接读写，由原生拖拽 / 预设隐式管理）。**已随桌面歌词整体移除，键从键空间删除**；老用户 MMKV 里的残留值不再被读取，无害 |
| `theme.backgroundMask` | 有入口，但仅当「背景图已配置 **且** 当前主题显示壁纸」时出现（`backgroundTuning.tsx` 提前 `return null`）。属于**条件隐藏**，不是无入口 |

---

## 四、功能多入口（本次已执行）

判定口径：**同一个动作允许多个「就近触发点」，但不允许「同一屏内重复」或「入口语义与该动作的层级不符」。**
触发点是否重复，用 `showPanel("X")` / `navigate(ROUTE_PATH.X)` 的**同一目标**是否出现在同一文件来判定。

| 功能 | 收敛前 | 现在 | 处置与依据 |
|---|---|---|---|
| 关于与更新 | 3 处（设置总览、「我的」管理卡片、「我的」资料卡） | **2 处** | 「我的」Tab 内两份纯重复，只保留权威快捷入口（管理卡片）；资料卡降级为纯展示（去掉 `Pressable`/`accessibilityRole`/`onPress`），不再作为 about 入口 |
| 定时关闭 | 3 处（设置总览、首页顶栏、歌曲菜单） | **2 处** | 权威入口 = 播放上下文（首页顶栏闹钟 + 歌曲菜单）；**设置总览中的条目移除**。定时关闭是**会话级动作**而非长期偏好（Spotify 的 Sleep Timer 同样只在 Now Playing，不进设置） |
| 备份与恢复 | 2 处（设置总览、「我的」管理卡片） | 2 处 | 保留。「我的」是跳转到**同一路由**的快捷入口，不写第二份状态 |
| 下载管理 | 2 处（设置总览、「我的」快捷卡） | **1 处** | 权威入口 = 「我的」Tab 的快捷卡（带数量与说明，信息量高于设置里的纯导航行）；**设置总览中的条目移除** |
| 音质 | 5 个调用点 | 5 个调用点 | 保留。只在两处呈「同参数重复」：`musicItemOptions.tsx` 与 `operations.tsx` 各有一次 try/catch **失败回退**（成功用增强后的 musicItem，失败用原始 musicItem），非重复；`operations.tsx:91` 是「切换当前播放音质」、另两处是「下载音质」，**动作不同** |
| 歌词 | 4 处 | 4 处 | 保留。`SearchLrc` 出现在歌曲长按菜单、歌词页、歌词操作面板，属各上下文各自的**就近操作**；`MusicItemLyricOptions` 仅 1 处入口 |

三个入口（首页顶栏、歌曲菜单、设置总览）打开的是**同一个** `showPanel("TimingClose")` ——
`components/panels/types/timingClose.tsx` 始终只有一份实现，重复的只是触发点。

`settingsOverview.tsx` 里剩下的 `download-options`（→ 基本设置的下载分组：下载目录、文件名格式等）
与 `plugin-manager`（→ 插件管理页）、`plugin-options`（→ 基本设置的插件开关组）**都不是重复**：
一个是偏好设置、一个是功能页，目标不同。同组的 `download-manager` 已在本次移除。

### 本次增量发现（不在 issue §4 范围，未处理）

`MusicLibraryOverview.tsx` 有三处 `navigate(ROUTE_PATH.LOCAL)`，其中两处语义可疑：

- `:216` 按钮文案是「扫描音乐」（`musicLibrary.scanMusic`，`accessibilityLabel` 为 `localMusic.scanLocalMusic`），
  但 `onPress` 只做 `navigate(ROUTE_PATH.LOCAL)` —— 用户落地本地页后还要再点右上角菜单才能真的扫描。
  直接修需要把 `localMusic/mainPage` 里那段 `FILE_SELECTOR + LoadingDialog + LocalMusicSheet.importLocal`
  抽成共享函数，否则会把同一流程复制成第二份（正是本 issue 要消除的问题）。
- `:231` 分类行（曲目/艺术家/专辑/文件夹）点击同样只 `navigate(ROUTE_PATH.LOCAL)`，**不带分类参数**；
  而 `browserMode` 是该组件自己的 `useState`，不跨页面，所以落地后看到的不是刚点的那一类。


---

## 五、i18n 僵尸键与硬编码中文

- 本次为设置页补入 **15 个 `basicSettings.lyric.*` 键**（三语 + `types/core/i18n/index.d.ts` 同步）。
  其中 4 个保留至今：逐字歌词 / 逐字歌词浮动动画 / 纯白模式 / 空歌词行呼吸灯特效；
  其余 11 个（桌面歌词显示翻译与罗马音、颜色反转、副行字号比例、副行透明度比例、
  自定义预设颜色对话框、桌面歌词小标题）随桌面歌词移除而删除。
- 桌面歌词移除时一并清掉 **29 个**只服务它的 i18n 键：上述 11 个新增键，加上历史键
  `showStatusBarLyric` / `hideDesktopLyricWhenPaused` / `width` / `fontSize` / `textColor` /
  `sungColor` / `backgroundColor` / `colorPreset` / `lock` / `unlock` / `align` / `leftRightDistance` /
  `topBottomDistance`，以及 `toast.noFloatWindowPermission`、
  `panel.musicItemLyricOptions.{toggle,enable,disable}DesktopLyric` 与 `desktopLyricPermissionError`。
  三语各 830 → **801** 键，键集合仍完全一致。
  注意 `basicSettings.lyric.align.{left,center,right}` 是**保留**的——它服务歌曲详情页的
  `lyric.detailAlign`，与桌面歌词无关（无后缀的 `lyric.align` 才是桌面歌词的位置对齐，已删）。
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
4. 引入「键 → 容器 → 分组」注册表，并补**入口唯一性回归测试** —— 仓库里目前没有这类测试：
   `settingsOverview.test.tsx` 只覆盖设置分组的导航行为（push 层级 / chevron / 语言选择器），
   做源码扫描的测试只有 `src/androidPolicy.test.ts`、`src/core/i18n/__tests__/languageFiles.test.ts`、
   `src/components/panels/modalTouchSafety.test.ts`；
5. `src/pages/setting/settingTypes/index.ts` 的死字段 `title`（`AppBar` 只用 `i18nKey`）删除；
6. `MusicLibraryOverview.tsx` 的本地音乐入口语义（`:216` 名为「扫描」实为跳转、`:231` 分类行不传分类参数）
   —— 见第四节「本次增量发现」，需先把扫描流程抽成共享函数再改，否则会造成新的重复实现；
7. `LyricUtil.decryptKuwoLyric` 三端均无调用者（`utils/musicDecrypter.ts` 顶部注释已说明酷我歌词由插件解密），
   可连同其辅助函数与 iOS 侧同名实现一起删除——本次为控制 diff 范围没有动它。

---

## 外部参考（竞品设置面 IA）

| 维度 | 竞品做法 | 对本项目的取舍 |
|---|---|---|
| 权威入口 | Spotify / Apple Music：持久化偏好只在设置里有一处写入口；播放页只提供「本次会话」的快捷动作（Sleep Timer 只在 Now Playing） | 采纳：持久化键单写入口 + 允许跳转型快捷入口 |
| 顶层分组 | 普遍 7–10 组、每组 3–8 项、单屏可滚 | 采纳：设置总览维持 ≤6 组、每组 ≤6 项 |
| 层级 | 最多两层；仅当某项本身是多维配置（Apple Music 的 Audio Quality 分 Wi-Fi/蜂窝/下载）才允许一层三级 | 采纳：`theme` / `backup` 这类二级页保留，不再向下加深 |
| 设置项搜索 | 主流 APP 多未提供；YouTube Music 亦无 | 暂不引入：分组数仍在可扫读范围，引入搜索反而增加维护面 |
| 无入口键 | 竞品无对应问题（配置即入口） | 采纳：无入口键要么补入口、要么从键空间移除，不留悬空键 |
