# 首页拾音昼夜配图联动（2026-10-13）

用户要求：浅色前卡对应原浅色花草图，深色前卡对应同构图的深色花草图；将当前拾音的蓝灰摄影棚画面用于前面的深色听歌卡。

## 实现

- 首页仍只在挂载时选择一次 `window` / `record`，拾音直接消费这一外观，未另行随机或随横向滚动换图。省略 appearance 按 window 处理。
- 浅色拾音恢复 `home-discovery-window-v1.png` 原图（1942×809），文件未改动。深色拾音使用新 `home-discovery-night-v1.png`（1931×814）：保留右侧冰蓝唱片、下沿花草、右上枝叶和左侧山景，以蓝灰月夜与银蓝反光呈现，避免纯黑与霓虹。
- 蓝灰 `home-discovery-studio-v1.png` 原文件移到深色听歌卡上部摄影区域，完整读取宽幅图片后居中裁切。歌名与“继续聆听”保留在左侧不透明 `featuredRecordSurface` 区域；64% 处开始 12% 宽的同色透明过渡，图片不成为文字背景。下部真实封面、作者、来源、播放/暂停和原生受光边保留。
- 转场颜色集中派生为 `featuredRecordArtworkFade`，只用于照片接缝。图片正文区仍使用现有主题语义，收藏页继续联动深色材质；完整折页、触摸区、随机生命周期和用户持久化设置不变。旧独立唱片素材不再是 HomeHero 消费入口，播放器唱片未修改。

## 素材与提示记录

由内置 `image_gen.imagegen` 编辑；`transparent_background: false`，参考 `src/assets/imgs/home-discovery-window-v1.png`。生成后仅复制，无代码改色、裁切或缩放。打开输出检查了花叶、山景、唱片沟槽、夜色明暗与无 UI 文字。

- 最终资产：`src/assets/imgs/home-discovery-night-v1.png`，1931×814，SHA-256 `A2EF606B34A8A51AB3D1BB478AEEEB4C9B2DC1DA8A796EB9BFFE4EBA64417447`。
- 生成原件：`D:/Users/yingj/.codex/generated_images/01a133d8-8254-7bf2-b317-f97c723919f3/exec-18254bfd-8a69-4945-a12b-3dc4479eea0f.png`。
- 浅色原图 SHA-256 `8BCBEF15281A1C189EE82C840B1350AB9303436C747958359CF379ED84BC548B`；移位摄影棚原图 SHA-256 `71DB478DB38BC9BCF9815AE4829BC8E5E1CF906D9327A8BB5D4E20B5C2C0E54D`。

完整提示：

```text
Use case: lighting-weather edit. Asset type: standalone opaque artwork for a music discovery card, not UI. Edit the attached daylight artwork into a sophisticated moonlit night counterpart. Preserve the recognizable wide composition and subject relationship: large translucent icy-blue vinyl record with delicate realistic concentric grooves on the right, naturally cropped by right and lower frame; softly defocused pale flowers across the lower edges, leafy botanical foreground at far right and upper-right, calm sky and distant misty mountain silhouettes across the open left half. Change only lighting, palette and night atmosphere, keeping this same elegant photographic scene and no additional objects. New atmosphere: deep navy twilight sky and softly separated blue-gray mountains, subtle moonlight bathing the flowers and foliage, frosted silver-blue rim highlights and gentle glints across the translucent grooved record, soft atmospheric depth. Keep nuanced visible tonal detail instead of flat black; the image should look serenely luminous and expensive, with restrained cool blue, slate and silver colors, no saturated neon, no harsh or blown-white flare. Record focal center should be approximately 73% across and 65% down so its center/grooves and arc remain recognizable under centered crop from about 2.4:1 to 3.7:1. Leave substantial quiet negative space across upper-left and left-center. Output about 2048 x 864 pixels, full edge-to-edge landscape about 2.4:1. Opaque background. No moon disk or stars added, no new landscape features, no ribbons, no people, no words, letters, numbers, music notes, buttons, icons, logos, album cover, rounded card borders or UI. Do not recreate a screenshot; output only the single finished artwork.
```

## 验证

聚焦 7 套件 / 124 项通过，颜色 19 套件 / 234 项通过。新增回归覆盖默认浅图、深图、切回浅图与加载禁用保持；深卡文字独立底、同色接缝、真实播放与紧凑高度继续通过。颜色、UI、motion、runtime guards 通过；修改文件 ESLint 无错误/警告，扩展 TypeScript 在修改文件无诊断。全仓 lint 仍有既有 14 错误 / 100 警告，无关自动格式化已恢复，未扩大基线。

Native visual QA final result: **blocked — pending user acceptance**。素材已检查，原生像素与折叠手感仍待用户验收。按仓库规则安装并确认版本后停止设备操作，不自动截屏、启动或执行手势。
