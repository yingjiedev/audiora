# Issue #36 深色模式视觉深化 — 设计方案（待确认）

> 关联 issue：https://github.com/yingjiedev/audiora/issues/36
> 基线与范围：`src/` 现状扫描结果，工作树 commit `b8609634`

## 实施状态（已按确认结果落地）

| 决策 | 结论 |
| --- | --- |
| 1. 浅色主题是否一起改 | **不改**，只补 dark 分支 |
| 2. token 命名 | **沿用** `card / surface / surfaceElevated`，只改值 |
| 3. 定时关闭的品牌紫渐变 | **保留**，只主题化底色、文字、轨道 |
| 4. 检查脚本接入范围 | **CI + pre-commit（lint-staged）一起** |
| 5. 真机截图校准 | 暂缓，合并后连设备补（PR4） |

已完成：P0 破窗修复、状态栏自适应、面板蒙层统一、深色色板层级校准、`onPrimary` 派生、硬编码防线脚本 + 基线、WCAG 对比度单测。
未完成：全页逐页走查与真机截图校准（第五节 E 清单），accent 强调色收敛（改动面大，放到走查阶段一并处理）。

---

## 一、现状诊断

### 1.1 已有基础（不用推倒重来）

- `src/core/theme.ts`：双预设（`p-light` / `p-dark`）+ 自定义主题，含 `pageBackground / card / surface / surfaceElevated / appBar / musicBar / tabBar / divider / border / mask / backdrop / placeholder` 等语义 token，外加「表面不透明度」「壁纸黑叠加归一化」「抽屉 / 弹窗不透明底色回落」等边界处理。
- `src/hooks/useColors.ts`：派生 `textSecondary / surface / border / listActive / accent*`。
- 223 个 `.tsx` 中有 104 个已接入 `useColors`，主题切换走 `GlobalState`，运行时可切、无需重启。
- `BootstrapComponent` 已监听系统 `useColorScheme` + `theme.followSystem`。

结论：**框架是对的，问题在覆盖率和色板层级本身。**

### 1.2 量化扫描

- `src/**/*.tsx` 中共 **295 处 hex 字面量**；其中 75 处在 `src/preview/WebPreview.tsx`（web 预览组件，不进 app 渲染路径，可豁免）。
- 真正会造成深色破窗的硬编码集中在 **12 个文件、约 60 处**。

按风险分级：

| 级别 | 位置 | 问题 |
| --- | --- | --- |
| P0 | `pages/setting/settingTypes/settingsOverview.tsx:96-155,179-206,234,301` | 整页浅色：`#EFF9FF`/`#F0F7FF` 卡底 + `#141B4E`/`#52627F`/`#4C6BDE` 文字 + 8 组浅色图标底 `#EDF3FF`… 深色模式下是「浅色卡片 + 浅色文字」 |
| P0 | `components/panels/types/timingClose.tsx:35-36,74-75,193-247,273` | `LinearGradient ["#FAFBFF","#F5F8FF"]` 面板底 + `#4E566B`/`#7D68E8`/`#DDE2ED`/`#E9EDF6`，标题走 `ThemeText` 默认色 → 白底白字 |
| P0 | `components/dialogs/components/setScheduleCloseTimeDialog.tsx:78-79,173,211` + style 段 | 同上：`#FAFBFF` 弹窗底、`#F3F6FE`/`#F8FAFF`/`#E7ECFA`、`#27314A`/`#7D869B` 文字 |
| P0 | `components/base/statusBar.tsx:16` | `barStyle` 硬编码 `light-content`。浅色主题 appBar 是 `#F6F9FF`，白色状态栏图标直接看不见 |
| P1 | `pages/home/components/HomeHero.tsx:37,64,116-117` | 搜索框 `#FFFFFF` 底 + `#17213E` 字，深色下孤立白块 |
| P1 | `components/downloadStatusIndicator.tsx:57-66,109,115` | iOS 系硬编码 `#007AFF`/`#34C759`/`#FF3B30`/`#666`/`#E5E5E7`，`#666` 在深色底上 3:1 不到 |
| P1 | `core/theme.ts:61-94` 色板 | 见 1.3 层级问题 |
| P1 | `components/panels/base/panelBase.tsx:277` | 蒙层默认 `maskColor ?? "#000"`，`timingClose` 又硬编码 `#131828@0.74`，两套口径 |
| P2 | `pages/musicDetail/**`（`playControl.tsx:40,129`、`seekBar.tsx:28-30,77`、`navBar.tsx:52`） | 播放页按封面动态取色，前景一律 `#FFFFFF`，缺统一 `onSurface` 判定 |
| P2 | `components/panels/types/qualityTranslation.tsx:198,245,469` | fallback `#e0e0e0`/`#d64541` |
| P2 | `components/base/badge.tsx:21-35` | VIP / 音质标签品牌色，深色底上偏暗 |
| P2 | `components/dialogs/components/markdownDialog.tsx:99-182` | fallback `#007AFF` |
| P2 | `pages/home/**` 的 `accent: "#00CDAA"`、`MyMusicOverview`、`MusicLibraryOverview` | 功能强调色写死，深色底上饱和度与亮度未校准 |

### 1.3 深色色板的层级问题（关键）

当前深色表面色（相对亮度 / 相邻对比度）：

| token | 色值 | 与下一层的对比度 |
| --- | --- | --- |
| pageBackground | `#090F1F` | — |
| appBar | `#090F1F` | **1.00:1**（与页面完全同色，无分界） |
| surface | `#111A2E` | 1.11:1 |
| card | `#121D33` | **1.03:1**（且比 surface 亮，语义反了） |
| surfaceElevated | `#192541` | 1.11:1 |
| divider | `rgba(204,220,255,0.10)` | 合成后约 1.06:1，**几乎不可见** |

叠加两个放大器：

1. `shadowColor = #000` + `shadowOpacity 0.08`（`useCardStyle`）—— 深色下阴影完全失效，层级只能靠色差，而色差只有 1.03:1。
2. `card` 比 `surface` 亮，但 `useColors` 里 `surface ?? card`、`surfaceElevated ?? card.lighten(0.24)` 又按「card 更低」推导，出现自相矛盾的层级。

---

## 二、根因

1. **没有卡口**：组件随时可以写 hex，lint / CI 都不拦。
2. **照稿实现的一次性组件直接抄了浅色像素值**（定时关闭面板、定时关闭弹窗、设置总览）。
3. **深色 elevation 体系缺失**：没有「第 n 层表面」的明度阶梯，也没有深色下的替代投影策略。
4. **跨层不统一**：原生状态栏、Modal 窗口、壁纸黑叠加各有一套口径，主题切换时容易一半更新一半不更新。

---

## 三、设计

### A. 色板与层级（改 `core/theme.ts`，只动深色）

新的深色表面阶梯（对比度目标：相邻层 ≥1.15:1，分割线 ≥1.4:1）：

| token | 现状 | 建议 | 说明 |
| --- | --- | --- | --- |
| pageBackground | `#090F1F` | `#090F1F` | 不动，避免整体观感漂移 |
| appBar | `#090F1F` | `#0C1424` | 与页面拉开，滚动时有分界 |
| surface | `#111A2E` | `#131C31` | 列表 / 行底 |
| card | `#121D33` | `#18233C` | 卡片，与页面 1.22:1 |
| surfaceElevated | `#192541` | `#212E4E` | 弹窗 / 面板，与 card 1.17:1 |
| divider | `rgba(204,220,255,0.10)` | `rgba(198,214,255,0.16)` | 可辨识的分割线 |
| border | `rgba(204,220,255,0.12)` | `rgba(198,214,255,0.20)` | 输入框/卡片描边 |

配套：

- **阴影**：`useCardStyle` 里 `shadowOpacity` 按 `dark` 提升到 `0.28`，`shadowRadius` 同步加大；`elevation` 在深色下保留（Android 会有微弱效果）。
- **派生一致性**：`useColors` 中 `surfaceElevated` 的 fallback 明度系数按 `dark` 区分，保证 `surface < card < surfaceElevated` 恒成立；可加一条单测断言这个不等式。
- **accent 收敛**：新增 `accentPalette`（或复用 `accentWarm/accentCool/success/warning/danger`），把 `homeOverview`/`MyMusicOverview`/`MusicLibraryOverview` 的 8 组写死 accent 收进来，深色下统一 `lighten(0.08~0.12)` 并做一次对比度校验。
- **浅色预设不动**（待确认，见第五节）。

### B. 硬编码治理（逐文件替换）

统一替换规则：

| 场景 | 替换 |
| --- | --- |
| 卡片/面板底色 | `colors.card` / `colors.surfaceElevated` |
| 图标彩色底 | `Color(iconColor).alpha(dark ? 0.18 : 0.12)` 动态生成 |
| 次级文字 | `colors.textSecondary`（不再写 `#7D869B` 之类） |
| 主色上的文字 | 新增 `colors.onPrimary`（按 `Color(primary).isDark()` 推导，替换现在散落的 `Color(primary).isDark() ? "white" : "black"`） |
| 蒙层 | `colors.mask`（`panelBase` 默认改用它，删掉 `timingClose` 的 `#131828`） |
| 状态色 | `colors.success / danger / info` |
| fallback | 一律改成 dark 感知的表达式 |

重点文件：

1. `settingsOverview.tsx` — 卡底 → `colors.card`；8 组 `iconBackground` 改为按 `iconColor` 派生；标题 / 副标题 / 页脚文字 → `colors.text` / `textSecondary` / `primary`。
2. `timingClose.tsx` + `setScheduleCloseTimeDialog.tsx` — 渐变底 → `[colors.surfaceElevated, colors.card]`；品牌紫渐变保留但两端色按 dark 微调；文字 / 轨道 / 滑块 → token；`maskColor` 删除，走 `colors.mask`。
3. `components/base/statusBar.tsx` — `barStyle` 改为按实际背景亮度判定：`Color(bg).isDark() ? "light-content" : "dark-content"`，兼容自定义主题与壁纸。
4. `HomeHero.tsx` — 搜索框底 → `colors.surfaceElevated`，文字 → `colors.text`。
5. `downloadStatusIndicator.tsx` — 状态色 → `colors.info/success/danger/textSecondary`。
6. `qualityTranslation.tsx` / `markdownDialog.tsx` / `badge.tsx` / `musicDetail` 前景 — 按上表替换。

### C. 切换体验（对应验收「无需重启、无明显闪烁」）

现状已支持运行时切换。风险点与对策：

- **Modal 窗口内的面板/弹窗**：PanelBase/Dialog 都在 App 树内（Portal），`useColors` 会跟着更新，无需额外处理。
- **壁纸图重载**：`setTheme` 不动 `backgroundStore`，只在 `resolveActiveBackground` 判定生效 → 已满足，不用改。
- **原生状态栏**：`barStyle` 随组件重渲染更新（B3 修完后自动正确）。
- **是否加过渡遮罩**：先真机看一次再决定。若切换时确实闪，复用 `splashImageOverlay` 的 `Animated` 思路做 120ms 淡入；不闪就不加，避免无谓复杂度。

### D. 防线（防止回潮）

1. **`scripts/check-hardcoded-colors.mjs`**：扫 `src/**/*.tsx` 的 hex 字面量；白名单（`WebPreview.tsx`、调色板、歌词预设、品牌色常量表、测试文件）；支持行内 `// color-exempt` 豁免；输出违规清单，非零退出。挂 `npm run check:colors`。
2. **对比度单测** `src/core/theme.test.ts`（或新增 `darkContrast.test.ts`）：用 WCAG 公式断言深色主题关键前景/背景组合 —— 正文 ≥4.5:1、大字与图标 ≥3:1、边框/分割线 ≥1.4:1，并断言 `surface < card < surfaceElevated` 的明度序。
3. **接入点**：`check:colors` 进 CI（与 `typecheck:runtime` 同级）；是否进 pre-commit（lint-staged）待你确认。

### E. 走查清单（对应验收「小屏 / 长文本 / 空状态 / 错误态」）

逐项过一遍：

- 状态组件：`Empty`、`ListEmpty`、`Loading`、`Toast`、`NoPlugin`、`ErrorBoundary`、`DownloadStatusIndicator`
- 弹层：`PanelBase`（54 处引用）、`panelFullscreen`、`Dialog`（9 个）、`Sheet` 类
- 页面（21 个）：首页、音乐库、歌单详情、搜索、历史、下载中、本地音乐、专辑/艺人/榜单、播放页、设置、自定义主题、文件选择、权限
- 边界：小屏（360dp 宽）、长歌名/长歌单名、空列表、加载失败、无插件、封面缺失（`placeholder`）

---

## 四、执行拆分（建议 4 个 PR）

| PR | 内容 | 依赖 |
| --- | --- | --- |
| PR1 | P0 破窗修复：settingsOverview、timingClose、setScheduleCloseTimeDialog、statusBar、HomeHero、downloadStatusIndicator | 无 |
| PR2 | 色板与层级：theme.ts 深色重排、useColors 派生、阴影 dark 策略、accent 收敛、蒙层统一 | 无（可与 PR1 并行） |
| PR3 | 防线：`check-hardcoded-colors` 脚本 + 对比度单测 + package.json / CI | PR1、PR2 |
| PR4 | 走查与真机校准：E 清单逐页过 + 截图微调 | PR1、PR2 |

每个 PR 都带：改动文件说明、验证命令（`npm run lint` / `npm test` / `npm run check:colors`）、UI 截图。

---

## 五、待确认的决策点

1. **浅色主题是否一起改？** 建议不动（避免现有浅色观感回归），只补 dark 分支。
2. **token 命名**：沿用 `card / surface / surfaceElevated` 只改值（改动面小），还是引入 `surface1/2/3` 新命名（语义更清晰但全量替换）？建议前者。
3. **定时关闭面板/弹窗这类「照稿做的浅色块」**：深色下保留品牌紫渐变、只主题化底色与文字（建议），还是彻底去品牌色？
4. **防线脚本是否进 pre-commit**（会影响每次提交耗时），还是只进 CI？
5. **真机验证**：`adb` 已装但当前无设备。你能连真机或 `npm run connect-mumu` 连 MuMu 吗？没设备的话 PR4 只能做静态 + 单测校验，截图那一项挂起。
