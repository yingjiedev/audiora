# 首页白色听歌卡：长歌名单行滚动

2026-10-13，用户要求白色「继续播放」功能块也滚动显示长歌名，避免标题换行导致走形。[修改前实机截图](evidence/home-window-marquee/before-20261013-193732.png)显示白色卡片的歌名最多两行，并在第二行省略；该图仅为问题证据。

白色视窗卡底部标题改用与夜色卡、底栏相同的 `MarqueeText`，保留原 `title` 字号、半粗字重及 `onFeaturedWindow` 前景。完整歌名限制在可用宽度内的一行，实测超宽才循环滚动，短歌名静止。作者/插件名仍在下一行，播放按钮保留独立点击范围。卡片与收藏折页、拾音的布局尺寸沿用现有规则；本轮没有新增图片、颜色、持久化或手势逻辑。

共享组件继续处理切歌重新测量、旧测量事件、前后台暂停及减少动态效果。卡片无障碍标签保留完整歌名，点击仍播放原歌曲或打开当前播放器。

## 验证

- HomeHero / HomeFeatureDeck / MarqueeText：3 套件 / 56 项通过。长歌名回归同时覆盖白色与夜色卡，完整文本传递、真实歌曲播放与切换保持；两种卡片的滚动标题前景均对实际表面验证 4.5:1。
- 完整颜色测试 19 套件 / 239 项通过；`check:colors`、`check:ui`、`typecheck:runtime`、修改文件 ESLint（0 错误 / 0 警告）、diff whitespace 通过。
- 全仓 lint 仍为既有 14 错误 / 100 警告，无关自动格式化已恢复。扩展 JSX/互操作/module/target 参数的 TypeScript 检查中，本轮修改文件诊断为零，全仓仍有既有诊断；未重跑全仓 Jest。
- Native visual QA final result: **blocked — pending user acceptance**。按仓库规则保留数据安装并确认版本后停止设备操作，原生长/短歌名、触摸、圆角和滚动由用户验收。

## 预览交付

- 应用源码 `92b970a465ca990f06bd180be785b5b49b0cec38`；`npm run build-preview -- -PreviewVersion 0.3.1-preview.i88.marquee.20261013.194208`，后续提交仅补交付记录。
- 包名 `io.github.yingjiedev.audiora`，版本 `0.3.1-preview.i88.marquee.20261013.194208` / `1791891729`，ABI arm64-v8a。
- APK `D:/audiora-previews/issue-88/Audiora-v0.3.1-preview.i88.marquee.20261013.194208-arm64-v8a-release.apk`，SHA-256 `1F03832AE118D0FB99A1216115A9811C97BB5719940BBF5FF55BCBD241D143A6`。干净短路径构建源、实际 APK 元数据、v2 单签名者与三份字体字节/哈希通过。
- 十六个 source-map 模块与构建源码逐字匹配，APK Hermes 与生成 bundle 字节一致；四个既有首页/播放器图片像素与五处唱片底圈/外光 alpha 采样一致。
- 核对手机实际安装证书与新包一致，`adb install -r` 返回 Success，保留数据升级自 `0.3.1-preview.i88.copy.20261013.191710` / `1791890231`。`2026-10-13T19:45:24.5215231+08:00` 确认精确安装版本后停止设备操作，没有自动启动、截屏或手势验收。
- 报告 `D:/audiora-previews/issue-88/Audiora-v0.3.1-preview.i88.marquee.20261013.194208-verification.json`。安装和版本确认完成，原生视觉仍 `pending_user`，PR #105 保持 open。
