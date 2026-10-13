# 唱片黑色底圈与外发光（2026-10-13）

用户要求补齐唱片周围两层材质：[指定原稿](evidence/home-record-ring/record-ring-reference.png)，482×213。这里的外光在唱片黑色底盘周围，不是整张卡片的外沿阴影。

## 修正

- 原透明素材只有沟槽唱片，缺少平滑哑黑底圈和底圈外光。以原素材为编辑输入、指定原稿为材质参考，生成完整的「沟槽 → 哑黑底圈 → 半透明灰蓝光 → 透明边距」单张素材。第一轮外光偏实，第二轮只修正外光饱和度和 alpha 衰减，最终使用第二轮。
- 最终 `src/assets/imgs/home-record-halo-v2.png` 为 1254×1254、2,020,522 字节；工具未按提示输出 1536。沟槽直径约画布 80%，黑底约 89%。组件采用 488rpx 完整画布，让沟槽直径约 390rpx，接近原来的 392rpx；圆心在右边缘且高于顶边 70rpx。透明绘制范围由 44%/156rpx 扩到 54%/186rpx，容纳底圈与光晕，卡片总圆角仍裁切最终轮廓。
- 不再叠加方形图片底或遮挡板。卡片高度 232rpx、48rpx 标题、真实封面/作者/来源、播放按钮、收藏页渐变、外沿阴影与折页均保留；拾音浅色原图、深色月夜花草图及每次首页的固定随机外观不变。原首页唱片和播放器素材未修改，业务控件依旧使用 useColors。

## 透明度与来源

内置 `image_gen.imagegen` 两轮编辑，最终仅 Copy-Item 进入项目，没有代码加工、裁切或缩放。生成原件：`D:/Users/yingj/.codex/generated_images/01a13447-136b-71d1-a819-3127202a1a9d/exec-83fa44bd-fd34-4d95-9a46-9c895a657506.png`。最终 SHA-256 `0C79C64E2B7A6C723CAF98430533216C344E3C46446BB8ECFDEF220B71BF23F8`。

四角与中心孔 alpha=0。左中径向采样（0 基坐标，y=627）：x=75 哑黑底圈 RGBA=29,29,28,251；外光 x=50/38/25/13 的 alpha 分别 75/39/9/1，真实半透明衰减；最外围 alpha≤2 为微量生成残迹。查看器直接展示低 alpha 的 RGB 时会显得偏蓝，不能把这种展示当作在深色卡片上的合成效果。

第一轮完整提示：

```text
Use case: precise-object-edit. Asset type: one isolated transparent PNG material for an existing music app card. Input image 1 (standalone complete graphite-blue LP) is the EDIT TARGET. Input image 2 (small UI screenshot) is ONLY a style reference for soft subtle bluish-gray exterior light around the record; absolutely do not reproduce the UI or card. Edit only the outer material layers of image 1. Preserve its perfectly centered head-on round geometry, fine concentric cool graphite-blue grooves, original polished lower-left 7-to-8-o'clock highlights and tiny transparent spindle hole. Create two clearly distinct NEW layers OUTSIDE the grooves: (1) an entirely matte black / deep charcoal backing circular disc, wider than the grooved LP, showing a broad smooth dark annulus, with no grooves or bright trim in that annulus; (2) a soft restrained blue-gray glow OUTSIDE that matte black backing circle, diffusing gently to real alpha transparency. Requested square 1536x1536 composition: grooved original LP diameter approximately 1176 pixels (76.6% of canvas), new matte backing circle diameter approximately 1320 pixels (86% of canvas), visible black annulus about 72 pixels wide on all sides; exterior blue-gray glow fades over another 40–60 pixels outside the black backing. Thus a clear visual stack is inner grooved LP -> broad black smooth ring -> subtle soft exterior bluish-gray light -> fully transparent margin. Keep the entire object circular, centered, fully visible, unclipped and perpendicular to camera. Four corners, margins and center hole genuinely alpha transparent. The halo is not neon, not a hard outline, not white stroke, not chrome trim; the matte ring must remain clearly distinguishable from both bright grooves and the exterior soft glow. No label, text, watermark, rectangular plate, card, controls, album picture, scene, white backdrop, painted checkerboard or shadow underneath a rectangle. Output only one centered isolated round vinyl assembly with genuine transparency.
```

第二轮（最终）完整提示：

```text
Use case: precise-object-edit. Image 1 is the sole edit target, a transparent isolated graphite-blue vinyl assembly. Image 2 is only a restrained material style reference; do not render its UI. Make ONE targeted correction to image 1: remove the bright solid blue annular halo, replacing it with a VERY SOFT DIFFUSE PALE BLUE-GRAY LIGHT outside the smooth black backing ring, gradually fading through alpha to fully transparent with no visible outer edge. The corrected glow must look like atmospheric studio bounce light rather than a colored physical rim: muted neutral slate gray with a slight cool blue cast, maximum alpha about 30% at the black rim, rapid feathered falloff to zero over 40–60 pixels on a 1536 square canvas. No saturated cobalt, no hard blue band, no white outline, no neon or painted flat ring. Preserve the original grooved inner record, its graphite-blue tones, its fine grooves, original lower-left bright metal reflection, center hole, head-on perfect round shape, and broad fully opaque BLACK MATTE backing annulus entirely unchanged. Reframe centered on square transparent 1536x1536 canvas with visible fully transparent margins: grooved record diameter about1176px, backing black circle about1320px, glow fades out within about1440px. Do not clip any edge of the halo. Four corners, outer margin and spindle hole must have genuine alpha=0. Single isolated circular object only, no UI, card, text, label, album picture, rectangle, checkerboard paint, background or scene. Again: outermost layer is subtle light fading to transparency, never an opaque blue solid annulus.
```

## 验证与限制

聚焦 7 套件 / 124 项、颜色 19 套件 / 234 项通过。回归确认图片有明确正方形尺寸、底部 alpha 画布在裁切范围内、绘制区没有不透明底，原真实播放、收藏、昼夜联动及完整折页继续通过。颜色/UI/motion/runtime guards、修改文件 ESLint 和 diff whitespace 通过；扩展 TypeScript 在修改文件无诊断，全仓 lint 既有 14 错误 / 100 警告未修改，无关自动格式化已恢复。

Native visual QA final result: **blocked — pending user acceptance**。指定原稿与生成素材已打开检查，alpha 数据不能替代原生合成像素、手势或自定义主题验收。按仓库规则保留数据安装并确认版本后停止设备操作。

## 预览交付

- 应用源码 `0c1d6438eaf57bc6c6b25f0e44be4a7034b2c1b3`，版本 `0.3.1-preview.i88.ring.20261013.181654` / `1791886616`，包名 `io.github.yingjiedev.audiora`，ABI arm64-v8a。后续提交只补交付记录。
- APK `D:\audiora-previews\issue-88\Audiora-v0.3.1-preview.i88.ring.20261013.181654-arm64-v8a-release.apk`，SHA-256 `F5379F670D833BCA173DAEA4F3DBDD3243BFAAB5F40AE1C3854F54F19D409ADB`。干净短路径构建源、实际包版本/ABI、v2 单签名者和三份字体字节/哈希通过。
- 十一个 source-map 模块逐字匹配，APK Hermes 与生成 bundle 字节一致；完整三层唱片、浅色原图、月夜花草图与播放器 LP 四图片可见像素、尺寸、透明度均与源码一致。包内唱片中心孔 alpha=0，哑黑底圈 RGBA=29,29,28,251，外光 alpha=75/39/9/1 五处采样与源图完全一致。
- 与实际安装证书相同，`adb install -r` 返回 Success，保留数据升级自 `0.3.1-preview.i88.resume.20261013.173748` / `1791884270`。`2026-10-13T18:21:24.5828430+08:00` 确认精确版本后停止设备操作，未自动启动、截屏、手势或模拟器验收。
- 明细 `D:\audiora-previews\issue-88\Audiora-v0.3.1-preview.i88.ring.20261013.181654-verification.json`。原生合成视觉仍 `pending_user`，PR #105 保持 open。
