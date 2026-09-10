# Audiora

<div align="center">

  <img src="./src/assets/imgs/audiora-wordmark.png" alt="Audiora" width="520" />

  **专注视觉美化、权限收缩与合规加强的开源音乐 App**

  [English](./readme-en.md) | 简体中文

  [![License](https://img.shields.io/badge/license-AGPL%203.0-blue)](LICENSE)
  [![Version](https://img.shields.io/github/v/release/yingjiedev/audiora?color=green)](https://github.com/yingjiedev/audiora/releases)
  [![Platform](https://img.shields.io/badge/platform-Android-orange)]()

</div>

---

## 本仓库是什么

Audiora 是一个基于 MusicFree 持续改进的开源音乐 App。项目保留上游的通用插件系统、用户自定义音乐源、播放与下载等基础能力，并围绕以下三个方向维护：

- **视觉美化**：建立独立的 Audiora 品牌与设计体系，持续优化首页、播放器、设置、主题及交互体验。
- **权限收缩**：遵循最小权限原则，移除不必要的高风险 Android 权限，优先使用系统文件选择器、作用域存储和应用私有目录。
- **合规加强**：明确软件、插件、音乐源与内容之间的责任边界；默认发行包不包含未经授权的音乐源、商业平台专用凭据或绕过访问控制的实现。

本项目直接基于 [Merilune/MusicFree](https://github.com/Merilune/MusicFree)，其版本源自 [Toskysun/MusicFree](https://github.com/Toskysun/MusicFree)，最初上游为 [maotoumao/MusicFree](https://github.com/maotoumao/MusicFree)（原作者猫头猫）。Audiora 是客户端改进项目，不是音乐内容提供方或音乐服务运营方。

## 项目定位与责任边界

Audiora 是一个用于管理、播放和同步音乐的通用客户端，面向用户自有、已获授权或依法可以访问的音乐内容。项目本身不提供音乐内容，也不运营音乐服务。

- Audiora 不提供、不内置也不推荐未经授权的音乐源、第三方商业平台专用密钥或接口凭据，以及绕过 DRM 或其他访问控制的实现。
- 插件和用户配置的音乐源由用户主动选择，可能由独立第三方开发和运营。项目提供通用的插件运行能力，不代表对其内容、可用性、安全性或合法性作出审核、背书或保证。
- 使用者应确认自己有权访问、播放、下载或同步相关内容，并遵守所在地法律、著作权规则及相关服务条款。因第三方插件、音乐源或超出授权范围的使用产生的后果，由相应提供者和使用者依法承担。

如果某个插件、示例或项目文档可能侵犯权利，请通过 [Issue](../../issues) 提交来源、权利依据和相关链接，以便项目维护者核查并采取移除链接、停止推荐等适当措施。

## 相较上游的主要区别

### 主要亮点
- **内置字体**：思源宋体、霞鹜新致宋、志莽行书三款内置字体，全局字体与歌词字体可分别选择
- **自定义启动页**：支持使用自选图片，打造与整体主题一致的开屏体验

### 主题与个性化
- **自定义主题重做**：黑白初始配色；背景壁纸支持模糊度/透明度/暗化遮罩调节，表面不透明度、卡片阴影强度全局可调
- **歌单独立背景**：每个本地歌单可单独设置背景，支持"用封面当背景"（在线封面同样可用）
- **全新 Audiora 品牌**：应用内 Logo、Android/iOS 图标与启动资源统一更新
- **选图裁剪**：所有选图入口支持自由比例裁剪，并按最终显示比例锁定裁剪框

### 播放与通知
- **紧凑媒体通知**：以更紧凑的高度展示收藏、上一首、播放/暂停和下一首，收藏状态实时显示，锁屏与耳机控制不受影响
- **桌面悬浮歌词**：逐字进度、翻译副行、拖动定位、多套配色预设、字体字号可调、锁定防误触

### 权限与存储
- **最小权限**：移除宽泛存储、管理全部文件、悬浮窗、精确闹钟和通知策略访问等非必要权限
- **作用域访问**：本地音乐、下载目录与文件导入优先通过 Android 系统文件选择器和授权目录访问
- **边界透明**：播放、插件联网和后台播放仍需要网络、前台服务等必要能力；项目不以“零权限”或“完全离线”作为宣传

### 合规与发行
- **不内置内容源**：默认发行包不提供官方音乐源，也不包含第三方商业平台的专用密钥、凭据或绕过代码
- **插件责任分离**：插件及用户配置的音乐源由用户自行选择，项目不对独立第三方内容作审核、背书或保证
- **来源与许可清晰**：保留上游来源、修改说明、开源许可证和权利反馈渠道

### 一些体验修复
- 转场动画不再丢失：歌单详情、推荐歌单、榜单、专辑/歌手页进入时左侧滑入动画恢复
- 评论区/全屏面板补不透明底，壁纸下不再看不清字
- 逐字歌词开关切换、歌词跳回旧歌、弹窗标题顶出、备份导入合并我喜欢歌单等一堆小毛病
- 精简不适用于本分支的上游公告与更新提示

> 完整改动见 [changelog](./changelog.md) 与提交历史。

## 快速开始

1. 前往 [Releases](https://github.com/yingjiedev/audiora/releases) 下载最新 APK 安装
2. 打开应用 → 侧边栏 → 设置 → 插件设置 → 从本地或网络安装插件
3. 仅添加您信任且有权使用的插件或自有音乐源

> Audiora 不提供官方音乐源。安装第三方插件前，请自行核实其来源、权限、网络访问范围及相关服务条款。

> 需要注意的是 **目前只编译了 Android arm64（64 位）版本**，其他架构有需要的话可以提 Issue （真的会有人用吗）。

## 📖 文档

- 📚 **插件开发**：[开发文档](https://musicfree.catcat.work/plugin/introduction.html)
- ❓ **常见问题**：[Q&A 文档](https://musicfree.catcat.work/qa/common.html)
- 🔧 **使用指南**：[详细教程](https://musicfree.catcat.work/usage/mobile/install-plugin.html)
- 📦 **本地 Android 测试包**：[构建与验证步骤](./BUILDING.md)

音质键值、原版插件兼容说明与上游一致，详见上游 README。

## 致谢

本项目站在前人的肩膀上：

- **原作者**：[猫头猫 maotoumao](https://github.com/maotoumao) — [原项目](https://github.com/maotoumao/MusicFree)
- **上游**：[Toskysun](https://github.com/Toskysun) — [Toskysun/MusicFree](https://github.com/Toskysun/MusicFree)
- **直接基础版本**：[Merilune](https://github.com/Merilune) — [Merilune/MusicFree](https://github.com/Merilune/MusicFree)

- **Claude** — [Claude Code](https://claude.com/claude-code)：陪我一路把这个播放器改到今天，这里的绝大部分改动都有它的一份，在此致谢 🤝

## 协议

本项目遵循 [AGPL-3.0](LICENSE) 开源协议。

- 使用、修改与再分发必须遵守 AGPL-3.0 及适用的版权声明
- 分发或通过网络提供修改版本时，应按许可证要求提供相应源代码与许可证信息
- 开源许可不授予任何音乐内容、第三方服务、商标或接口的额外使用权
- 请仅访问和使用您有权使用的内容、插件与音乐源

## 反馈

遇到问题或有建议？欢迎 [提交 Issue](../../issues)

---

<div align="center">
  Made with ❤️
</div>
