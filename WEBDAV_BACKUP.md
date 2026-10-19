# WebDAV 自动备份（#133）

需求来源：[issue #133](https://github.com/yingjiedev/audiora/issues/133)。Issue 只有标题“复用现有 WebDAV，仅差自动/定时触发”，没有正文或补充评论。本次按复用既有备份能力、增加周期触发实现。

## 调研结论

- `src/core/backup.ts` 生成 v3 JSON，且兼容历史恢复格式。同步最新 master 后，备份内容还包含收藏分组和音效设置，生成过程为异步调用；共享上传入口等待完整内容生成后再写入。
- `backupSetting.tsx` 原先直接完成 WebDAV 上传、配置和恢复，当前目标文件是 `/Audiora/AudioraBackup.json`，恢复兼容 `/MusicFree/MusicFreeBackup.json`、`/BakaMusic/BakaMusicBackup.json`。
- 项目已依赖 `webdav`、NetInfo、MMKV；无需新增依赖或权限。已核对锁定版本 `webdav` 的实现：上传返回 `Promise<boolean>`，请求通过 `signal` 支持取消，不能直接假设它支持 `timeout` 选项。参见 [WebDAV 客户端](https://github.com/perry-mitchell/webdav-client)。
- [React Native AppState](https://reactnative.dev/docs/appstate) 提供前后台状态及变更事件。本次选择前台周期检查加启动/回前台补做，功能不承诺应用被关闭后由系统唤醒，也不使用音频服务维持备份任务。需要应用关闭后独立执行的后台任务，应另行设计原生调度与后台数据初始化。

## 用户行为

在“设置 → 备份与恢复 → WebDAV”中：

1. 填写有效 HTTP(S) 地址、用户名和密码。
2. 开启“自动备份”（默认关闭），选择每天或每周（默认每天）。
3. 开启后立即检查是否到期。周期以本服务器/账户最近一次成功备份为起点，分别为 24 小时或 7 天；手动成功备份也重置周期。
4. 应用在前台时每分钟检查一次；启动、回前台、网络恢复和配置修改也会检查。应用处于后台或关闭期间不启动新备份，下次回到前台时补做一份当前快照。
5. 失败后至少等待 15 分钟再自动重试；离线期间等待联网。用户可以随时手动重试。

页面显示最近成功备份时间和最近失败提示。失败保留之前的成功时间；更换服务器或账户后，不沿用原目标的备份记录。没有配置或配置无效时无法开启，已经开启的设置仍可关闭。

设置行仅显示简短提示，最近成功时间独占标题下方一行。卡片下方保留备份范围及覆盖提示；点击“备份说明”打开可滚动的底部面板，查看完整周期、补做、重试规则及备份内容。失败时另显示“备份失败，查看详情”，不挤占最近成功时间，也不将完整错误说明常驻在设置行中。

备份范围和现有手动备份一致：歌单（含收藏分组）、插件地址和音效设置。不包含音频文件、其他应用设置或 WebDAV 密码；仍覆盖同一个云端文件，不增加历史版本管理。恢复音效会替换当前设置，旧备份未包含音效时保留当前设置。

## 实现与故障处理

- `webdavBackup.ts` 提供手动/自动共用上传入口，并保留原文件格式、目录和覆盖策略。同一目标的并发请求共用一个上传任务；切换目标时串行处理，旧任务不能更新新目标的成功记录。
- 上传只在服务端确认成功后记录完成时间；创建目录失败、序列化失败、上传返回失败和请求错误都写入失败状态。整个上传流程设置 60 秒取消期限，避免永久占用任务。
- 状态存入 `App.PersistStatus`，自动开关及周期存入 `App.config`；无需迁移现有设置。状态不保存密码或包含请求详情的错误对象。
- `webdavAutoBackup.ts` 监听 AppState、网络和 MMKV 配置变更。账号配置的多次写入合并后再检查；进入后台清理计时器，卸载时清理监听。公网探测失败不会阻断已经连接的局域网 WebDAV。
- 根组件仅在 bootstrap 成功完成后启动调度，保证歌单和插件已经载入；失败和加载中不启动。自动备份不弹 Toast，也不阻断播放。
- 手动恢复仍按原顺序查找三个备份路径；同时将存在性检查纳入错误捕获，避免网络失败产生未处理的拒绝。

## 验证与验收

回归测试覆盖开关、周期选择、状态显示、手动上传/恢复兼容性、上传/目录/序列化失败、超时取消、并发、切换目标、首次启动、周期边界、重启、前后台切换、断网恢复、持久化重试间隔及监听清理。

自动检查命令：

```powershell
node node_modules/jest/bin/jest.js --runInBand
npm run typecheck:runtime
npm run check:colors
npm run check:ui
npm run lint
```

同步最新 master 后，全量 Jest 通过：180 个测试套件、1389 个测试。运行时引用、颜色和 UI 规范检查通过。本次没有改动色板或公共控件配色，设置页复用 `SettingRow` 和 `ThemeSwitch`，说明面板复用 `PanelBase`、`PanelHeader` 和主题按钮。补充回归覆盖异步备份生成和失败处理、说明入口、失败详情、最近成功时间保留、打开面板后失败消除及确认关闭。

同步最新 master 后，全仓库 lint 通过（0 错误、106 项警告）。全量 `tsc` 仍受仓库既有的 RN 0.86 配置导出路径问题影响（`tsconfig.json` 引用的 `@react-native/typescript-config/tsconfig.json` 不再公开导出）。仅在检查进程内改用实际配置路径后，本次改动文件没有类型错误，项目其他文件仍有 46 条既有诊断；没有修改仓库 tsconfig 来扩大需求范围。

已按用户要求安装独立包名的 Audiora-test 测试包，并在用户要求截屏时查看设置页；根据用户反馈精简了常驻说明。尚待用户使用真实 WebDAV 和 Android/iOS 设备验收：手动备份及恢复、开启后上传、前后台补做、错误提示，以及新版说明面板和浅色/深色/自定义主题下的设置页显示。

界面调整前的用户反馈截图如下，用于说明长提示与右侧控件挤占宽度的问题；不是修改后的界面验收图。新版面板截图及实际显示效果仍待用户验收。

![调整前：WebDAV 设置行中的长提示挤占布局](.github/pr-assets/webdav-settings-before.png)

## 设置界面调整测试包

以下为同步 master 前已交付的测试包记录；同步后的 PR 重新执行自动检查，尚未重新构建安装。

- 应用名称：`Audiora-test`。
- applicationId：`io.github.yingjiedev.audiora.test.preview`。
- versionName：`0.3.1-testui.20261019.000755`。
- versionCode：`1792339675`。
- ABI：`arm64-v8a`。
- APK 文件名：`Audiora-v0.3.1-testui.20261019.000755-arm64-v8a-release.apk`，本机构建输出目录为 `android/app/build/outputs/apk/release/`。
- APK SHA-256：`CDFD8BE98524EC0B759C4C8C68823F62DC3A9CDFEA25D1019569C0D4FF9BB15B`。
- 签名：APK Signature Scheme v2，单签名者，仓库 Android Debug 测试证书；证书 SHA-256 为 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`。
- 已核对 APK 名称、包名、版本、ABI、签名和 3 个字体文件（23,675,684 字节）；构建时的临时原生配置与签名配置已恢复。
- 已通过 `adb install -r` 更新到用户连接的 Redmi 真机，安装后核对上述 versionName 和 versionCode，更新时间为 `2026-10-19 00:11:14`。
- 按仓库交付规则，确认安装后停止设备操作；本次未启动模拟器或另行截图，新布局及面板的真机视觉验收由用户完成。
