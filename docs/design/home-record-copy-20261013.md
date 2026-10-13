# 首页夜色听歌卡：文字换位与长歌名滚动

2026-10-13，按用户提供的两张当前首页截图调整夜色卡片四个文字位置。长歌名原来进入两行大标题，会改变卡片高度、收藏侧页和同行拾音的高度。修改前证据见 [长歌名实机截图](evidence/home-record-copy/before-20261013-190507.png)。该图不能作为新包视觉验收。

| 位置 | 修改前 | 修改后 |
| --- | --- | --- |
| 主卡左上小标签 | 继续聆听 | 实际插件显示名；无歌曲时显示本地音乐 |
| 原大歌名位置 | 歌名，48rpx、最多两行 | 继续聆听，40rpx、单行 |
| 封面右侧第一行 | 演唱者 | 实际歌名，单行，超宽时循环横向滚动 |
| 封面右侧第二行 | 插件名 | 演唱者，单行 |

歌名复用底部播放器 `MarqueeText`，使用与原演唱者相同的 `tag` 字号并加半粗。短歌名静止；超出实测可用宽度后以恒定速度滚动；切换歌名/字号/字重时归零并重新测量，忽略旧测量事件。应用后台与减少动态效果设置下停止滚动。滚动文本不占用触摸事件，卡片仍提供完整歌名的无障碍标签，播放、暂停和打开播放器仍使用原动作。

本轮仅调整截图对应的夜色主卡文字，沿用现有渐变、黑胶底圈/外光、收藏折页及拾音配图。浅色视窗布局、随机外观、主题设置、歌曲数据和折叠手势不改动；没有新增颜色、图片或占位歌名。

## 验证

- 聚焦 HomeHero / HomeFeatureDeck / MarqueeText / playerDock / musicInfo：5 套件 / 78 项通过。新回归覆盖完整长歌名传入滚动组件、原歌曲播放、切歌重测、字号/字重重测、长转短时停止滚动，既有前后台/减少动态效果行为保持。
- 完整颜色测试 19 套件 / 238 项通过；`check:colors`（硬编码 0，基线 0）、`check:ui`、`typecheck:runtime`、修改文件 ESLint（0 错误 / 0 警告）、diff whitespace 通过。
- 全仓 `npm run lint` 仍有既有 14 错误 / 100 警告；无关自动格式化已恢复。扩展 JSX/互操作/module/target 参数的 TypeScript 检查中，本轮四个修改文件诊断为零，全仓仍有既有诊断；未宣称全仓类型检查或全仓 Jest 通过。
- Native visual QA final result: **blocked — pending user acceptance**。保留数据安装且确认版本后停止设备操作，由用户验收原生滚动、圆角、触摸和长/短歌名效果。

## 预览交付

- 应用源码 `0bff44b55462f35bceaf798ffc3433497cda6f30`；`npm run build-preview -- -PreviewVersion 0.3.1-preview.i88.copy.20261013.191710`。后续提交仅补交付记录。
- 包名 `io.github.yingjiedev.audiora`，版本 `0.3.1-preview.i88.copy.20261013.191710` / `1791890231`，ABI arm64-v8a。
- APK `D:/audiora-previews/issue-88/Audiora-v0.3.1-preview.i88.copy.20261013.191710-arm64-v8a-release.apk`，SHA-256 `B9424E3A8F5D00404E19699D7EC3066A0FDCC0C86636D938E6781884B1133077`。干净短路径构建源、实际 APK 元数据、v2 单签名者、三份字体字节/哈希通过。
- 十六个 source-map 模块与构建源码逐字匹配，含本轮 HomeHero / MarqueeText、既有底栏 musicInfo 和字体 token；APK Hermes 与生成 bundle 字节一致。四个既有首页/播放器素材可见像素与五处唱片底圈/外光 alpha 采样保持一致。
- 原无线调试连接断开后，按用户提供的连接端口恢复至 `192.168.31.232:33939`。核对手机实际安装 APK 的签名证书与新包一致，`adb install -r` 返回 Success；保留数据升级自 `0.3.1-preview.i88.activity.20261013.185425` / `1791888866`。
- `2026-10-13T19:34:49.1430122+08:00` 确认实际安装版本为 `0.3.1-preview.i88.copy.20261013.191710` / `1791890231`，随后停止设备操作，没有自动启动、截屏或手势验收。
- 核对报告 `D:/audiora-previews/issue-88/Audiora-v0.3.1-preview.i88.copy.20261013.191710-verification.json`；安装与精确版本确认完成，原生视觉仍 `pending_user`。PR #105 保持 open。
