# 首页风格审查与重构 · 2026-10-12

## 依据与边界

用户提供四张截图：当前首页、音乐库、“我的”、外部产品首页。以 Audiora 的音乐库和“我的”为色系、字体、间距及组件基准；外部首页用于内容排序和横向发现结构。截图只证明修改前的状态，新版真机外观仍待用户验收。

| 本次输入 | 职责 |
| --- | --- |
| 1b59b62856d25b59e408503cfe7aa050.jpg | 当前首页 |
| 8f497a69fa4a0b2ae566be2a5fe656ef.jpg | 音乐库风格基准 |
| 5c75ab4b10d300bfff5fad279d7f1ae3.jpg | 我的风格基准 |
| 8c13832cb8eaa760ffc286a09ed0a81c.jpg | 外部首页内容布局参考 |

四张输入已通过 view_image 逐张检查。整理仓库证据时，微信 RWTemp 原目录已不可访问，故只记录输入名称和已观察的差异；不把其他版本截图当作本次证据，也不留下失效图片链接。原始图片仍在本次聊天输入中。

## 原有问题与修正

| 观察 | 原因 | 本次处理 |
| --- | --- | --- |
| 首页轴线比另外两页更靠边 | 首页大多使用 24rpx 边距，另外两页是 40rpx | 页头、搜索、横向卡片、内容标题和歌曲行统一 40rpx |
| 大山景和巨大宣传文字占据首屏 | 静态图片优先于用户可听的歌曲；下方再独立重复“继续聆听” | 开头改为真实当前/最近歌曲的白色卡片；封面、标题、作者、来源及进度集中展示 |
| 四个立体彩色图标各套白卡，视觉嘈杂 | 品牌装饰和功能控件混用，卡片层数过多 | 四个入口改成既有线性图标、22rpx 标签、20rpx 数量，平铺在页面上 |
| 拾音与宣传区、继续聆听都像独立大按钮 | 同屏播放入口分散 | 继续聆听和拾音组成横向双卡；卡片约为屏宽 76%，可向左滑动，灰蓝中性小播放底形 |
| 榜单卡套卡，还显示冗长“榜单定义” | 直接将插件 description 当首页推荐文案 | 保留真实榜单封面、名称与一次来源说明，移除重复标签和定义；完整说明仍在原详情页 |
| 第一屏主要是入口和宣传，自己的歌曲被压到后面 | 内容排序缺少个人音乐 | 增加三首真实“我喜欢”歌曲，公共 MusicItem 显示封面及收藏按钮；可播放整张真实歌单 |
| 按钮、阴影、标题和圆角不统一 | 旧首页独立定义各套尺寸与透明颜色 | 使用既有 spacing/radius/useColors；区标题 30rpx，歌名公共 26rpx，辅助文字 20/22rpx；取消额外阴影 |
| 小圆按钮/搜索不到 44dp，准星无独立功能 | 只考虑可见图形大小 | 行为入口至少 44dp；去掉同一搜索按钮中的装饰准星，保留搜索和定时关闭 |

## 功能保留与数据来源

- 搜索、定时关闭、推荐歌单、历史抽屉、我喜欢、导入/扫描入口全部沿用现有路由。
- 继续聆听：当前歌曲的卡片打开既有播放器，独立按钮继续/暂停；最近歌曲直接播放其真实对象。进度只在该卡订阅，历史歌曲不借用当前歌曲进度。没有歌曲时进入本地音乐。
- 拾音使用现有 useShiYin/buildShiYinQueue，不虚构“每日 30”、热度、会员、运势、AI 推荐或关注数据。
- 收藏订阅默认歌单 useSheetItem，增删后更新。预览最多三首，但单首和播放全部使用完整真实收藏队列及歌单上下文。没有收藏时显示说明和搜索入口，播放全部不出现。
- 榜单目录继续用现有 getTopLists/缓存，完整目录和详情沿用原路由、插件哈希与原榜单对象。加载/空列表/失败保留明确状态及查看目录入口。
- 最近播放仍来自历史，保留原三首预览与历史入口；使用三列封面、单行歌名/作者及完整无障碍名称。
- 缺少默认收藏基础数据时回落到默认收藏标识，不把任意用户歌单标作“我喜欢”。
- 新增收藏空状态文案的简体、繁体、英文与类型定义。字体、默认封面、所有图标均沿用仓库资源；没有新增原始色值或重写用户主题配置。

## 验证

- 相关 Jest：11 套件 / 102 项通过，涵盖新首页、收藏数据、听歌卡、页头、语言、真实拾音、榜单、公共歌曲行、音乐库与“我的”。
- 颜色 Jest：17 套件 / 179 项通过；新增听歌卡浅色、深色、自定义主色和透明表面合成检查，并纳入 test:colors。
- check:colors、check:ui、typecheck:runtime、改动文件 ESLint 通过，没有增加颜色/UI 基线或豁免。
- npm run lint 已执行，仓库仍有 14 项既有错误 / 100 项警告；无关自动格式改动已恢复。显式 TypeScript 检查未发现此次改动文件诊断，全仓其他既有诊断未处理。
- 根据 AGENTS.md，在真机保留数据覆盖安装、确认实际版本后停止设备操作。不会以组件测试或打包成功代替视觉通过。

## 待用户验收

首页与音乐库/“我的”的轴线、字体、白卡及中性图标一致性；双卡滑动和长歌名；收藏空/有数据；真实播放/暂停、收藏增删、完整榜单；浅/深/自定义主题及未知壁纸。iOS 未构建或视觉验收。


## Android preview delivery

- Version: 0.3.1-preview.i88.homeui.20261012.195427; versionCode 1791806067; applicationId io.github.yingjiedev.audiora; ABI arm64-v8a; app source a28f782cfb4409eaf83be14c644afcf42995db82.
- APK: D:\audiora-previews\issue-88\Audiora-v0.3.1-preview.i88.homeui.20261012.195427-arm64-v8a-release.apk; SHA-256 307C0BA43B9C826DE416B20D5957EFBDD37EC2DD4ADE9C3FDE94FF6B8A4AC3EA. Verified exact clean source commit, v2 single signer, packaged fonts by bytes/hash, and vinyl bitmap.
- Compared installed certificate successfully; adb install -r upgraded 0.3.1-preview.i88.chartsui.20261012.003254 / 1791736375 with data preserved. Exact installed name/code confirmed on adb-136d1219-c52c06._adb-tls-connect._tcp at 2026-10-12T19:58:42.9998823+08:00; all device operations stopped afterward. No app launch, screenshot, emulator or native visual acceptance.
- Report: D:/audiora-previews/issue-88/Audiora-v0.3.1-preview.i88.homeui.20261012.195427-verification.json. User acceptance pending.
