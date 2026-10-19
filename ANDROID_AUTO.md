# Android Auto

Audiora 的 Android Auto 入口提供当前播放列表浏览、点歌、恢复/暂停、上下首、停止、进度跳转和当前列表语音匹配。手机和车机共用 RNTrackPlayer 的播放器与 MediaSession，播放状态、进度、倍速和当前封面由同一会话提供。

支持的是手机连接 Android Auto 的媒体集成。独立 Android Automotive OS 安装包、所有歌单/收藏浏览及插件全网语音搜索尚未实现。大队列按每组 100 首展示，最多与应用当前队列一致的 10000 首，不再截断到 500 首。列表中的私有本地封面路径不直接暴露给车机；当前歌曲封面沿用播放器的元数据处理。

## 安装与验收

侧载 APK 进行测试时，在 Android Auto 自身的开发者选项中启用“未知来源”，并在启动器设置中确认 Audiora 已启用。该设置与 Android 系统的 USB 调试不同。参考 [Android 官方测试说明](https://developer.android.com/training/cars/testing#allow-unknown-sources)。

在手机中准备播放列表后，由用户连接真实车机验收：

- 手机前台、后台以及进程被系统回收后，车机都能浏览目录并请求播放；首次安装空队列不应播放无关歌曲。
- 暂停后继续播放应保留进度；显式点播当前歌曲从头播放。
- 连续上下首、暂停、拖进度不丢失、不重复执行；暂停时拖动进度保持暂停。
- 第 501 首以后仍能通过目录浏览和点播；删除、重排队列后刷新正确。
- 手机、车机的歌曲、封面、播放状态、倍速与进度一致；不显示原生过渡用的占位轨道。
- 导航提示、来电、挂挡、断开及重新连接后，核对音频焦点、暂停恢复及紧凑通知行为。

APK 构建与安装见 [BUILDING.md](BUILDING.md)。安装成功并确认版本后，代理停止设备操作，车机功能和视觉由用户手工验收。

## 没有车机时测试

使用 Google 官方 [Desktop Head Unit（DHU）](https://developer.android.com/training/cars/testing/dhu)，由电脑充当 Android Auto 车机，应用仍运行在手机上。

1. 手机安装并更新 Android Auto；Android 10 及以上首次运行 DHU 前先登录 Google Play。
2. Android Studio 的 SDK Manager → SDK Tools 安装 **Android Auto Desktop Head Unit Emulator**。
3. 手机进入 Android Auto 设置，连续点击版本信息 10 次启用开发者模式。在开发者设置启用“未知来源”，再从菜单选择“启动车机服务器”。确认“添加新车到 Android Auto”已启用。
4. 用 USB 连接手机，启用 USB 调试，保持解锁并确认连接与权限提示。在 PowerShell 中执行以下命令；SDK 路径按本机调整，`<设备序列号>` 从 `adb devices` 获取：

```powershell
$sdkPath = "D:\yingj\workspace\android-sdk"
& "$sdkPath\platform-tools\adb.exe" devices
& "$sdkPath\platform-tools\adb.exe" -s "<设备序列号>" forward tcp:5277 tcp:5277
Set-Location "$sdkPath\extras\google\auto"
.\desktop-head-unit.exe
```

先在手机打开 Audiora 准备队列，再在 DHU 的应用列表选择 Audiora，逐项检查前述浏览、播放与状态同步。DHU 控制台可输入 `keycode media_next`、`keycode media_previous`、`focus audio off`、`focus audio on`，测试媒体键和焦点变化。挂挡模拟需先按官方说明配置 `[sensors]` 下的 `gear = true`，随后输入 `gear 100` / `gear 102`，分别模拟前进 / 倒挡。

DHU 能验证投屏交互及模拟事件；真实车机的挂挡联动、厂商蓝牙行为、音频路由和连接稳定性仍需实车确认。只有手机时，可先检查通知栏/耳机的播放控制、暂停续播和进度保持，Android Auto 目录入口待 DHU 或实车验证。当前没有 DHU 或实车的功能验收记录。

## 实现边界

- `AutoMediaBrowserService` 验证客户端 UID、包名及 Google 签名后才启动并绑定播放服务；不启动 Activity。
- 原生内存队列在 JS 初始化前缓冲命令，JS 侧按顺序分发一次。播放请求沿用播放器的版本校验取消过期请求，暂停或下一首不会等待卡住的插件解析；命令不通过单个文件转发，超过 30 秒的指令拒绝执行。
- `android_auto_catalog.json` 在应用私有目录中原子写入，只保存浏览元数据，不包含音频地址、请求头或密钥。
- `scripts/patch-android-auto.js` 为锁定的 RNTP 4.1.2 安装有限的会话、命令、后台绑定钩子。源码不匹配时安装失败；依赖升级必须重新检查适配。
- KotlinAudio 2.1.0 没有公开会话 getter，因此边界处读取其两个私有字段；ExoPlayer 2.19.0 的队列导航和会话动作在连接时保存、断开时恢复。对应 R8 字段保留规则必须随适配一起维护。
- Android Auto 只读取业务队列；RNTrackPlayer 中为切歌协调保留的占位轨道不作为车机播放队列公布。音频焦点继续由现有播放器路径处理。

该实现参考上游媒体浏览方案，但重新实现了会话复用、命令传递和后台启动。上游提交出处：`maotoumao/MusicFree`，`937019e9a328d4e28cddef49570532534a268fcb`。这是本地技术记录，不向上游发送通知或评论。
