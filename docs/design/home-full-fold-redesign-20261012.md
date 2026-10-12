# 首页完整折叠与图案迭代（2026-10-12）

## 用户反馈与原因

用户对已安装的 foldmotion 版本反馈：侧页折到一半停住，要求完全收到主卡背面；顶部仍单调，要求调研并重新设计，可加入图案。延续上一轮已提供的 Audiora 页面和展开、折页参考，不另造首页信息结构。

源码明确把旋转终点限制在 -68°，属于实现范围不足；增加视觉角度并没有完成真正的闭合。原本只有展开和下一张卡两个停靠位置，也无法把完整折好的听歌卡作为稳定状态。不是“手机没有显示最后一段”的推测。

## 设计依据

- [Google 的 M3 Expressive 研究](https://design.google/library/expressive-material-design-google-research)支持用有意图的色彩和形状强化视觉焦点，同时明确要求优先保证功能与可访问性。这里采用主题内的相邻强调色，并以播放为主要动作；不复制外部产品的橙红配色。
- [Apple Music 视觉指南](https://help.apple.com/itc/albummotionguide/en.lproj/static.html)强调封面延续性、静态首帧完整、文字安全区和避免躁动闪烁。这里只借鉴这些视觉原则，保留真实歌曲封面；装饰静止，折页只跟随手指，不添加自动循环动画。这不是 Apple 的合规认证。
- 听歌主卡保持用户主色，收藏侧页稍调明暗；拾音卡改为主色与用户/主题 `accentWarm` 的混色。主次卡都有明确色彩，同时继续沿用 Audiora 的字体、间距、圆角和原生图标。
- 云朵、声波和微小闪光放入各自独立的留白槽，与标题、歌手、封面和按钮分开布局，不在文字底下加纹理。中性栅格装饰不作为控制配色，不覆盖用户主题设置。

## 动作与实现

- 右侧书脊为旋转轴：一个侧页宽度的横滑完成 0° → -180°，半宽达到 -90°，到达或越过一宽后保持 -180°；负向越界保持 0°。反向拖动连续展开。
- 侧页正面在到达边缘前隐去印刷内容，侧页实体表面构成不带镜像文案的背面。依赖 RN 0.86 的 `ReactViewGroup.kt:983` 只检查子节点自己的旋转，不能依靠静态子节点的 `backfaceVisibility` 判断旋转中的父层；因此明确由同一个 UI 线程滑动值控制印刷面的淡出/恢复。主卡原生层级在侧页之上，超过书脊后侧页进入主卡背后，不覆盖真实封面、标题或播放目标。
- 加入“完整折好”的中间停靠点，保留展开和下一张拾音卡的停靠点及末尾空间。主卡左侧裁切圆角随收页渐显，收好后四角完整；始终保留原生节点，避免切换中裁切结构变化。
- 横滑及圆角依然在 Reanimated UI 线程更新；Reduce Motion 下不旋转、不加中间折叠停靠点、不使用 Android 硬件纹理。装饰使用原生 Image 的 resize 解码路径，适应小图槽，不加入 JS 帧循环。
- 折页真实收藏入口/数量/封面、主卡现播与历史播放/暂停、拾音真实榜单队列、顶部栏目选中与所有下方内容保持原有业务。

## 素材

- 内置 `imagegen` 生成；未使用 CLI/API fallback。保存为 `src/assets/imgs/home-listening-clouds-v1.png`，1254 × 1254，32 位 RGBA，角像素 alpha=0，约 728 KB。原始生成文件保留在 Codex generated_images 中；项目不引用工作区外路径。
- `HomeCardMotif` 独立槽高度 104rpx，宽度随剩余空间缩放，以 contain 显示，不裁剪或拉伸素材。decorative accessibility hidden / pointerEvents none；真实播放按钮保持独立目标。
- 最终生成 prompt：

```text
Use case: stylized-concept. Asset type: one transparent decorative illustration for Audiora, a production React Native music listening recommendation card. Create a refined lightweight abstract cluster of TWO airy rounded cloud puffs joined by THREE softly flowing narrow sound-wave ribbons, with two tiny four-point glints. Composition: horizontal cluster naturally centered in a 1024x1024 square canvas with generous transparent margin, visible cluster about 75% width and 48% height. Elegant tactile frosted paper / soft satin sculpted volume; clean polished curves, calm musical rhythm, no cartoon face. MONOCHROMATIC white and very light neutral gray only. Genuine transparent alpha background. Lighting: soft studio highlight, subtle self-shadow within forms only, no shadow outside the cluster. It will be tinted by native theme colors and displayed around 65x45 dp in empty space next to real album artwork. NO text, letters, numbers, logos, UI, device chrome, album artwork, musical-note glyphs, rectangles, colored gradient backdrop, solid background, checkerboard. Output a single individual reusable bitmap asset, not a mockup or montage.
```

实际实现保留中性素材的明暗质感，没有对位图整体 tint；主题色由卡面负责，避免把立体素材压成单色剪影。请求尺寸是生成意图，以上像素尺寸为工具实际返回值。

## 验证与验收边界

- 聚焦回归 6 suites / 85 tests，通过完整闭合、半程、反向、越界、Reduce Motion、真实收藏/播放动作、栏目连续切换、稳定数据 hooks、跳转恢复及颜色派生检查。
- 颜色回归 19 suites / 206 tests 通过；新增用户暖色为透明自定义值的边界，实际表面保持不透明且前景 >=4.5:1，不修改持久化设置。
- check:colors、check:ui、check:motion、typecheck:runtime 和 10 个修改源码文件的 ESLint 通过，没有扩大基线或豁免。完整 lint 仍有原有 14 errors / 100 warnings，两个无关自动格式化已恢复；扩展 TypeScript 在其它仓库位置仍有错误，本次修改文件无诊断。
- 素材已经直接查看，PNG 尺寸与 alpha 已读取。没有截取本包原生界面；自动回归不证明 Android GPU 遮挡、实际圆角、真实流畅度或图案的真机视觉效果。

Native visual QA final result: **blocked — pending user acceptance**。按 AGENTS.md，预览包安装到已连接的物理手机并确认精确版本后停止设备操作，用户手工验收完整收页、反向展开与顶部视觉。
