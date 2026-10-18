# 音效预设、页面设计与实现方案

调研日期：2026-10-18。需求中的“阈值音效”先按“预设音效”理解；动态处理器的 threshold 参数另见下文。参考用户提供的两张手机音效页面截图。平台入口、会员权限和名称随版本变化，下表只记录已查证的能力，不推定各端完全一致。

## 主流产品提供什么

| 产品 | 可核实的能力 | 对 Audiora 的启发 |
| --- | --- | --- |
| Spotify | 预设选择、手动 EQ；Android 可能使用设备均衡器，Connect 远端播放有范围限制。[官方帮助](https://support.spotify.com/us/article/equalizer/) | 清楚区分配置选择、开关和实际生效状态，展示设备可调频段。 |
| Apple Music（iPhone） | EQ 预设与 Sound Check 音量平衡是不同设置。[官方帮助](https://support.apple.com/en-my/guide/iphone/iph5643d2c85/ios) | 音色调整、跨歌曲响度管理应分开，不把提高音量描述成音质提升。 |
| QQ 音乐 | 官方介绍有 SuperSound、场景识别与耳机适配；版本记录有 AI 人声音效。参考截图还显示环绕、黑胶、耳型/听感个性化等入口。[开发者发布页](https://apps.apple.com/cn/app/id414603431) | 用听感说明和卡片组织预设；不同技术能力分组，设备适配需要实际数据。 |
| 网易云音乐 | 官方版本说明介绍 AI 调音大师：分析歌曲特征并接受个人偏好输入。[开发者发布页](https://apps.apple.com/cn/app/id590338362) | “智能”需要分析和选参链路；现阶段 Audiora 使用可解释的固定曲线。 |
| 酷狗音乐 | 官方会员介绍包括蝰蛇系列和现场音效，合作页说明可通过 SDK 提供音效能力。[会员介绍](https://m.kugou.com/vip/v2/privilege.html)、[官方合作页](https://www.kugou.com/about/business.html) | 商业音效名称不代表公开算法，不能把同名 EQ 曲线当作等效实现。 |
| Poweramp Equalizer | 图形/参数 EQ、前级、低高音、限幅/压缩、自定义预设、导入导出和设备分配。[官方功能说明](https://forum.powerampapp.com/files/category/5-poweramp-equalizer/) | 进阶调节应提供数值、曲线、保存和迁移；设备能力不同仍应保留原曲线。 |

厂商的具体滤波系数、模型和处理链通常未公开。下面给出的是可独立实现相似听感的工程方案，并非对其内部算法的确认。

## 常见音效与实现路径

| 类别 | 听感目标 | Audiora 实现方式与边界 |
| --- | --- | --- |
| 原声、人声、低音、明亮、柔和 | 调整低、中、高频的相对比例 | 当前 Android EQ 可实现。正增益配合自动预留余量；不会恢复音源已经丢失的信息。 |
| 流行、摇滚、爵士、古典、电子 | 给不同曲风一个调节起点 | 本次增加五条 Audiora 自定曲线，总计十种预设。不是其他 App 的系数复刻，也不会自动识别歌曲。 |
| 夜间、均衡响度、动态增强 | 缩小强弱差或跨歌曲音量差 | 压缩器通过包络、阈值、压缩比、起音/释放时间工作；跨歌曲响度还需测量或读取响度元数据，不能仅凭 EQ 完成。Android 9+ 的 DynamicsProcessing 有多段压缩模块，当前尚未启用。[官方 API](https://developer.android.com/reference/android/media/audiofx/DynamicsProcessing) |
| 现场、音乐厅、混响 | 产生空间反射与衰减尾音 | 可用算法混响或脉冲响应卷积，需明确干湿比、延迟及处理成本；现有 EQ 无法产生这些效果。Android 原生混响的辅助效果接入与发送电平还要进入播放器链路。[PresetReverb](https://developer.android.com/reference/android/media/audiofx/PresetReverb) |
| 环绕、立体声拓宽 | 改变声像宽度或外化程度 | 可做声道交叉、延迟和 HRTF 卷积。Android 默认空间化通常针对多声道；设备支持、内容和输出路由都要满足条件。Virtualizer 在 API 35 已弃用，不能简单新增开关就宣称空间音频。[Android 空间音频](https://developer.android.com/media/grow/spatial-audio)、[Virtualizer](https://developer.android.com/reference/android/media/audiofx/Virtualizer) |
| 耳机校准 | 补偿具体耳机的频响偏差 | 接入型号与测量曲线，生成 EQ；可评估 AutoEq 数据、许可与更新机制，再按设备频段拟合。十段图形 EQ 对窄带峰值的拟合精度有限。[AutoEq 项目](https://github.com/jaakkopasanen/AutoEq) |
| 耳型、听感个性化 | 依据个人信息调整空间或音色 | 偏好问答可先映射 EQ；耳型空间化需测量/模型/HRTF，听觉补偿需独立校准流程，不能由普通频段滑杆推导。 |
| AI/智能音效 | 按歌曲或用户特征自动选参 | 需要音频特征、模型或分类器、平滑切换及可解释的结果；只切换固定预设不足以支撑“AI”名称。 |
| 黑胶、磁带、复古 | 温暖、柔化高频或加入介质质感 | EQ 可模拟部分音色；谐波、噪声、抖晃需要非线性与调制 DSP，不在本次实现范围。 |
| 节拍震动、灯效 | 让触觉/视觉跟随节奏 | 需要节拍检测、时间同步和设备能力管理，属于另一条体验链路。 |

Android 现有播放器是 RNTP 4.1.2 / KotlinAudio 2.1.0，使用旧 ExoPlayer 2。若加入自定义 PCM DSP，应针对这条实际链路接入并处理格式变化、seek、flush、释放和后台恢复，不能直接复制 Media3 的接法。iOS 需另建可处理音频的原生链路；可研究 Apple 的 EQ/混响 Audio Unit，不能假定直接挂到当前 AVPlayer 就能生效。[Apple Audio Units](https://developer.apple.com/documentation/avfaudio/audio-units)

## 如果“阈值”指动态处理参数

Threshold 是压缩器或限幅器开始压低信号的电平；EQ 增益是另一类参数。压缩还需要 ratio、attack、release、knee 等，不能单独调整 threshold 就代表某种完整音效。Android `DynamicsProcessing.MbcBand` 公开了这些参数。[官方 API](https://developer.android.com/reference/android/media/audiofx/DynamicsProcessing.MbcBand)

当前限幅用于峰值保护，界面仅显示自动保护。本次不新增未经试听验证的动态预设。后续可单独开发“夜间”模式：启用链接声道的压缩、限制补偿增益，再以不同曲风和强瞬态音源检查泵动、失真及响度变化。保护限幅不能等同于已经完成夜间压缩或跨曲音量平衡。

## 本次页面落地

- 顶部保留总开关，显示当前预设、实际音效状态和仅音乐播放的范围。
- “音效预设 / 自定义”分区。预设使用双列卡片、听感说明、真实配置曲线及选中勾号；全部沿用 Audiora 语义颜色，不引入参考产品的蓝金会员配色。
- 自定义页展示按对数频率排列的增益控制点，低/中/高频分别调节；只显示设备实际支持的频段。图为配置示意，不是实时频谱或测量频响。
- 前级增益与设备能力联动，保存/重置有明确按钮和状态。自定义仍是一个保存槽位，再次保存会替换它；实时调节会更新当前配置，保存用于留下可再次载入的副本。
- 预设切换保留“我的预设”，重置只重置当前曲线及前级。启用音效后可实时试听；未支持的能力不提供入口。

## 备份恢复约定

继续使用共享 v3 包络，在 `data.audiora.audioEffects` 写入 `enabled`、`preset`、`bands`、`preampDb`、`savedCustom`。不写入 session、设备频段、支持能力或 active 状态。

本地与 WebDAV 调用同一异步备份入口，冷启动未进入音效页也会读取原生设置；导出前等待已排队的滑杆写入。恢复先严格校验开关、预设、频率顺序、增益与前级范围，再写入原生持久化配置；恢复后按目标设备的频段插值。音效是一份全局配置，不跟随歌单恢复模式合并，存在时替换当前音效；缺失时保留当前音效。

暂不支持原生音效的平台使用独立存储保留导入配置，之后备份继续带出，但不宣称能播放生效。读取或写入失败会令操作报错，不返回完整成功。整个恢复操作沿用现有非事务流程，插件或歌单已经恢复后若音效写入失败，会报告失败但不回滚已恢复的歌单/插件。

## 验收范围

代码检查与自动回归覆盖配置解析、备份往返、旧格式兼容、存储失败、跨平台保留、频段分组、预设应用与保存失败反馈。原生视觉与听感仍需用户在新 APK 上验收：浅色、深色、自定义主题；五/十频段；预设/自定义切换；耳机/外放；重启后恢复；本地和 WebDAV 备份恢复。当前手机安装的旧测试包不包含本轮更新。
