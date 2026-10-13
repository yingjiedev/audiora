# 夜色卡轮廓光与拾音配图（2026-10-13）

用户指出当前夜色卡与拾音照片不搭，且缺少原稿外沿受光。参考：[原稿](evidence/home-studio/studio-reference.png)，482×213；[修复前真机图](evidence/home-studio/studio-before-20261013-155408.png)，1220×2656。真机图顶部停在收藏折页已收起的位置，因此只对照主卡材质、卡沿和旁边拾音，不把折页未显示判为入口缺失。

## 修正

- 主卡原有渐变主要照亮内部，外层圆角节点会裁掉外沿效果。将主卡、折页、拾音的外沿和内容裁切分为两层，外层绘制克制的蓝灰环绕光与底部软阴影，内层保留原圆角裁切；主卡补一条细微受光边。暗卡、折页和伴随的拾音共用轮廓色。折页仍按同一透视载体完成原角度轨迹，圆角同步恢复，完全闭合时纸面与光晕一起消失。
- `elevation.featured` 只记录两层原生 boxShadow 几何，颜色来自 `useColors()` 的 `featuredRecordHalo` / `featuredRecordShadow` / `featuredRecordRim`。横向容器为模糊边和折页自由边预留上下空间；没有漂浮图案或光效动画，也没有改变播放控件的颜色含义或实际命中范围。
- 首页唱片独立为冷蓝灰石墨素材，沟槽与左下柔光直接匹配右上裁切，不再旋转播放器的黑银唱片。392rpx 圆盘的中心向上移 32rpx，露出接近原稿的弧面比例；纹理仍与标题分区。既有播放器 `player-vinyl.png` 未修改。
- 拾音上部由天空/山林图改为同冷蓝灰色系的摄影棚唱片图，左侧安静留白，右侧唱片反光；两个高度使用同一图片居中裁切。下部主题文字区、主色播放按钮、真实榜单队列及加载/禁用行为沿用现有逻辑。当前卡片仍按每次首页进入随机选择，两套最小高度不变。

## 素材记录

均由内置 image_gen 制作并在本地打开检查，生成调用附上用户实际原稿，复制最终文件进入仓库后由实际组件消费，没有通过代码画图或改写原播放器资产。

- `src/assets/imgs/home-record-studio-v1.png`，1254×1254，四角/中心孔透明。提示要求：完整正视黑胶、石墨蓝材质、细密沟槽、左下冷蓝灰柔光、透明背景、无标签/文字/场景。SHA-256 `739A7099E7FF7687A35ADAD56A5412E97321AB54C3E7204FD4F0A4209F97029E`。
- `src/assets/imgs/home-discovery-studio-v1.png`，2048×768，不透明。提示要求：宽幅冷蓝灰摄影棚、右侧透明淡蓝唱片与细沟槽、左侧留白、柔和边缘反光，适应 2.4:1 与 3.7:1 居中裁切；无天空、花草、树林、文字、按钮或 UI。

## 验证与限制

聚焦 7 套件 / 123 项通过，颜色 19 套件 / 233 项通过。新增回归确认光晕位于裁切层外、容器预留模糊边、纸页与主卡同色、内外圆角同轨迹恢复，完全闭合纸面仍清除；真实播放、收藏、拾音、随机生命周期、反向/减少动态效果及停靠原回归均保留。浅/深/自定义/透明主题的前景和持久化设置不变；颜色、UI、motion、runtime guards 通过，修改文件 ESLint 无错误/警告，扩展 TypeScript 在修改文件无诊断。全仓 lint 的既有 14 错误 / 100 警告未处理，无关自动格式化已恢复。

原生外部阴影使用现有 RN 新架构的 boxShadow，Android 9+ 支持 outset；更早版本不将光晕作为功能或可读性依赖。依据：[View Style Props](https://reactnative.dev/docs/view-style-props#boxshadow)、[BoxShadowValue](https://reactnative.dev/docs/boxshadowvalue)。本次不增加原生依赖或迁移主题设置。

Native visual QA final result: **blocked — pending user acceptance**。以上真机图为改造依据，新素材预览与自动测试不能替代修复后的原生光晕、实际裁切及折页手感验收。按仓库规则安装并确认精确版本后停止设备操作。

## 预览交付

- 应用源码 `2fc1b0c6b8106abfc7f7b11e1e01d264ff8455ec`，版本 `0.3.1-preview.i88.studio.20261013.162020` / versionCode `1791879622`，包名 `io.github.yingjiedev.audiora`，ABI arm64-v8a。后续提交只记录交付结果。
- APK `D:/audiora-previews/issue-88/Audiora-v0.3.1-preview.i88.studio.20261013.162020-arm64-v8a-release.apk`，SHA-256 `D380123C647F3CDBEB8474D66636FF3BF4D97307B905EC5A74DCC37106509A97`。干净短路径构建树、包版本/ABI、v2 单签名者及三份字体字节/哈希通过。
- 十一个 source-map 模块逐字匹配，包含新增原生外沿几何配置与语义颜色；APK Hermes bundle 与生成 bundle 字节一致。新蓝灰唱片与摄影棚宽图、原播放器 LP 三张图的可见像素哈希、尺寸和透明角与源码一致，既有播放器素材未改变。
- 与物理手机实际安装证书比对一致，`adb install -r` 返回 Success，保留数据升级自 `0.3.1-preview.i88.record.20261013.154409` / `1791877451`。`2026-10-13T16:25:19.4825146+08:00` 确认精确版本名和 code 后停止全部设备操作；没有自动启动、截屏、手势或模拟器验收。
- 明细 `D:/audiora-previews/issue-88/Audiora-v0.3.1-preview.i88.studio.20261013.162020-verification.json`。PR #105 保持 open、未合并；原生外观及手感仍为 `pending_user`。

后续按用户要求调整素材归属：浅色拾音恢复原花草图、深色拾音采用同构图月夜花草新图；摄影棚图移至前方深色听歌卡。[当前实现与交付记录](home-discovery-day-night-20261013.md)。上文描述保留为上一包的历史记录。
